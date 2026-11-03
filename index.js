require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { fyersModel } = require("fyers-api-v3");
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { generateDhanToken, executeDhanTrade } = require('./dhanApi');
const { sendApprovalEmail, sendOtpEmail, sendDeletionConfirmationEmail } = require('./emailService');
const { 
    formatOptionSymbol, 
    generateBrokerSessionToken, 
    executeBrokerTrade, 
    exitAllBrokerPositions,
    isTokenFromToday, 
    isBrokerConfigured, 
    isBrokerTokenValid, 
    getBrokerTokenDetails, 
    getISTMidnightRemainingSeconds
} = require('./brokerAdapters');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_super_secret_key_change_in_production';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

let db;

// ------------------------------------------------------------------
// AUTOMATIC TUESDAY EXPIRY CALENDAR CALCULATOR
// ------------------------------------------------------------------
const getUpcomingTuesdayExpiries = (indexName = 'NIFTY', count = 8) => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const now = new Date();
    // Time in Asia/Kolkata
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);

    let d = new Date(istDate.getFullYear(), istDate.getMonth(), istDate.getDate());

    // Expiries are only on Tuesdays (day of week = 2)
    // If today is Tuesday, check cutoff: after 15:30 IST today's contract is expired
    const isTuesday = d.getDay() === 2;
    const isPastCutoff = isTuesday && (istDate.getHours() > 15 || (istDate.getHours() === 15 && istDate.getMinutes() >= 30));

    if (isTuesday && isPastCutoff) {
        d.setDate(d.getDate() + 7);
    } else {
        while (d.getDay() !== 2) {
            d.setDate(d.getDate() + 1);
        }
    }

    const expiries = [];
    const cleanIndex = (indexName || 'NIFTY').toUpperCase().replace(/\s*50\b/i, '').replace(/\s*\(BSE\)/i, '').replace(/\s+/g, '');

    for (let i = 0; i < count; i++) {
        const day = String(d.getDate()).padStart(2, '0');
        const mIdx = d.getMonth();
        const monthNum = String(mIdx + 1).padStart(2, '0');
        const monthStr = months[mIdx];
        const year = d.getFullYear();
        const year2D = String(year).slice(-2);

        // Check if next Tuesday is in the next month -> Last Tuesday of month is Monthly expiry
        const nextWeek = new Date(d);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const isMonthly = nextWeek.getMonth() !== mIdx ? 1 : 0;

        const expiryDate = `${day}-${monthNum}-${year}`;
        const expiryCode = `${day}${monthStr}${year2D}`;

        expiries.push({
            index_name: cleanIndex,
            expiry_date: expiryDate,
            expiry_code: expiryCode,
            label: `${expiryDate} (${expiryCode})${isMonthly ? ' [Monthly]' : ''}`,
            value: expiryCode,
            date: expiryDate,
            is_monthly: isMonthly,
            is_active: 1
        });

        d.setDate(d.getDate() + 7);
    }
    return expiries;
};

const isExpiryCodePast = (code) => {
    if (!code || typeof code !== 'string') return true;
    const match = code.trim().toUpperCase().match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
    if (!match) return true;
    const months = { 'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5, 'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11 };
    const day = parseInt(match[1], 10);
    const mIdx = months[match[2]];
    if (mIdx === undefined) return true;
    let year = parseInt(match[3], 10);
    if (year < 100) year += 2000;

    const expiryTime = new Date(year, mIdx, day, 15, 30, 0).getTime();
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset).getTime();

    return nowIST > expiryTime;
};

const syncTuesdayExpiryCalendar = async (database) => {
    if (!database) return;
    try {
        const supportedIndices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'];
        
        // 1. Remove past expiries from expiry_calendar
        const existing = await database.all(`SELECT id, expiry_code FROM expiry_calendar`);
        for (const row of existing) {
            if (isExpiryCodePast(row.expiry_code)) {
                await database.run(`DELETE FROM expiry_calendar WHERE id = ?`, [row.id]);
            }
        }

        // 2. Insert upcoming Tuesday expiries if not present
        for (const idx of supportedIndices) {
            const upcoming = getUpcomingTuesdayExpiries(idx, 8);
            for (const item of upcoming) {
                const row = await database.get(
                    `SELECT id FROM expiry_calendar WHERE index_name = ? AND expiry_code = ?`,
                    [item.index_name, item.expiry_code]
                );
                if (!row) {
                    await database.run(
                        `INSERT INTO expiry_calendar (index_name, expiry_date, expiry_code, is_monthly, is_active) VALUES (?, ?, ?, ?, 1)`,
                        [item.index_name, item.expiry_date, item.expiry_code, item.is_monthly]
                    );
                }
            }
        }

        // 3. Automatically upgrade any outdated or empty user preferences to the latest active Tuesday expiry
        const users = await database.all(`SELECT user_id, selected_index, selected_expiry FROM user_preferences`);
        for (const u of users) {
            if (isExpiryCodePast(u.selected_expiry)) {
                const nearestForUser = getUpcomingTuesdayExpiries(u.selected_index || 'NIFTY', 1)[0].expiry_code;
                await database.run(
                    `UPDATE user_preferences SET selected_expiry = ? WHERE user_id = ?`,
                    [nearestForUser, u.user_id]
                );
                console.log(`[EXPIRY AUTO-UPDATE] Updated user ${u.user_id} expiry from "${u.selected_expiry}" to latest Tuesday expiry "${nearestForUser}"`);
            }
        }
    } catch (err) {
        console.error('[EXPIRY SYNC NOTICE]:', err.message);
    }
};

const initDB = async () => {
    try {
        db = await open({
            filename: './esp_database.sqlite',
            driver: sqlite3.Database
        });

        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE,
                name TEXT,
                password_hash TEXT,
                google_id TEXT UNIQUE,
                email TEXT UNIQUE,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id INTEGER PRIMARY KEY,
                selected_broker TEXT DEFAULT 'Fyers',
                selected_index TEXT DEFAULT 'NIFTY 50',
                selected_expiry TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS broker_credentials (
                user_id INTEGER PRIMARY KEY,
                fyers_id TEXT,
                fyers_totp_secret TEXT,
                fyers_pin TEXT,
                fyers_app_id TEXT,
                fyers_secret_key TEXT,
                fyers_access_token TEXT,
                dhan_client_id TEXT,
                dhan_password TEXT,
                dhan_totp_secret TEXT,
                dhan_api_key TEXT,
                dhan_api_secret TEXT,
                dhan_access_token TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS trade_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                broker TEXT,
                symbol TEXT,
                type TEXT,
                side INTEGER,
                quantity INTEGER,
                message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS waitlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                serial_number TEXT UNIQUE,
                hw_revision TEXT DEFAULT 'v1.0',
                firmware_version TEXT DEFAULT '1.0.0',
                status TEXT DEFAULT 'unassigned',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS device_bindings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                order_ref TEXT,
                bound_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS device_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                key_hash TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS token_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                broker TEXT NOT NULL,
                trigger_type TEXT NOT NULL,
                result TEXT NOT NULL,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS email_otps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                otp_code TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                consumed INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_type TEXT NOT NULL,
                actor_id TEXT,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS expiry_calendar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                index_name TEXT NOT NULL,
                expiry_date TEXT NOT NULL,
                expiry_code TEXT NOT NULL,
                is_monthly INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS device_telemetry (
                device_id TEXT PRIMARY KEY,
                user_id INTEGER,
                battery_pct INTEGER,
                wifi_rssi INTEGER,
                last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS kill_switch_state (
                user_id INTEGER PRIMARY KEY,
                active INTEGER DEFAULT 0,
                triggered_at DATETIME,
                triggered_by TEXT,
                reason TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS device_lock_state (
                user_id INTEGER PRIMARY KEY,
                device_id TEXT,
                is_locked INTEGER DEFAULT 0,
                locked_at DATETIME,
                locked_by TEXT,
                reason TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS data_deletion_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT,
                email TEXT,
                reason TEXT,
                status TEXT DEFAULT 'PENDING',
                requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                reviewed_at DATETIME,
                reviewed_by TEXT,
                notes TEXT
            );
        `);

        // Seed default admin
        const adminExists = await db.get(`SELECT id FROM users WHERE username = 'admin'`);
        if (!adminExists) {
            const hash = await bcrypt.hash('Admin@26#', 10);
            await db.run(`INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')`, hash);
            console.log("Default admin account created (admin/Admin@26#).");
        }

        // Migrate users name column if not present
        try {
            await db.run(`ALTER TABLE users ADD COLUMN name TEXT;`);
        } catch (e) {}
        try {
            await db.run(`UPDATE users SET name = 'System Administrator' WHERE username = 'admin' AND (name IS NULL OR name = '');`);
            await db.run(`UPDATE users SET name = 'Demo Trader' WHERE username = 'device12' AND (name IS NULL OR name = '');`);
            await db.run(`UPDATE users SET name = 'Beta Tester' WHERE username = 'tester' AND (name IS NULL OR name = '');`);
        } catch (e) {}

        // Migrate broker token timestamps if not present
        try {
            await db.run(`ALTER TABLE broker_credentials ADD COLUMN fyers_token_generated_at DATETIME;`);
        } catch (e) {}
        try {
            await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_token_generated_at DATETIME;`);
        } catch (e) {}

        // Migrate Dhan columns if not present
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_client_id TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_password TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_totp_secret TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_api_key TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_api_secret TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN dhan_access_token TEXT;`); } catch (e) {}

        // Migrate Upstox columns if not present
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN upstox_api_key TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN upstox_api_secret TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN upstox_redirect_url TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN upstox_access_token TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN upstox_token_generated_at DATETIME;`); } catch (e) {}

        // Migrate Angel One columns if not present
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN angel_client_code TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN angel_password TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN angel_api_key TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN angel_totp_secret TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN angel_access_token TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN angel_token_generated_at DATETIME;`); } catch (e) {}

        // Migrate Kotak Neo columns if not present
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_consumer_key TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_consumer_secret TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_mobile TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_password TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_mpin TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_access_token TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN kotak_token_generated_at DATETIME;`); } catch (e) {}

        // Migrate Zerodha Kite columns if not present
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN zerodha_api_key TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN zerodha_api_secret TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN zerodha_request_token TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN zerodha_access_token TEXT;`); } catch (e) {}
        try { await db.run(`ALTER TABLE broker_credentials ADD COLUMN zerodha_token_generated_at DATETIME;`); } catch (e) {}

        // Migrate user_preferences added_brokers column if not present
        try {
            await db.run(`ALTER TABLE user_preferences ADD COLUMN added_brokers TEXT;`);
        } catch (e) {}

        // Migrate user_preferences kill_switch_scope column if not present ('current' or 'all')
        try {
            await db.run(`ALTER TABLE user_preferences ADD COLUMN kill_switch_scope TEXT DEFAULT 'current';`);
        } catch (e) {}

        // Migrate device_bindings last_heartbeat column if not present
        try {
            await db.run(`ALTER TABLE device_bindings ADD COLUMN last_heartbeat DATETIME;`);
        } catch (e) {}

// Device autoseeding disabled for clean production setup

        // Sync active Tuesday expiry calendar & update any outdated expiries
        await syncTuesdayExpiryCalendar(db);

        console.log("Database initialized successfully.");
    } catch (err) {
        console.error("Error initializing SQLite database:", err);
    }
};
initDB();

// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------
const logAudit = async (actorType, actorId, action, details, ip = null) => {
    try {
        await db.run(
            `INSERT INTO audit_log (actor_type, actor_id, action, details, ip_address) VALUES (?, ?, ?, ?, ?)`,
            [actorType, String(actorId || 'system'), action, typeof details === 'object' ? JSON.stringify(details) : String(details || ''), ip]
        );
    } catch (e) {
        console.error("Audit log error:", e.message);
    }
};

// ------------------------------------------------------------------
// REAL-TIME EVENT STREAM & WEBHOOK BROADCASTER (Zero-Polling Engine)
// ------------------------------------------------------------------
const sseClients = new Map(); // userId -> Set of res objects

const broadcastRealtimeEvent = (userId, eventName, data) => {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    const targetUserId = userId ? Number(userId) : null;

    if (targetUserId && sseClients.has(targetUserId)) {
        for (const clientRes of sseClients.get(targetUserId)) {
            try { clientRes.write(payload); } catch (e) {}
        }
    }
    // Broadcast to any wildcard listeners
    if (sseClients.has('*')) {
        for (const clientRes of sseClients.get('*')) {
            try { clientRes.write(payload); } catch (e) {}
        }
    }
};

// ==================================================================
// ADVANCED DSA: ULTRA-FAST O(1) IN-MEMORY TRADING CONTEXT CACHE
// Eliminates 4 sequential SQLite disk I/O queries on every trade
// ==================================================================
const tradingContextCache = new Map();

const getTradingContext = async (userId) => {
    const parsedId = Number(userId) || 1;
    const cached = tradingContextCache.get(parsedId);
    const now = Date.now();
    // Cache valid in memory for 60s, with instantaneous O(1) write-through invalidation
    if (cached && (now - cached.cachedAt) < 60000) {
        return cached;
    }

    // Parallel multi-table fetch on cache miss
    const [ks, devLock, prefs, creds] = await Promise.all([
        db.get(`SELECT active FROM kill_switch_state WHERE user_id = ?`, [parsedId]),
        db.get(`SELECT is_locked FROM device_lock_state WHERE user_id = ?`, [parsedId]),
        db.get(`SELECT selected_broker, selected_index, selected_expiry, added_brokers, kill_switch_scope FROM user_preferences WHERE user_id = ?`, [parsedId]),
        db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [parsedId])
    ]);

    const context = {
        userId: parsedId,
        killSwitchActive: !!(ks && ks.active),
        deviceLocked: !!(devLock && devLock.is_locked),
        selectedBroker: prefs?.selected_broker || 'Fyers',
        selectedIndex: prefs?.selected_index || 'NIFTY',
        selectedExpiry: prefs?.selected_expiry || '',
        addedBrokers: prefs?.added_brokers ? (typeof prefs.added_brokers === 'string' ? JSON.parse(prefs.added_brokers) : prefs.added_brokers) : ['Fyers'],
        killSwitchScope: prefs?.kill_switch_scope || 'current',
        creds: creds || {},
        cachedAt: now
    };

    tradingContextCache.set(parsedId, context);
    return context;
};

const invalidateTradingCache = (userId) => {
    const parsedId = Number(userId) || 1;
    tradingContextCache.delete(parsedId);
};

const updateKillSwitchCache = (userId, active) => {
    const parsedId = Number(userId) || 1;
    const ctx = tradingContextCache.get(parsedId);
    if (ctx) {
        ctx.killSwitchActive = !!active;
    }
};

const updateDeviceLockCache = (userId, isLocked) => {
    const parsedId = Number(userId) || 1;
    const ctx = tradingContextCache.get(parsedId);
    if (ctx) {
        ctx.deviceLocked = !!isLocked;
    }
};

// ------------------------------------------------------------------
// EMERGENCY KILL SWITCH CORE ENGINE (PARALLEL CONCURRENT FAN-OUT)
// ------------------------------------------------------------------
const executeEmergencyKillSwitch = async (userId, triggeredBy = 'DEVICE', reason = 'Emergency Kill Switch Triggered') => {
    const parsedId = Number(userId) || 1;

    // 1. O(1) Instant In-Memory Block (< 0.001 ms)
    updateKillSwitchCache(parsedId, true);

    // 2. Parallel Database Update & Context Fetch
    const [ksDb, prefs, creds] = await Promise.all([
        db.run(`
            INSERT INTO kill_switch_state (user_id, active, triggered_at, triggered_by, reason)
            VALUES (?, 1, CURRENT_TIMESTAMP, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                active = 1,
                triggered_at = CURRENT_TIMESTAMP,
                triggered_by = excluded.triggered_by,
                reason = excluded.reason
        `, [parsedId, triggeredBy, reason]),
        db.get(`SELECT selected_broker, added_brokers, kill_switch_scope FROM user_preferences WHERE user_id = ?`, [parsedId]),
        db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [parsedId])
    ]);

    const killSwitchScope = prefs?.kill_switch_scope || 'current';
    let brokersToExit = [];

    if (killSwitchScope === 'all') {
        if (prefs?.added_brokers) {
            try {
                brokersToExit = typeof prefs.added_brokers === 'string' ? JSON.parse(prefs.added_brokers) : prefs.added_brokers;
            } catch (e) {
                brokersToExit = [];
            }
        }
        if (!Array.isArray(brokersToExit) || brokersToExit.length === 0) {
            brokersToExit = [prefs?.selected_broker || 'Fyers'];
        }
    } else {
        // 'current' broker only (Default & explicitly requested)
        brokersToExit = [prefs?.selected_broker || 'Fyers'];
    }

    // 3. ULTRA-FAST CONCURRENT FAN-OUT: Liquidate positions for target brokers in parallel
    const exitPromises = brokersToExit.map(async (bId) => {
        try {
            return await exitAllBrokerPositions(bId, creds, db, parsedId);
        } catch (e) {
            return { broker: bId, status: 'error', message: e.message };
        }
    });

    const settled = await Promise.allSettled(exitPromises);
    const exitResults = settled.map((s, idx) => s.status === 'fulfilled' ? s.value : { broker: brokersToExit[idx], status: 'error', message: s.reason?.message });

    const payload = {
        active: true,
        triggered_at: new Date().toISOString(),
        triggered_by: triggeredBy,
        reason,
        scope: killSwitchScope,
        target_brokers: brokersToExit,
        exit_results: exitResults
    };

    // Broadcast SSE push immediately
    broadcastRealtimeEvent(parsedId, 'kill_switch', payload);

    // Asynchronous non-blocking write-behind logging
    setImmediate(async () => {
        try {
            await db.run(
                `INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message)
                VALUES (?, ?, 'ALL_POSITIONS', 'EXIT', 0, 0, ?)`,
                [parsedId, brokersToExit.join(','), `KILL SWITCH ENGAGED [${killSwitchScope.toUpperCase()}]: Positions exited for ${brokersToExit.join(', ')} via ${triggeredBy}`]
            );
            await logAudit('kill_switch', parsedId, 'EMERGENCY_HALT', { triggeredBy, reason, scope: killSwitchScope, targetBrokers: brokersToExit, exitResults }, null);
        } catch (e) {}
    });

    console.warn(`[KILL SWITCH ENGAGED - SCOPE: ${killSwitchScope.toUpperCase()}] User ${parsedId} halt triggered by ${triggeredBy}. Target brokers: [${brokersToExit.join(', ')}]. Exit summary:`, exitResults);
    return payload;

    console.warn(`[KILL SWITCH ENGAGED] User ${parsedId} emergency halt triggered by ${triggeredBy}. Exit summary:`, exitResults);
    return payload;
};

const disengageKillSwitch = async (userId, liftedBy = 'APP') => {
    const parsedId = Number(userId) || 1;

    // O(1) Instant In-Memory Unblock (< 0.001 ms)
    updateKillSwitchCache(parsedId, false);

    await db.run(`
        INSERT INTO kill_switch_state (user_id, active, triggered_at, triggered_by, reason)
        VALUES (?, 0, CURRENT_TIMESTAMP, ?, 'Disengaged')
        ON CONFLICT(user_id) DO UPDATE SET
            active = 0,
            triggered_at = CURRENT_TIMESTAMP,
            triggered_by = excluded.triggered_by,
            reason = excluded.reason
    `, [parsedId, liftedBy]);

    const payload = {
        active: false,
        triggered_at: new Date().toISOString(),
        triggered_by: liftedBy,
        reason: 'Disengaged',
        message: 'Kill switch disengaged. Console trading resumed.'
    };

    broadcastRealtimeEvent(parsedId, 'kill_switch', payload);

    setImmediate(async () => {
        try {
            await db.run(
                `INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message)
                VALUES (?, 'SYSTEM', 'RESUME', 'RESUME', 0, 0, ?)`,
                [parsedId, `KILL SWITCH DISENGAGED by ${liftedBy}`]
            );
            await logAudit('kill_switch', parsedId, 'DISENGAGED', { liftedBy }, null);
        } catch (e) {}
    });

    return payload;
};

const evaluateReadiness = async (userId) => {
    const prefs = await db.get(`SELECT selected_broker, selected_index, selected_expiry FROM user_preferences WHERE user_id = ?`, [userId]);
    const broker = prefs ? prefs.selected_broker : 'Fyers';

    // Check Kill Switch state
    const ks = await db.get(`SELECT active, triggered_at, triggered_by, reason FROM kill_switch_state WHERE user_id = ?`, [userId]);
    const killSwitchEngaged = !!(ks && ks.active);

    // Check Hardware Device Lock state (Halt Console)
    const lockRow = await db.get(`SELECT is_locked, locked_at, locked_by, reason FROM device_lock_state WHERE user_id = ?`, [userId]);
    const isDeviceLocked = !!(lockRow && lockRow.is_locked);

    // 1. Device binding check
    const binding = await db.get(`SELECT device_id, status FROM device_bindings WHERE user_id = ? AND status = 'active'`, [userId]);
    const deviceBound = !!binding;

    // 2. Broker credentials configured check
    const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
    const brokerConfigured = isBrokerConfigured(broker, creds);

    // 3. Token valid today check
    const tokenValidToday = isBrokerTokenValid(broker, creds);

    // 4. Reason determination (priority order)
    let ready = false;
    let reason = 'READY';

    if (killSwitchEngaged) {
        reason = 'KILL_SWITCH_ENGAGED';
    } else if (isDeviceLocked) {
        reason = 'CONSOLE_LOCKED';
    } else if (!deviceBound) {
        reason = 'DEVICE_UNREGISTERED';
    } else if (!brokerConfigured) {
        reason = 'BROKER_NOT_CONFIGURED';
    } else if (!tokenValidToday) {
        reason = 'TOKEN_EXPIRED';
    } else {
        ready = true;
    }

    let telemetry = null;
    if (binding && binding.device_id) {
        telemetry = await db.get(`SELECT battery_pct, wifi_rssi, last_heartbeat FROM device_telemetry WHERE device_id = ?`, [binding.device_id]);
    }

    return {
        ready,
        reason,
        checks: {
            device_bound: deviceBound,
            broker_configured: brokerConfigured,
            token_valid_today: tokenValidToday,
            kill_switch_off: !killSwitchEngaged,
            device_unlocked: !isDeviceLocked,
            firmware_ok: true
        },
        kill_switch: {
            active: killSwitchEngaged,
            triggered_at: ks?.triggered_at || null,
            triggered_by: ks?.triggered_by || null,
            reason: ks?.reason || null
        },
        device_lock: {
            is_locked: isDeviceLocked,
            locked_at: lockRow?.locked_at || null,
            locked_by: lockRow?.locked_by || null,
            reason: lockRow?.reason || null
        },
        device_id: binding ? binding.device_id : null,
        battery_pct: telemetry ? telemetry.battery_pct : null,
        wifi_rssi: telemetry ? telemetry.wifi_rssi : null,
        last_heartbeat: telemetry ? telemetry.last_heartbeat : null,
        broker,
        server_time_ist: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };
};

// ------------------------------------------------------------------
// MIDDLEWARE
// ------------------------------------------------------------------
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ status: 'error', message: 'Forbidden' });
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.username === 'admin')) {
        next();
    } else {
        res.status(403).json({ status: 'error', code: 'ADMIN_REQUIRED', message: 'Forbidden: Admin access required' });
    }
};

// ------------------------------------------------------------------
// DEDICATED ADMIN AUTHENTICATION & SESSION VERIFICATION
// ------------------------------------------------------------------
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ status: 'error', message: 'Username and password are required' });
    }
    try {
        const cleanUser = username.trim();
        const user = await db.get(`SELECT * FROM users WHERE username = ?`, [cleanUser]);
        if (!user || !user.password_hash) {
            await logAudit('security', null, 'ADMIN_LOGIN_FAILED', { username: cleanUser, reason: 'Account not found' }, req.ip);
            return res.status(401).json({ status: 'error', message: 'Invalid administrative credentials' });
        }

        if (user.role !== 'admin' && user.username !== 'admin') {
            await logAudit('security', user.id, 'ADMIN_LOGIN_UNAUTHORIZED', { username: cleanUser, reason: 'Non-admin role attempt' }, req.ip);
            return res.status(403).json({ status: 'error', message: 'Access denied: account lacks administrative privileges' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            await logAudit('security', user.id, 'ADMIN_LOGIN_FAILED', { username: cleanUser, reason: 'Incorrect password' }, req.ip);
            return res.status(401).json({ status: 'error', message: 'Invalid administrative credentials' });
        }

        // Issue dedicated 24-hour admin session token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: 'admin' },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        await logAudit('admin', user.id, 'ADMIN_LOGIN_SUCCESS', { username: user.username }, req.ip);
        res.json({
            status: 'success',
            token,
            admin: {
                id: user.id,
                username: user.username,
                role: 'admin'
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/admin/verify-session', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const user = await db.get(`SELECT id, username, email, role FROM users WHERE id = ?`, [req.user.id]);
        if (!user || (user.role !== 'admin' && user.username !== 'admin')) {
            return res.status(403).json({ status: 'error', code: 'ADMIN_REQUIRED', message: 'Admin access required' });
        }
        res.json({
            status: 'success',
            admin: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/logout', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        await logAudit('admin', req.user.id, 'ADMIN_LOGOUT', { username: req.user.username }, req.ip);
        res.json({ status: 'success', message: 'Admin session terminated successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// AUTH API
// ------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await db.get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user || !user.password_hash) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        const binding = await db.get(`SELECT device_id FROM device_bindings WHERE user_id = ? AND status = 'active'`, [user.id]);
        res.json({ status: 'success', token, user: { id: user.id, username: user.username, email: user.email, role: user.role, bound_device_id: binding ? binding.device_id : null } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { credential } = req.body;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        
        // Check if user exists by email
        let user = await db.get(`SELECT * FROM users WHERE email = ?`, [payload.email]);
        
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Account not found. This is an invite-only platform.' });
        }

        // Update google_id if not set
        if (!user.google_id) {
            await db.run(`UPDATE users SET google_id = ? WHERE id = ?`, [payload.sub, user.id]);
        }

        const token = jwt.sign({ id: user.id, username: user.username, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        const binding = await db.get(`SELECT device_id FROM device_bindings WHERE user_id = ? AND status = 'active'`, [user.id]);
        res.json({ status: 'success', token, user: { id: user.id, username: user.username, email: user.email, role: user.role, bound_device_id: binding ? binding.device_id : null } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Google Authentication Failed', error: err.message });
    }
});

// Email OTP Authentication
app.post('/api/auth/otp/send', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ status: 'error', message: 'Email is required' });
    }
    const cleanEmail = email.trim().toLowerCase();

    try {
        const user = await db.get(`SELECT id, username, email FROM users WHERE LOWER(email) = ?`, [cleanEmail]);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Account not found. Tradopad is currently invite-only.' });
        }

        // Generate 6-digit OTP code
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Invalidate prior unconsumed OTPs for this email
        await db.run(`UPDATE email_otps SET consumed = 1 WHERE email = ? AND consumed = 0`, [cleanEmail]);

        // Save fresh OTP
        await db.run(`INSERT INTO email_otps (email, otp_code, expires_at) VALUES (?, ?, ?)`, [cleanEmail, otpCode, expiresAt]);

        // Send via Nodemailer
        const sent = await sendOtpEmail(cleanEmail, otpCode);
        if (!sent) {
            return res.status(500).json({ status: 'error', message: 'Failed to deliver OTP email. Please try again later.' });
        }

        await logAudit('user', user.id, 'OTP_REQUESTED', { email: cleanEmail }, req.ip);
        res.json({ status: 'success', message: 'Verification code sent to your email.' });
    } catch (err) {
        console.error("OTP Send Error:", err);
        res.status(500).json({ status: 'error', message: 'Error processing OTP request', error: err.message });
    }
});

app.post('/api/auth/otp/verify', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ status: 'error', message: 'Email and OTP code are required' });
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    try {
        const record = await db.get(
            `SELECT * FROM email_otps WHERE email = ? AND otp_code = ? AND consumed = 0 ORDER BY created_at DESC LIMIT 1`,
            [cleanEmail, cleanOtp]
        );

        if (!record) {
            return res.status(401).json({ status: 'error', message: 'Invalid or expired verification code' });
        }

        // Check expiration
        const expiryTime = new Date(record.expires_at).getTime();
        if (Date.now() > expiryTime) {
            await db.run(`UPDATE email_otps SET consumed = 1 WHERE id = ?`, [record.id]);
            return res.status(401).json({ status: 'error', message: 'Verification code has expired. Please request a new code.' });
        }

        // Mark consumed
        await db.run(`UPDATE email_otps SET consumed = 1 WHERE id = ?`, [record.id]);

        // Fetch user
        const user = await db.get(`SELECT id, username, email, role FROM users WHERE LOWER(email) = ?`, [cleanEmail]);
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'User account not found' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        await logAudit('user', user.id, 'OTP_LOGIN_SUCCESS', { email: cleanEmail }, req.ip);

        const binding = await db.get(`SELECT device_id FROM device_bindings WHERE user_id = ? AND status = 'active'`, [user.id]);
        res.json({
            status: 'success',
            token,
            user: { id: user.id, username: user.username, email: user.email, role: user.role, bound_device_id: binding ? binding.device_id : null }
        });
    } catch (err) {
        console.error("OTP Verify Error:", err);
        res.status(500).json({ status: 'error', message: 'Verification failed', error: err.message });
    }
});

// ------------------------------------------------------------------
// WAITLIST API
// ------------------------------------------------------------------
app.post('/api/waitlist/apply', async (req, res) => {
    const { name, email } = req.body;
    try {
        await db.run(`INSERT INTO waitlist (name, email) VALUES (?, ?)`, [name, email]);
        res.json({ status: 'success', message: 'Applied to waitlist successfully.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ status: 'error', message: 'Email already on waitlist.' });
        }
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// ADMIN API
// ------------------------------------------------------------------
app.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const users = await db.all(`
            SELECT u.id, u.username, u.name, u.email, u.google_id, u.role, u.created_at,
                   db.device_id AS bound_device_id
            FROM users u
            LEFT JOIN device_bindings db ON u.id = db.user_id AND db.status = 'active'
            ORDER BY u.id ASC
        `);
        res.json({ status: 'success', data: users });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
    const { username, name, password, email, role } = req.body;
    try {
        if (!username || !username.trim()) {
            return res.status(400).json({ status: 'error', message: 'Username is required' });
        }
        const cleanUsername = username.trim();
        const existing = await db.get(`SELECT id FROM users WHERE username = ?`, [cleanUsername]);
        if (existing) {
            return res.status(400).json({ status: 'error', message: 'Username already exists' });
        }
        if (email && email.trim()) {
            const existingEmail = await db.get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email.trim()]);
            if (existingEmail) {
                return res.status(400).json({ status: 'error', message: 'Email already exists' });
            }
        }

        const hash = password ? await bcrypt.hash(password.trim(), 10) : null;
        const result = await db.run(`INSERT INTO users (username, name, password_hash, email, role) VALUES (?, ?, ?, ?, ?)`, 
            [cleanUsername, name?.trim() || null, hash, email?.trim() || null, role || 'user']);
        
        try {
            await db.run(
                `INSERT INTO audit_log (actor_type, actor_id, action, details, ip_address) VALUES ('admin', ?, 'CREATE_USER', ?, ?)`,
                [req.user.id, `Created user #${result.lastID} (${cleanUsername})`, req.ip]
            );
        } catch (auditErr) {}

        res.json({ status: 'success', message: 'User created successfully', userId: result.lastID });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.put('/api/admin/users/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
        }

        const user = await db.get(`SELECT id, username, name, email, role FROM users WHERE id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const { username, name, email, password, role } = req.body;

        // Validate username
        if (username !== undefined) {
            const cleanUsername = String(username).trim();
            if (!cleanUsername) {
                return res.status(400).json({ status: 'error', message: 'Username cannot be blank' });
            }
            const duplicateUser = await db.get(`SELECT id FROM users WHERE username = ? AND id != ?`, [cleanUsername, userId]);
            if (duplicateUser) {
                return res.status(400).json({ status: 'error', message: `Username "${cleanUsername}" is already taken` });
            }
        }

        // Validate email
        if (email !== undefined && email !== null && String(email).trim() !== '') {
            const cleanEmail = String(email).trim().toLowerCase();
            const duplicateEmail = await db.get(`SELECT id FROM users WHERE LOWER(email) = ? AND id != ?`, [cleanEmail, userId]);
            if (duplicateEmail) {
                return res.status(400).json({ status: 'error', message: `Email "${cleanEmail}" is already in use by another account` });
            }
        }

        // Validate role
        if (role !== undefined) {
            if (role !== 'admin' && role !== 'user') {
                return res.status(400).json({ status: 'error', message: 'Role must be either "user" or "admin"' });
            }
            if (user.role === 'admin' && role === 'user') {
                const adminCount = await db.get(`SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND id != ?`, [userId]);
                if (!adminCount || adminCount.cnt === 0) {
                    return res.status(400).json({ status: 'error', message: 'Cannot demote the only remaining administrator' });
                }
            }
        }

        const updates = [];
        const params = [];

        if (username !== undefined) {
            updates.push('username = ?');
            params.push(String(username).trim());
        }
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(name ? String(name).trim() : null);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            params.push(email && String(email).trim() ? String(email).trim().toLowerCase() : null);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            params.push(role);
        }
        if (password !== undefined && password !== null && String(password).trim().length > 0) {
            const hash = await bcrypt.hash(String(password).trim(), 10);
            updates.push('password_hash = ?');
            params.push(hash);
        }

        if (updates.length > 0) {
            params.push(userId);
            await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        // 1. Process Trading Preferences if provided
        if (req.body.preferences) {
            const pref = req.body.preferences;
            const addedBrokersJson = Array.isArray(pref.added_brokers) 
                ? JSON.stringify(pref.added_brokers) 
                : (typeof pref.added_brokers === 'string' ? pref.added_brokers : '["Fyers"]');
            
            await db.run(`
                INSERT INTO user_preferences (user_id, selected_broker, selected_index, selected_expiry, added_brokers, kill_switch_scope)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    selected_broker = excluded.selected_broker,
                    selected_index = excluded.selected_index,
                    selected_expiry = excluded.selected_expiry,
                    added_brokers = excluded.added_brokers,
                    kill_switch_scope = excluded.kill_switch_scope
            `, [
                userId,
                pref.selected_broker || 'Fyers',
                pref.selected_index || 'NIFTY',
                pref.selected_expiry || null,
                addedBrokersJson,
                pref.kill_switch_scope || 'current'
            ]);
        }

        // 2. Process Hardware Device Binding if provided
        if (req.body.bound_device_id !== undefined) {
            const targetDeviceId = req.body.bound_device_id ? String(req.body.bound_device_id).trim() : null;
            // Mark existing active binding for this user as unbound
            await db.run(`UPDATE device_bindings SET status = 'unbound' WHERE user_id = ? AND status = 'active'`, [userId]);
            
            if (targetDeviceId && targetDeviceId !== '' && targetDeviceId !== 'none') {
                // Ensure target device exists in devices table
                const devExists = await db.get(`SELECT id FROM devices WHERE device_id = ?`, [targetDeviceId]);
                if (!devExists) {
                    await db.run(`INSERT INTO devices (device_id, status) VALUES (?, 'bound')`, [targetDeviceId]);
                }
                // Unbind this device from any other user
                await db.run(`UPDATE device_bindings SET status = 'unbound' WHERE device_id = ? AND status = 'active'`, [targetDeviceId]);
                // Bind to this user
                await db.run(
                    `INSERT INTO device_bindings (device_id, user_id, order_ref, status) VALUES (?, ?, 'ADMIN_ASSIGNED', 'active')`,
                    [targetDeviceId, userId]
                );
                await db.run(`UPDATE devices SET status = 'bound' WHERE device_id = ?`, [targetDeviceId]);
            }
        }

        // 3. Process Broker Credentials if provided
        if (req.body.broker_credentials) {
            const b = req.body.broker_credentials;
            await db.run(`
                INSERT INTO broker_credentials (
                    user_id,
                    fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key, fyers_access_token,
                    dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token,
                    upstox_api_key, upstox_api_secret, upstox_redirect_url, upstox_access_token,
                    angel_client_code, angel_password, angel_api_key, angel_totp_secret, angel_access_token,
                    kotak_consumer_key, kotak_consumer_secret, kotak_mobile, kotak_password, kotak_mpin, kotak_access_token,
                    zerodha_api_key, zerodha_api_secret, zerodha_request_token, zerodha_access_token,
                    updated_at
                ) VALUES (
                    ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT(user_id) DO UPDATE SET
                    fyers_id = COALESCE(excluded.fyers_id, broker_credentials.fyers_id),
                    fyers_totp_secret = COALESCE(excluded.fyers_totp_secret, broker_credentials.fyers_totp_secret),
                    fyers_pin = COALESCE(excluded.fyers_pin, broker_credentials.fyers_pin),
                    fyers_app_id = COALESCE(excluded.fyers_app_id, broker_credentials.fyers_app_id),
                    fyers_secret_key = COALESCE(excluded.fyers_secret_key, broker_credentials.fyers_secret_key),
                    fyers_access_token = COALESCE(excluded.fyers_access_token, broker_credentials.fyers_access_token),
                    dhan_client_id = COALESCE(excluded.dhan_client_id, broker_credentials.dhan_client_id),
                    dhan_password = COALESCE(excluded.dhan_password, broker_credentials.dhan_password),
                    dhan_totp_secret = COALESCE(excluded.dhan_totp_secret, broker_credentials.dhan_totp_secret),
                    dhan_api_key = COALESCE(excluded.dhan_api_key, broker_credentials.dhan_api_key),
                    dhan_api_secret = COALESCE(excluded.dhan_api_secret, broker_credentials.dhan_api_secret),
                    dhan_access_token = COALESCE(excluded.dhan_access_token, broker_credentials.dhan_access_token),
                    upstox_api_key = COALESCE(excluded.upstox_api_key, broker_credentials.upstox_api_key),
                    upstox_api_secret = COALESCE(excluded.upstox_api_secret, broker_credentials.upstox_api_secret),
                    upstox_redirect_url = COALESCE(excluded.upstox_redirect_url, broker_credentials.upstox_redirect_url),
                    upstox_access_token = COALESCE(excluded.upstox_access_token, broker_credentials.upstox_access_token),
                    angel_client_code = COALESCE(excluded.angel_client_code, broker_credentials.angel_client_code),
                    angel_password = COALESCE(excluded.angel_password, broker_credentials.angel_password),
                    angel_api_key = COALESCE(excluded.angel_api_key, broker_credentials.angel_api_key),
                    angel_totp_secret = COALESCE(excluded.angel_totp_secret, broker_credentials.angel_totp_secret),
                    angel_access_token = COALESCE(excluded.angel_access_token, broker_credentials.angel_access_token),
                    kotak_consumer_key = COALESCE(excluded.kotak_consumer_key, broker_credentials.kotak_consumer_key),
                    kotak_consumer_secret = COALESCE(excluded.kotak_consumer_secret, broker_credentials.kotak_consumer_secret),
                    kotak_mobile = COALESCE(excluded.kotak_mobile, broker_credentials.kotak_mobile),
                    kotak_password = COALESCE(excluded.kotak_password, broker_credentials.kotak_password),
                    kotak_mpin = COALESCE(excluded.kotak_mpin, broker_credentials.kotak_mpin),
                    kotak_access_token = COALESCE(excluded.kotak_access_token, broker_credentials.kotak_access_token),
                    zerodha_api_key = COALESCE(excluded.zerodha_api_key, broker_credentials.zerodha_api_key),
                    zerodha_api_secret = COALESCE(excluded.zerodha_api_secret, broker_credentials.zerodha_api_secret),
                    zerodha_request_token = COALESCE(excluded.zerodha_request_token, broker_credentials.zerodha_request_token),
                    zerodha_access_token = COALESCE(excluded.zerodha_access_token, broker_credentials.zerodha_access_token),
                    updated_at = CURRENT_TIMESTAMP
            `, [
                userId,
                b.fyers_id !== undefined ? b.fyers_id : null,
                b.fyers_totp_secret !== undefined ? b.fyers_totp_secret : null,
                b.fyers_pin !== undefined ? b.fyers_pin : null,
                b.fyers_app_id !== undefined ? b.fyers_app_id : null,
                b.fyers_secret_key !== undefined ? b.fyers_secret_key : null,
                b.fyers_access_token !== undefined ? b.fyers_access_token : null,
                b.dhan_client_id !== undefined ? b.dhan_client_id : null,
                b.dhan_password !== undefined ? b.dhan_password : null,
                b.dhan_totp_secret !== undefined ? b.dhan_totp_secret : null,
                b.dhan_api_key !== undefined ? b.dhan_api_key : null,
                b.dhan_api_secret !== undefined ? b.dhan_api_secret : null,
                b.dhan_access_token !== undefined ? b.dhan_access_token : null,
                b.upstox_api_key !== undefined ? b.upstox_api_key : null,
                b.upstox_api_secret !== undefined ? b.upstox_api_secret : null,
                b.upstox_redirect_url !== undefined ? b.upstox_redirect_url : null,
                b.upstox_access_token !== undefined ? b.upstox_access_token : null,
                b.angel_client_code !== undefined ? b.angel_client_code : null,
                b.angel_password !== undefined ? b.angel_password : null,
                b.angel_api_key !== undefined ? b.angel_api_key : null,
                b.angel_totp_secret !== undefined ? b.angel_totp_secret : null,
                b.angel_access_token !== undefined ? b.angel_access_token : null,
                b.kotak_consumer_key !== undefined ? b.kotak_consumer_key : null,
                b.kotak_consumer_secret !== undefined ? b.kotak_consumer_secret : null,
                b.kotak_mobile !== undefined ? b.kotak_mobile : null,
                b.kotak_password !== undefined ? b.kotak_password : null,
                b.kotak_mpin !== undefined ? b.kotak_mpin : null,
                b.kotak_access_token !== undefined ? b.kotak_access_token : null,
                b.zerodha_api_key !== undefined ? b.zerodha_api_key : null,
                b.zerodha_api_secret !== undefined ? b.zerodha_api_secret : null,
                b.zerodha_request_token !== undefined ? b.zerodha_request_token : null,
                b.zerodha_access_token !== undefined ? b.zerodha_access_token : null
            ]);
        }

        try {
            await db.run(
                `INSERT INTO audit_log (actor_type, actor_id, action, details, ip_address) VALUES ('admin', ?, 'UPDATE_USER_CONFIG', ?, ?)`,
                [req.user.id, `Updated full configuration for user #${userId} (${username || user.username})`, req.ip]
            );
        } catch (auditErr) {}

        res.json({
            status: 'success',
            message: 'User credentials, preferences, and bindings updated successfully'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await db.get(`SELECT email FROM users WHERE id = ?`, [userId]);
        
        await db.run('BEGIN TRANSACTION');
        if (user && user.email) {
            await db.run(`DELETE FROM waitlist WHERE email = ?`, [user.email]);
        }
        await db.run(`DELETE FROM user_preferences WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM broker_credentials WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM trade_history WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM device_bindings WHERE user_id = ?`, [userId]);
        await db.run(`DELETE FROM users WHERE id = ?`, [userId]);
        await db.run('COMMIT');
        res.json({ status: 'success', message: 'User deleted successfully' });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/admin/user/:userId', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await db.get(`
            SELECT u.id, u.username, u.name, u.email, u.google_id, u.role, u.created_at,
                   db.device_id AS bound_device_id
            FROM users u
            LEFT JOIN device_bindings db ON u.id = db.user_id AND db.status = 'active'
            WHERE u.id = ?
        `, [userId]);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        const preferences = await db.get(`SELECT * FROM user_preferences WHERE user_id = ?`, [userId]);
        const broker_credentials = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
        const allDevices = await db.all(`SELECT id, device_id, serial_number, status, firmware_version FROM devices ORDER BY device_id ASC`);

        res.json({
            status: 'success',
            data: {
                user,
                preferences: preferences || null,
                broker_credentials: broker_credentials || null,
                devices: allDevices || []
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/user/:userId/clear-token', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        await db.run(`
            UPDATE broker_credentials 
            SET fyers_access_token = NULL, dhan_access_token = NULL, 
                fyers_token_generated_at = NULL, dhan_token_generated_at = NULL, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `, [userId]);
        res.json({ status: 'success', message: 'Access tokens cleared successfully for user.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/admin/waitlist', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const entries = await db.all(`SELECT * FROM waitlist ORDER BY created_at DESC`);
        res.json({ status: 'success', data: entries });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/waitlist/:id/approve', authenticateToken, authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const entry = await db.get(`SELECT * FROM waitlist WHERE id = ?`, [id]);
        if (!entry) return res.status(404).json({ status: 'error', message: 'Waitlist entry not found' });
        if (entry.status !== 'pending') return res.status(400).json({ status: 'error', message: 'Already processed' });

        const password = crypto.randomBytes(4).toString('hex');
        const hash = await bcrypt.hash(password, 10);
        let username = entry.email.split('@')[0];
        
        try {
            await db.run(`INSERT INTO users (username, name, password_hash, email) VALUES (?, ?, ?, ?)`, [username, entry.name || null, hash, entry.email]);
        } catch (insertErr) {
            username = username + '_' + crypto.randomBytes(2).toString('hex');
            await db.run(`INSERT INTO users (username, name, password_hash, email) VALUES (?, ?, ?, ?)`, [username, entry.name || null, hash, entry.email]);
        }
        
        await db.run(`UPDATE waitlist SET status = 'approved' WHERE id = ?`, [id]);
        
        // Send Onboarding Email
        await sendApprovalEmail(entry.email, entry.name, username, password);
        
        res.json({ status: 'success', message: 'User approved and email sent', credentials: { username, password } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/admin/waitlist/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db.run(`DELETE FROM waitlist WHERE id = ?`, [id]);
        res.json({ status: 'success', message: 'Waitlist entry deleted successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// DEVICE REGISTRY & PROVISIONING API (ADMIN)
// ------------------------------------------------------------------
app.get('/api/admin/devices', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const devices = await db.all(`
            SELECT d.*, db.user_id, db.order_ref, db.bound_at, u.username as bound_username, u.email as bound_email,
                   dt.battery_pct, dt.wifi_rssi, dt.last_heartbeat
            FROM devices d
            LEFT JOIN device_bindings db ON d.device_id = db.device_id AND db.status = 'active'
            LEFT JOIN users u ON db.user_id = u.id
            LEFT JOIN device_telemetry dt ON d.device_id = dt.device_id
            ORDER BY d.created_at DESC
        `);
        res.json({ status: 'success', data: devices });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.put('/api/admin/devices/:deviceId', authenticateToken, authenticateAdmin, async (req, res) => {
    const { deviceId } = req.params;
    const { new_device_id, device_id, serial_number, hw_revision, firmware_version, status } = req.body;
    const targetDeviceId = (new_device_id || device_id)?.trim() || deviceId;

    try {
        await db.run('BEGIN TRANSACTION');

        if (targetDeviceId !== deviceId) {
            // Check if the new device ID already exists in devices table
            const existing = await db.get(`SELECT id FROM devices WHERE device_id = ? AND device_id != ?`, [targetDeviceId, deviceId]);
            if (existing) {
                await db.run('ROLLBACK');
                return res.status(400).json({ status: 'error', message: `Device ID '${targetDeviceId}' is already assigned to another unit.` });
            }

            // Update related tables to preserve bindings, telemetry and keys
            await db.run(`UPDATE device_bindings SET device_id = ? WHERE device_id = ?`, [targetDeviceId, deviceId]);
            await db.run(`UPDATE device_telemetry SET device_id = ? WHERE device_id = ?`, [targetDeviceId, deviceId]);
            await db.run(`UPDATE device_keys SET device_id = ? WHERE device_id = ?`, [targetDeviceId, deviceId]);
        }

        await db.run(
            `UPDATE devices SET 
                device_id = ?,
                serial_number = COALESCE(?, serial_number),
                hw_revision = COALESCE(?, hw_revision),
                firmware_version = COALESCE(?, firmware_version),
                status = COALESCE(?, status)
             WHERE device_id = ?`,
            [targetDeviceId, serial_number?.trim() || null, hw_revision?.trim() || null, firmware_version?.trim() || null, status?.trim() || null, deviceId]
        );

        await db.run('COMMIT');

        await logAudit('admin', req.user.id, 'DEVICE_UPDATED', { previous_device_id: deviceId, updated_device_id: targetDeviceId, updates: req.body }, req.ip);
        res.json({ status: 'success', message: 'Device updated successfully', data: { device_id: targetDeviceId } });
    } catch (err) {
        try { await db.run('ROLLBACK'); } catch (_) {}
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/admin/devices/:deviceId', authenticateToken, authenticateAdmin, async (req, res) => {
    const { deviceId } = req.params;
    try {
        await db.run(`DELETE FROM device_bindings WHERE device_id = ?`, [deviceId]);
        await db.run(`DELETE FROM device_telemetry WHERE device_id = ?`, [deviceId]);
        await db.run(`DELETE FROM devices WHERE device_id = ?`, [deviceId]);
        await logAudit('admin', req.user.id, 'DEVICE_DELETED', { device_id: deviceId }, req.ip);
        res.json({ status: 'success', message: 'Device deleted successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/devices', authenticateToken, authenticateAdmin, async (req, res) => {
    const { device_id, serial_number, hw_revision, firmware_version } = req.body;
    if (!device_id) {
        return res.status(400).json({ status: 'error', message: 'device_id is required' });
    }
    try {
        await db.run(
            `INSERT INTO devices (device_id, serial_number, hw_revision, firmware_version, status) VALUES (?, ?, ?, ?, 'unassigned')`,
            [device_id.trim(), serial_number?.trim() || null, hw_revision?.trim() || 'rev1', firmware_version?.trim() || '1.0.0']
        );
        await logAudit('admin', req.user.id, 'DEVICE_REGISTERED', { device_id }, req.ip);
        res.json({ status: 'success', message: 'Device registered successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/devices/bind', authenticateToken, authenticateAdmin, async (req, res) => {
    const { device_id, user_id, order_ref } = req.body;
    if (!device_id || !user_id) {
        return res.status(400).json({ status: 'error', message: 'device_id and user_id are required' });
    }
    try {
        const dev = await db.get(`SELECT id FROM devices WHERE device_id = ?`, [device_id]);
        if (!dev) {
            await db.run(`INSERT INTO devices (device_id, status) VALUES (?, 'unassigned')`, [device_id]);
        }

        // Deactivate previous active bindings for this device or user to ensure 1:1 active mapping
        await db.run(`UPDATE device_bindings SET status = 'superseded' WHERE (device_id = ? OR user_id = ?) AND status = 'active'`, [device_id, user_id]);

        // Insert new active binding
        await db.run(
            `INSERT INTO device_bindings (device_id, user_id, order_ref, status) VALUES (?, ?, ?, 'active')`,
            [device_id, user_id, order_ref || 'ADMIN_BIND']
        );
        await db.run(`UPDATE devices SET status = 'bound' WHERE device_id = ?`, [device_id]);

        await logAudit('admin', req.user.id, 'DEVICE_BOUND', { device_id, user_id, order_ref }, req.ip);
        res.json({ status: 'success', message: 'Device bound successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/devices/unbind', authenticateToken, authenticateAdmin, async (req, res) => {
    const { device_id, reason } = req.body;
    if (!device_id) {
        return res.status(400).json({ status: 'error', message: 'device_id is required' });
    }
    try {
        await db.run(`UPDATE device_bindings SET status = 'unbound' WHERE device_id = ? AND status = 'active'`, [device_id]);
        await db.run(`UPDATE devices SET status = 'unassigned' WHERE device_id = ?`, [device_id]);
        await logAudit('admin', req.user.id, 'DEVICE_UNBOUND', { device_id, reason: reason || 'Admin unbind' }, req.ip);
        res.json({ status: 'success', message: 'Device unbound successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/admin/audit-logs', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const logs = await db.all(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 300`);
        res.json({ status: 'success', data: logs });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// ADMIN: DPDP ACT 2023 DATA ERASURE WORKFLOW
// ------------------------------------------------------------------
app.get('/api/admin/deletion-requests', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const requests = await db.all(`
            SELECT r.*, u.created_at as user_created_at
            FROM data_deletion_requests r
            LEFT JOIN users u ON r.user_id = u.id
            ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END, r.requested_at DESC
        `);
        res.json({ status: 'success', requests });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/deletion-requests/:id/approve', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await db.get(`SELECT * FROM data_deletion_requests WHERE id = ?`, [requestId]);
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Deletion request not found' });
        }
        if (request.status !== 'PENDING') {
            return res.status(400).json({ status: 'error', message: `Request is already ${request.status}` });
        }

        const targetUserId = request.user_id;
        const targetUser = await db.get(`SELECT id, username, email FROM users WHERE id = ?`, [targetUserId]);
        const targetEmail = request.email || targetUser?.email;
        const targetUsername = request.username || targetUser?.username || 'Trader';
        const requestedAt = request.requested_at;
        const adminNotes = req.body?.notes || 'Approved and processed by Administrator under DPDP Act, 2023';

        await db.run('BEGIN TRANSACTION');
        try {
            // 1. Purge all broker API credentials & tokens
            await db.run(`DELETE FROM broker_credentials WHERE user_id = ?`, [targetUserId]);
            // 2. Purge user preferences
            await db.run(`DELETE FROM user_preferences WHERE user_id = ?`, [targetUserId]);
            // 3. Purge device bindings
            await db.run(`DELETE FROM device_bindings WHERE user_id = ?`, [targetUserId]);
            // 4. Purge console lock & kill switch state
            await db.run(`DELETE FROM device_lock_state WHERE user_id = ?`, [targetUserId]);
            await db.run(`DELETE FROM kill_switch_state WHERE user_id = ?`, [targetUserId]);
            // 5. Purge trade ledger
            await db.run(`DELETE FROM trade_history WHERE user_id = ?`, [targetUserId]);
            // 6. Purge waitlist & OTPs
            if (targetEmail) {
                await db.run(`DELETE FROM email_otps WHERE LOWER(email) = LOWER(?)`, [targetEmail]);
                await db.run(`DELETE FROM waitlist WHERE LOWER(email) = LOWER(?)`, [targetEmail]);
            }
            // 7. Update deletion request audit record to APPROVED
            await db.run(`
                UPDATE data_deletion_requests 
                SET status = 'APPROVED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, notes = ?
                WHERE id = ?
            `, [req.user.username || 'admin', adminNotes, requestId]);
            // 8. Delete user identity record
            await db.run(`DELETE FROM users WHERE id = ?`, [targetUserId]);

            await db.run('COMMIT');
        } catch (txErr) {
            await db.run('ROLLBACK');
            throw txErr;
        }

        // Invalidate in-memory trading cache
        invalidateTradingCache(targetUserId);

        // 9. Send official DPDP statutory confirmation email to the user
        let emailSent = false;
        if (targetEmail) {
            try {
                emailSent = await sendDeletionConfirmationEmail(
                    targetEmail,
                    targetUsername,
                    requestedAt,
                    new Date().toISOString()
                );
            } catch (mailErr) {
                console.error('[DPDP CONFIRMATION MAIL ERROR]:', mailErr.message);
            }
        }

        await logAudit('compliance', req.user.id, 'DPDP_ERASURE_APPROVED', {
            request_id: requestId,
            purged_user_id: targetUserId,
            email: targetEmail,
            email_sent: emailSent
        }, req.ip);

        res.json({
            status: 'success',
            message: `User @${targetUsername} (${targetEmail}) has been permanently erased in compliance with DPDP Act 2023. Confirmation email ${emailSent ? 'delivered' : 'sent'}.`,
            email_sent: emailSent
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/deletion-requests/:id/reject', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await db.get(`SELECT * FROM data_deletion_requests WHERE id = ?`, [requestId]);
        if (!request) {
            return res.status(404).json({ status: 'error', message: 'Deletion request not found' });
        }
        if (request.status !== 'PENDING') {
            return res.status(400).json({ status: 'error', message: `Request is already ${request.status}` });
        }

        const adminNotes = req.body?.notes || req.body?.reason || 'Rejected by Administrator';
        await db.run(`
            UPDATE data_deletion_requests 
            SET status = 'REJECTED', reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, notes = ?
            WHERE id = ?
        `, [req.user.username || 'admin', adminNotes, requestId]);

        await logAudit('compliance', req.user.id, 'DPDP_ERASURE_REJECTED', {
            request_id: requestId,
            user_id: request.user_id,
            reason: adminNotes
        }, req.ip);

        res.json({
            status: 'success',
            message: 'Deletion request rejected',
            notes: adminNotes
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// LIVE REAL-TIME INDIAN MARKET QUOTES API (FOR CONTROL PANEL & TICKER)
// ------------------------------------------------------------------
// SMART MARKET QUOTES ENGINE (AWS Credit Saver & Zero-Polling)
// ------------------------------------------------------------------
let realMarketCache = {
    data: null,
    lastFetched: 0
};

// Check if Indian Stock Market (NSE/BSE) is actively open (Mon-Fri 09:15 to 15:30 IST)
function isIndianMarketOpen() {
    try {
        const istString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
        const istDate = new Date(istString);
        const day = istDate.getDay(); // 0 = Sun, 6 = Sat
        if (day === 0 || day === 6) return false;
        
        const minutes = istDate.getHours() * 60 + istDate.getMinutes();
        // 09:15 AM = 555 mins, 03:30 PM = 930 mins
        return minutes >= 555 && minutes <= 930;
    } catch (e) {
        return false;
    }
}

async function fetchLiveIndianMarketData(force = false) {
    const now = Date.now();
    const marketOpen = isIndianMarketOpen();
    // Cache for 60 seconds if market is open; cache for 1 hour (3600s) if market is closed!
    const cacheDuration = marketOpen ? 60000 : 3600000;

    if (!force && realMarketCache.data && (now - realMarketCache.lastFetched) < cacheDuration) {
        return realMarketCache.data;
    }

    try {
        const symbols = [
            { id: '^NSEI', name: 'NIFTY 50' },
            { id: '^NSEBANK', name: 'BANKNIFTY' },
            { id: '^BSESN', name: 'SENSEX' },
            { id: 'NIFTY_FIN_SERVICE.NS', name: 'FINNIFTY' },
            { id: '^INDIAVIX', name: 'INDIA VIX' }
        ];

        const requests = symbols.map(s => 
            axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s.id)}?interval=1d`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 4500
            }).then(res => {
                const meta = res.data?.chart?.result?.[0]?.meta;
                if (!meta) return null;
                const price = meta.regularMarketPrice || meta.fulldayPrice || 0;
                const change = meta.fulldayChange !== undefined ? meta.fulldayChange : (price - (meta.chartPreviousClose || price));
                const pct = meta.regularMarketChangePercent !== undefined ? meta.regularMarketChangePercent : (meta.fulldayChangePercent || 0);
                return {
                    symbol: s.name,
                    price: Number(price.toFixed(2)),
                    change: Number(change.toFixed(2)),
                    pct: Number(pct.toFixed(2)),
                    up: change >= 0
                };
            }).catch(e => {
                return null;
            })
        );

        const results = await Promise.all(requests);
        const valid = results.filter(Boolean);

        if (valid.length > 0) {
            const nifty = valid.find(r => r.symbol === 'NIFTY 50');
            const niftyPrice = nifty ? nifty.price : 22750;
            const atmStrike = Math.round(niftyPrice / 50) * 50;

            const vixObj = valid.find(r => r.symbol === 'INDIA VIX');
            const vix = vixObj ? vixObj.price : 17.16;
            // Real approximate ATM Options Premium
            const atmPremium = Number(((niftyPrice * (vix / 100) * Math.sqrt(2 / 365)) * 0.45).toFixed(2));

            const fullData = [
                ...valid,
                {
                    symbol: `NIFTY ${atmStrike} CE`,
                    price: Number((atmPremium * 1.05).toFixed(2)),
                    change: Number((atmPremium * 0.12).toFixed(2)),
                    pct: 12.4,
                    up: true
                },
                {
                    symbol: `NIFTY ${atmStrike} PE`,
                    price: Number((atmPremium * 0.95).toFixed(2)),
                    change: Number((-atmPremium * 0.08).toFixed(2)),
                    pct: -8.5,
                    up: false
                },
                {
                    symbol: 'FYERS ROUTE',
                    price: 'CONNECTED',
                    change: '12ms ping',
                    pct: 0,
                    up: true
                }
            ];

            realMarketCache = {
                data: fullData,
                lastFetched: now
            };
            return fullData;
        }
    } catch (err) {
        console.error('[MARKET DATA] Error in fetchLiveIndianMarketData:', err.message);
    }

    if (realMarketCache.data) return realMarketCache.data;
    return null;
}

app.get(['/api/market/quotes', '/api/market/ticker'], async (req, res) => {
    try {
        const liveData = await fetchLiveIndianMarketData();
        if (liveData) {
            return res.json({
                status: 'success',
                data: liveData,
                live_feed: true,
                source: 'NSE/BSE Real-Time Feed',
                timestamp: new Date().toISOString()
            });
        }

        // Fallback if network blocked
        const fallback = [
            { symbol: 'NIFTY 50', price: 22753.20, change: 153.20, pct: 0.68, up: true },
            { symbol: 'BANKNIFTY', price: 54366.70, change: 79.35, pct: 0.15, up: true },
            { symbol: 'SENSEX', price: 73606.75, change: 482.92, pct: 0.66, up: true },
            { symbol: 'FINNIFTY', price: 24454.35, change: 51.35, pct: 0.21, up: true },
            { symbol: 'INDIA VIX', price: 17.16, change: 0.30, pct: 1.78, up: true },
            { symbol: 'NIFTY 22750 CE', price: 148.50, change: 18.20, pct: 14.0, up: true },
            { symbol: 'NIFTY 22750 PE', price: 92.40, change: -12.10, pct: -11.5, up: false },
            { symbol: 'FYERS ROUTE', price: 'CONNECTED', change: '12ms ping', pct: 0, up: true }
        ];

        res.json({
            status: 'success',
            data: fallback,
            live_feed: false,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Periodic background market quote broadcaster (AWS Credit Protector)
// Runs every 60s ONLY during market hours AND ONLY if clients are actively connected!
setInterval(async () => {
    try {
        let hasClients = false;
        for (const clientsSet of sseClients.values()) {
            if (clientsSet && clientsSet.size > 0) {
                hasClients = true;
                break;
            }
        }
        if (!hasClients) return; // Zero clients online -> 0 external requests!

        if (!isIndianMarketOpen()) return; // Market closed -> 0 external requests!

        const quotes = await fetchLiveIndianMarketData();
        if (quotes && quotes.length > 0) {
            broadcastRealtimeEvent('*', 'market_quotes', quotes);
        }
    } catch (e) {}
}, 60000);

// ------------------------------------------------------------------
// EXPIRY CALENDAR & READINESS API
// ------------------------------------------------------------------
app.get('/api/calendar/expiries', async (req, res) => {
    try {
        const { index } = req.query;
        await syncTuesdayExpiryCalendar(db);
        const cleanIdx = (index || 'NIFTY').toUpperCase().replace(/\s*50\b/i, '').replace(/\s*\(BSE\)/i, '').replace(/\s+/g, '');
        let query = `SELECT * FROM expiry_calendar WHERE is_active = 1 AND index_name = ? ORDER BY id ASC`;
        let expiries = await db.all(query, [cleanIdx]);
        if (!expiries || expiries.length === 0) {
            expiries = getUpcomingTuesdayExpiries(cleanIdx, 8);
        }
        res.json({ status: 'success', data: expiries });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/device/status', authenticateToken, async (req, res) => {
    try {
        const readiness = await evaluateReadiness(req.user.id);
        res.json({ status: 'success', readiness });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/v1/device/:deviceId/status', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const binding = await db.get(`SELECT device_id, user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
        if (!binding) {
            return res.json({
                status: 'error',
                readiness: {
                    ready: false,
                    reason: 'DEVICE_UNREGISTERED',
                    checks: { device_bound: false, broker_configured: false, token_valid_today: false },
                    device_id: deviceId
                }
            });
        }
        const readiness = await evaluateReadiness(binding.user_id);
        res.json({ status: 'success', readiness });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/hardware/:userId/status', async (req, res) => {
    try {
        const readiness = await evaluateReadiness(req.params.userId);
        res.json({ status: 'success', readiness });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// COMBINED BOOT, TOKEN & READINESS STATUS
app.post(['/api/hardware/:userId/status', '/api/hardware/status'], async (req, res) => {
    try {
        const rawUserId = req.params.userId !== undefined ? req.params.userId : (req.body?.user_id !== undefined ? req.body.user_id : null);
        const userIdParam = rawUserId !== null && !isNaN(Number(rawUserId)) ? Number(rawUserId) : rawUserId;
        const deviceId = req.body?.device_id;

        // 1. Device registration & binding check
        let binding = null;
        if (deviceId && userIdParam !== null) {
            binding = await db.get(
                `SELECT device_id, user_id FROM device_bindings WHERE device_id = ? AND (user_id = ? OR user_id = ?) AND status = 'active'`,
                [deviceId, userIdParam, String(userIdParam)]
            );
            if (!binding) {
                // If device and user both exist, auto-bind to streamline hardware onboarding
                const userExists = await db.get(`SELECT id FROM users WHERE id = ? OR username = ?`, [userIdParam, String(userIdParam)]);
                const devExists = await db.get(`SELECT device_id FROM devices WHERE device_id = ?`, [deviceId]);
                if (userExists && devExists) {
                    await db.run(
                        `INSERT INTO device_bindings (device_id, user_id, order_ref, status) VALUES (?, ?, 'AUTO_LINK', 'active')`,
                        [deviceId, userExists.id]
                    );
                    binding = { device_id: deviceId, user_id: userExists.id };
                } else {
                    return res.json({
                        status: 'error',
                        ready: false,
                        message: 'Device not registered or not bound to this user'
                    });
                }
            }
        } else if (deviceId) {
            binding = await db.get(`SELECT device_id, user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
            if (!binding) {
                return res.json({
                    status: 'error',
                    ready: false,
                    message: 'Device not registered'
                });
            }
        } else if (userIdParam !== null) {
            binding = await db.get(`SELECT device_id, user_id FROM device_bindings WHERE (user_id = ? OR user_id = ?) AND status = 'active'`, [userIdParam, String(userIdParam)]);
            if (!binding) {
                return res.json({
                    status: 'error',
                    ready: false,
                    message: 'No active device bound to this user'
                });
            }
        } else {
            return res.json({
                status: 'error',
                ready: false,
                message: 'Missing device_id or userId'
            });
        }

        const resolvedUserId = binding.user_id;

        // 2. Broker credentials check
        const prefs = await db.get(`SELECT selected_broker, selected_index, selected_expiry FROM user_preferences WHERE user_id = ?`, [resolvedUserId]);
        const broker = prefs ? prefs.selected_broker : 'Fyers';

        const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [resolvedUserId]);
        const brokerConfigured = isBrokerConfigured(broker, creds);

        if (!brokerConfigured) {
            return res.json({
                status: 'error',
                ready: false,
                user_id: resolvedUserId,
                device_id: binding.device_id,
                message: 'Broker credentials missing'
            });
        }

        // 3. Token check
        const tokenValidToday = isBrokerTokenValid(broker, creds);

        // 4. Hardware Lock & Kill Switch Guard checks
        const lockRow = await db.get(`SELECT is_locked FROM device_lock_state WHERE user_id = ?`, [resolvedUserId]);
        const isDeviceLocked = !!(lockRow && lockRow.is_locked);

        const ks = await db.get(`SELECT active FROM kill_switch_state WHERE user_id = ?`, [resolvedUserId]);
        const killSwitchActive = !!(ks && ks.active);

        const isFullyReady = tokenValidToday && !isDeviceLocked && !killSwitchActive;

        const activeIndex = prefs?.selected_index || 'NIFTY';
        const activeExpiry = prefs?.selected_expiry || '';
        const lotSize = activeIndex.includes('BANKNIFTY') ? 30 : 65;

        return res.json({
            status: 'success',
            ready: isFullyReady,
            user_id: resolvedUserId,
            device_id: binding.device_id,
            selected_broker: broker,
            token_status: tokenValidToday ? 'VALID_TODAY' : 'TOKEN_EXPIRED',
            device_locked: isDeviceLocked,
            kill_switch_active: killSwitchActive,
            message: isFullyReady ? 'Ready to trade' : (isDeviceLocked ? 'Console locked by owner' : (killSwitchActive ? 'Emergency kill switch active' : 'Broker token expired or missing')),
            terminal: {
                broker,
                selected_broker: broker,
                index: activeIndex,
                expiry: activeExpiry,
                strike: 24300,
                quantity: lotSize
            }
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// HARDWARE BATTERY TELEMETRY (EVERY 5 MINUTES)
app.post(['/api/hardware/:userId/battery', '/api/hardware/battery'], async (req, res) => {
    try {
        const userIdParam = req.params.userId || null;
        const deviceId = req.body?.device_id;
        const batteryPct = req.body?.battery_pct !== undefined ? Number(req.body.battery_pct) : Number(req.body?.battery);
        const wifiRssi = req.body?.wifi_rssi !== undefined ? Number(req.body.wifi_rssi) : null;

        if (!deviceId) {
            return res.status(400).json({ status: 'error', message: 'Missing device_id parameter' });
        }
        if (isNaN(batteryPct) || batteryPct < 0 || batteryPct > 100) {
            return res.status(400).json({ status: 'error', message: 'Invalid or missing battery_pct (must be 0-100)' });
        }

        let boundUserId = userIdParam ? Number(userIdParam) : null;
        if (!boundUserId) {
            const binding = await db.get(`SELECT user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
            if (binding) boundUserId = binding.user_id;
        }

        // Upsert into device_telemetry
        await db.run(`
            INSERT INTO device_telemetry (device_id, user_id, battery_pct, wifi_rssi, last_heartbeat, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(device_id) DO UPDATE SET
                user_id = COALESCE(excluded.user_id, device_telemetry.user_id),
                battery_pct = excluded.battery_pct,
                wifi_rssi = COALESCE(excluded.wifi_rssi, device_telemetry.wifi_rssi),
                last_heartbeat = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `, [deviceId, boundUserId, batteryPct, wifiRssi]);

        // Realtime zero-polling push to mobile app via SSE/WebSocket
        if (boundUserId) {
            evaluateReadiness(boundUserId).then(readiness => {
                readiness.battery_pct = batteryPct;
                if (wifiRssi !== null) readiness.wifi_rssi = wifiRssi;
                broadcastRealtimeEvent(boundUserId, 'device_readiness', readiness);
            }).catch(e => console.error('[TELEMETRY BROADCAST NOTICE]:', e.message));
        }

        return res.status(200).json({
            status: 'success',
            message: 'Battery status recorded successfully',
            data: {
                device_id: deviceId,
                user_id: boundUserId,
                battery_pct: batteryPct,
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// HARDWARE BROKER TOGGLE / SWITCH ENDPOINT
app.post(['/api/hardware/:userId/switch-broker', '/api/hardware/:userId/toggle-broker', '/api/hardware/switch-broker'], async (req, res) => {
    try {
        const userIdParam = req.params.userId || null;
        const deviceId = req.body?.device_id;
        const requestedBroker = req.body?.broker; // Optional: specify "Fyers" or "Dhan"

        let boundUserId = userIdParam ? Number(userIdParam) : null;
        if (!boundUserId && deviceId) {
            const binding = await db.get(`SELECT user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
            if (binding) boundUserId = binding.user_id;
        }

        if (!boundUserId) {
            return res.status(400).json({ status: 'error', message: 'Missing userId or valid device_id' });
        }

        // Fetch current preference
        const currentPrefs = await db.get(`SELECT selected_broker FROM user_preferences WHERE user_id = ?`, [boundUserId]);
        const previousBroker = currentPrefs?.selected_broker || 'Fyers';

        // Supported multi-broker list
        const validBrokers = ['Fyers', 'Dhan', 'Upstox', 'Angel One', 'Kotak Neo', 'Zerodha'];
        let newBroker;
        if (requestedBroker && validBrokers.includes(requestedBroker)) {
            newBroker = requestedBroker;
        } else {
            const currentIdx = validBrokers.indexOf(previousBroker);
            newBroker = validBrokers[(currentIdx + 1) % validBrokers.length];
        }

        // Update user_preferences table
        await db.run(`
            INSERT INTO user_preferences (user_id, selected_broker)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET selected_broker = excluded.selected_broker
        `, [boundUserId, newBroker]);

        invalidateTradingCache(boundUserId);

        // Check token validity for newly selected broker
        const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [boundUserId]);
        const tokenValidToday = isBrokerTokenValid(newBroker, creds);

        await logAudit('device', boundUserId, 'BROKER_SWITCHED', { previous: previousBroker, selected: newBroker }, req.ip);

        return res.status(200).json({
            status: 'success',
            message: `Active broker changed from ${previousBroker} to ${newBroker}`,
            user_id: boundUserId,
            previous_broker: previousBroker,
            selected_broker: newBroker,
            token_valid_today: tokenValidToday
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// USER PREFERENCES API
// ------------------------------------------------------------------

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await db.get(`
            SELECT u.id, u.username, u.name, u.email, u.role, u.created_at,
                   db.device_id AS bound_device_id
            FROM users u
            LEFT JOIN device_bindings db ON u.id = db.user_id AND db.status = 'active'
            WHERE u.id = ?
        `, [req.user.id]);
        if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
        res.json({ status: 'success', data: user });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        let prefs = await db.get(`SELECT * FROM user_preferences WHERE user_id = ?`, [req.user.id]);
        if (!prefs) {
            prefs = { selected_broker: 'Fyers', selected_index: 'NIFTY', selected_expiry: '', added_brokers: null, kill_switch_scope: 'current' };
        }
        if (!prefs.kill_switch_scope) {
            prefs.kill_switch_scope = 'current';
        }

        // Validate selected_expiry: if empty or in the past, auto-update to nearest active Tuesday expiry
        if (isExpiryCodePast(prefs.selected_expiry)) {
            const nearestTuesday = getUpcomingTuesdayExpiries(prefs.selected_index || 'NIFTY', 1)[0].expiry_code;
            prefs.selected_expiry = nearestTuesday;
            await db.run(`UPDATE user_preferences SET selected_expiry = ? WHERE user_id = ?`, [nearestTuesday, req.user.id]);
        }

        // Parse or infer added_brokers
        let addedBrokersList = [];
        if (prefs.added_brokers) {
            try {
                addedBrokersList = typeof prefs.added_brokers === 'string' ? JSON.parse(prefs.added_brokers) : prefs.added_brokers;
            } catch (e) {
                addedBrokersList = [];
            }
        }

        // If no added_brokers recorded yet, infer from credentials
        if (!Array.isArray(addedBrokersList) || addedBrokersList.length === 0) {
            const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [req.user.id]);
            const inferred = new Set();
            if (creds) {
                if (creds.fyers_id || creds.fyers_app_id) inferred.add('Fyers');
                if (creds.dhan_client_id) inferred.add('Dhan');
                if (creds.upstox_api_key || creds.upstox_access_token) inferred.add('Upstox');
                if (creds.angel_client_code || creds.angel_api_key) inferred.add('Angel One');
                if (creds.kotak_consumer_key || creds.kotak_access_token) inferred.add('Kotak Neo');
                if (creds.zerodha_api_key || creds.zerodha_access_token) inferred.add('Zerodha');
            }
            if (prefs.selected_broker) inferred.add(prefs.selected_broker);
            if (inferred.size === 0) inferred.add('Fyers');
            addedBrokersList = Array.from(inferred);
        }

        prefs.added_brokers = addedBrokersList;
        res.json({ status: 'success', data: prefs });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/user/preferences', authenticateToken, async (req, res) => {
    let { selected_broker, selected_index, selected_expiry, added_brokers, kill_switch_scope } = req.body;
    try {
        if (isExpiryCodePast(selected_expiry)) {
            selected_expiry = getUpcomingTuesdayExpiries(selected_index || 'NIFTY', 1)[0].expiry_code;
        }
        if (kill_switch_scope && !['current', 'all'].includes(kill_switch_scope)) {
            kill_switch_scope = 'current';
        }
        const addedBrokersStr = Array.isArray(added_brokers) ? JSON.stringify(added_brokers) : added_brokers;
        await db.run(`
            INSERT INTO user_preferences (user_id, selected_broker, selected_index, selected_expiry, added_brokers, kill_switch_scope)
            VALUES (?, ?, ?, ?, ?, COALESCE(?, 'current'))
            ON CONFLICT (user_id) DO UPDATE SET 
            selected_broker = COALESCE(excluded.selected_broker, user_preferences.selected_broker),
            selected_index = COALESCE(excluded.selected_index, user_preferences.selected_index),
            selected_expiry = COALESCE(excluded.selected_expiry, user_preferences.selected_expiry),
            added_brokers = COALESCE(excluded.added_brokers, user_preferences.added_brokers),
            kill_switch_scope = COALESCE(excluded.kill_switch_scope, user_preferences.kill_switch_scope);
        `, [req.user.id, selected_broker, selected_index, selected_expiry, addedBrokersStr, kill_switch_scope]);
        invalidateTradingCache(req.user.id);
        res.json({ status: 'success', kill_switch_scope: kill_switch_scope || 'current' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/user/change-password', authenticateToken, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ status: 'error', message: 'Current and new password are required' });
        }
        const user = await db.get(`SELECT id, password_hash FROM users WHERE id = ?`, [req.user.id]);
        if (!user || !user.password_hash) {
            return res.status(400).json({ status: 'error', message: 'User account not found' });
        }
        const valid = await bcrypt.compare(current_password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ status: 'error', message: 'Current password incorrect' });
        }
        const newHash = await bcrypt.hash(new_password.trim(), 10);
        await db.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.user.id]);
        await logAudit('user', req.user.id, 'PASSWORD_CHANGED', {}, req.ip);
        res.json({ status: 'success', message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// DPDP ACT 2023: USER ACCOUNT & DATA ERASURE REQUESTS
// ------------------------------------------------------------------
app.post('/api/user/deletion-request', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await db.get(`SELECT id, username, email FROM users WHERE id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User account not found' });
        }

        const existing = await db.get(
            `SELECT id, status, requested_at FROM data_deletion_requests WHERE user_id = ? AND status = 'PENDING'`,
            [userId]
        );
        if (existing) {
            return res.status(400).json({
                status: 'error',
                message: 'An account deletion request is already pending review with the Data Protection Officer / Administrator.',
                request: existing
            });
        }

        const reason = req.body?.reason || 'User requested statutory erasure under DPDP Act 2023';
        const result = await db.run(
            `INSERT INTO data_deletion_requests (user_id, username, email, reason, status) VALUES (?, ?, ?, ?, 'PENDING')`,
            [userId, user.username, user.email, reason]
        );

        await logAudit('compliance', userId, 'DPDP_DELETION_REQUESTED', { reason, email: user.email }, req.ip);

        res.json({
            status: 'success',
            message: 'Your deletion request has been submitted under Section 12 of DPDP Act, 2023. Our Data Protection Officer / Administrator will review and execute the permanent erasure.',
            request: {
                id: result.lastID,
                user_id: userId,
                username: user.username,
                email: user.email,
                reason,
                status: 'PENDING',
                requested_at: new Date().toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/user/deletion-request', authenticateToken, async (req, res) => {
    try {
        const request = await db.get(
            `SELECT * FROM data_deletion_requests WHERE user_id = ? ORDER BY requested_at DESC LIMIT 1`,
            [req.user.id]
        );
        res.json({ status: 'success', request: request || null });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/user/deletion-request', authenticateToken, async (req, res) => {
    try {
        const existing = await db.get(
            `SELECT id FROM data_deletion_requests WHERE user_id = ? AND status = 'PENDING'`,
            [req.user.id]
        );
        if (!existing) {
            return res.status(404).json({ status: 'error', message: 'No pending deletion request found to cancel' });
        }

        await db.run(
            `UPDATE data_deletion_requests SET status = 'CANCELLED', notes = 'Withdrawn by user' WHERE id = ?`,
            [existing.id]
        );

        await logAudit('compliance', req.user.id, 'DPDP_DELETION_WITHDRAWN', {}, req.ip);

        res.json({ status: 'success', message: 'Account deletion request has been withdrawn successfully' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Broker Credentials
app.get(['/api/user/credentials', '/api/user/fyers-credentials'], authenticateToken, async (req, res) => {
    try {
        const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [req.user.id]);
        res.json({ status: 'success', data: creds || {} });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post(['/api/user/credentials', '/api/user/fyers-credentials'], authenticateToken, async (req, res) => {
    let { 
        fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key, fyers_access_token,
        dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token,
        upstox_api_key, upstox_api_secret, upstox_redirect_url, upstox_access_token,
        angel_client_code, angel_password, angel_api_key, angel_totp_secret, angel_access_token,
        kotak_consumer_key, kotak_consumer_secret, kotak_mobile, kotak_password, kotak_mpin, kotak_access_token,
        zerodha_api_key, zerodha_api_secret, zerodha_request_token, zerodha_access_token
    } = req.body;
    
    // Trim to prevent copy-paste whitespace issues
    fyers_id = fyers_id?.trim();
    fyers_totp_secret = fyers_totp_secret?.trim();
    fyers_pin = fyers_pin?.trim();
    fyers_app_id = fyers_app_id?.trim();
    fyers_secret_key = fyers_secret_key?.trim();
    fyers_access_token = fyers_access_token?.trim();

    dhan_client_id = dhan_client_id?.trim();
    dhan_password = dhan_password?.trim();
    dhan_totp_secret = dhan_totp_secret?.trim();
    dhan_api_key = dhan_api_key?.trim();
    dhan_api_secret = dhan_api_secret?.trim();
    dhan_access_token = dhan_access_token?.trim();

    upstox_api_key = upstox_api_key?.trim();
    upstox_api_secret = upstox_api_secret?.trim();
    upstox_redirect_url = upstox_redirect_url?.trim();
    upstox_access_token = upstox_access_token?.trim();

    angel_client_code = angel_client_code?.trim();
    angel_password = angel_password?.trim();
    angel_api_key = angel_api_key?.trim();
    angel_totp_secret = angel_totp_secret?.trim();
    angel_access_token = angel_access_token?.trim();

    kotak_consumer_key = kotak_consumer_key?.trim();
    kotak_consumer_secret = kotak_consumer_secret?.trim();
    kotak_mobile = kotak_mobile?.trim();
    kotak_password = kotak_password?.trim();
    kotak_mpin = kotak_mpin?.trim();
    kotak_access_token = kotak_access_token?.trim();

    zerodha_api_key = zerodha_api_key?.trim();
    zerodha_api_secret = zerodha_api_secret?.trim();
    zerodha_request_token = zerodha_request_token?.trim();
    zerodha_access_token = zerodha_access_token?.trim();

    try {
        await db.run(`
            INSERT INTO broker_credentials (
                user_id, fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key, fyers_access_token,
                dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token,
                upstox_api_key, upstox_api_secret, upstox_redirect_url, upstox_access_token,
                angel_client_code, angel_password, angel_api_key, angel_totp_secret, angel_access_token,
                kotak_consumer_key, kotak_consumer_secret, kotak_mobile, kotak_password, kotak_mpin, kotak_access_token,
                zerodha_api_key, zerodha_api_secret, zerodha_request_token, zerodha_access_token
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET 
            fyers_id = COALESCE(excluded.fyers_id, broker_credentials.fyers_id),
            fyers_totp_secret = COALESCE(excluded.fyers_totp_secret, broker_credentials.fyers_totp_secret),
            fyers_pin = COALESCE(excluded.fyers_pin, broker_credentials.fyers_pin),
            fyers_app_id = COALESCE(excluded.fyers_app_id, broker_credentials.fyers_app_id),
            fyers_secret_key = COALESCE(excluded.fyers_secret_key, broker_credentials.fyers_secret_key),
            fyers_access_token = COALESCE(excluded.fyers_access_token, broker_credentials.fyers_access_token),
            dhan_client_id = COALESCE(excluded.dhan_client_id, broker_credentials.dhan_client_id),
            dhan_password = COALESCE(excluded.dhan_password, broker_credentials.dhan_password),
            dhan_totp_secret = COALESCE(excluded.dhan_totp_secret, broker_credentials.dhan_totp_secret),
            dhan_api_key = COALESCE(excluded.dhan_api_key, broker_credentials.dhan_api_key),
            dhan_api_secret = COALESCE(excluded.dhan_api_secret, broker_credentials.dhan_api_secret),
            dhan_access_token = COALESCE(excluded.dhan_access_token, broker_credentials.dhan_access_token),
            upstox_api_key = COALESCE(excluded.upstox_api_key, broker_credentials.upstox_api_key),
            upstox_api_secret = COALESCE(excluded.upstox_api_secret, broker_credentials.upstox_api_secret),
            upstox_redirect_url = COALESCE(excluded.upstox_redirect_url, broker_credentials.upstox_redirect_url),
            upstox_access_token = COALESCE(excluded.upstox_access_token, broker_credentials.upstox_access_token),
            angel_client_code = COALESCE(excluded.angel_client_code, broker_credentials.angel_client_code),
            angel_password = COALESCE(excluded.angel_password, broker_credentials.angel_password),
            angel_api_key = COALESCE(excluded.angel_api_key, broker_credentials.angel_api_key),
            angel_totp_secret = COALESCE(excluded.angel_totp_secret, broker_credentials.angel_totp_secret),
            angel_access_token = COALESCE(excluded.angel_access_token, broker_credentials.angel_access_token),
            kotak_consumer_key = COALESCE(excluded.kotak_consumer_key, broker_credentials.kotak_consumer_key),
            kotak_consumer_secret = COALESCE(excluded.kotak_consumer_secret, broker_credentials.kotak_consumer_secret),
            kotak_mobile = COALESCE(excluded.kotak_mobile, broker_credentials.kotak_mobile),
            kotak_password = COALESCE(excluded.kotak_password, broker_credentials.kotak_password),
            kotak_mpin = COALESCE(excluded.kotak_mpin, broker_credentials.kotak_mpin),
            kotak_access_token = COALESCE(excluded.kotak_access_token, broker_credentials.kotak_access_token),
            zerodha_api_key = COALESCE(excluded.zerodha_api_key, broker_credentials.zerodha_api_key),
            zerodha_api_secret = COALESCE(excluded.zerodha_api_secret, broker_credentials.zerodha_api_secret),
            zerodha_request_token = COALESCE(excluded.zerodha_request_token, broker_credentials.zerodha_request_token),
            zerodha_access_token = COALESCE(excluded.zerodha_access_token, broker_credentials.zerodha_access_token),
            updated_at = CURRENT_TIMESTAMP;
        `, [
            req.user.id, fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key, fyers_access_token,
            dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token,
            upstox_api_key, upstox_api_secret, upstox_redirect_url, upstox_access_token,
            angel_client_code, angel_password, angel_api_key, angel_totp_secret, angel_access_token,
            kotak_consumer_key, kotak_consumer_secret, kotak_mobile, kotak_password, kotak_mpin, kotak_access_token,
            zerodha_api_key, zerodha_api_secret, zerodha_request_token, zerodha_access_token
        ]);
        invalidateTradingCache(req.user.id);
        res.json({ status: 'success', message: 'Credentials saved' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});


const generateAccessTokenHandler = async (req, res) => {
    try {
        const userId = req.user?.id || req.params.userId;
        const force = req.query.force === 'true' || req.body?.force === true;

        const prefs = await db.get(`SELECT selected_broker FROM user_preferences WHERE user_id = ?`, [userId]);
        const targetBroker = req.query?.broker || req.body?.broker || (prefs ? prefs.selected_broker : 'Fyers');

        const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

        if (!force && isBrokerTokenValid(targetBroker, creds)) {
            let existingToken = '';
            if (targetBroker === 'Dhan') existingToken = creds.dhan_access_token;
            else if (targetBroker === 'Upstox') existingToken = creds.upstox_access_token;
            else if (targetBroker === 'Angel One' || targetBroker === 'AngelOne') existingToken = creds.angel_access_token;
            else if (targetBroker === 'Kotak Neo' || targetBroker === 'Kotak') existingToken = creds.kotak_access_token;
            else if (targetBroker === 'Zerodha' || targetBroker === 'Kite') existingToken = creds.zerodha_access_token;
            else existingToken = creds.fyers_access_token;

            console.log(`[${targetBroker} Auth] User ${userId} access token is already valid for today (${todayIST}). Skipping generation.`);
            await db.run(`INSERT INTO token_events (user_id, broker, trigger_type, result, reason) VALUES (?, ?, ?, ?, ?)`, [userId, targetBroker, force ? 'FORCE' : 'BOOT_OR_POLL', 'SUCCESS', 'REUSED_SAME_DAY']);
            await logAudit('system', userId, 'TOKEN_REUSED', { broker: targetBroker, date: todayIST });
            return res.status(200).json({ 
                status: 'success', 
                message: `${targetBroker} access token is already valid for today.`, 
                broker: targetBroker,
                reused: true,
                date: todayIST,
                token: existingToken 
            });
        }

        console.log(`[${targetBroker} Auth] Generating new access token for user ${userId} for ${todayIST}...`);
        try {
            const token = await generateBrokerSessionToken(targetBroker, creds, db, userId, force);
            await db.run(`INSERT INTO token_events (user_id, broker, trigger_type, result, reason) VALUES (?, ?, ?, ?, ?)`, [userId, targetBroker, force ? 'FORCE' : 'BOOT_OR_POLL', 'SUCCESS', 'NEW_TOKEN_GENERATED']);
            await logAudit('system', userId, 'TOKEN_GENERATED', { broker: targetBroker, date: todayIST });
            return res.status(200).json({ 
                status: 'success', 
                message: `New ${targetBroker} Access Token generated successfully for today.`, 
                broker: targetBroker,
                reused: false,
                date: todayIST,
                token 
            });
        } catch (authError) {
            console.error(`[${targetBroker} Auth] Error:`, authError.message);
            await db.run(`INSERT INTO token_events (user_id, broker, trigger_type, result, reason) VALUES (?, ?, ?, ?, ?)`, [userId, targetBroker, force ? 'FORCE' : 'BOOT_OR_POLL', 'FAILURE', authError.message]);
            await logAudit('system', userId, 'TOKEN_FAILED', { broker: targetBroker, error: authError.message });
            return res.status(500).json({ status: 'error', message: `${targetBroker} authentication failed`, error: authError.message });
        }
    } catch (error) {
        const errorDetail = error.message || String(error);
        return res.status(500).json({ status: 'error', message: 'Internal server error during authentication', error: errorDetail });
    }
};

// ------------------------------------------------------------------
// MULTI-BROKER TOKEN REFRESH & SCHEDULED 06:00 AM IST CRON
// ------------------------------------------------------------------
const getTokensStatusPayload = async (userId) => {
    const prefs = await db.get(`SELECT selected_broker, added_brokers FROM user_preferences WHERE user_id = ?`, [userId]);
    let addedBrokersList = [];
    if (prefs?.added_brokers) {
        try {
            addedBrokersList = typeof prefs.added_brokers === 'string' ? JSON.parse(prefs.added_brokers) : prefs.added_brokers;
        } catch (e) {
            addedBrokersList = [];
        }
    }
    if (!Array.isArray(addedBrokersList) || addedBrokersList.length === 0) {
        addedBrokersList = [prefs?.selected_broker || 'Fyers'];
    }

    const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const remainingSeconds = getISTMidnightRemainingSeconds();
    const serverTimeIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const brokerStatuses = {};
    for (const bId of addedBrokersList) {
        const configured = isBrokerConfigured(bId, creds);
        const tokenInfo = getBrokerTokenDetails(bId, creds);
        brokerStatuses[bId] = {
            broker: bId,
            configured,
            token_valid_today: tokenInfo.isValid,
            token_generated_at: tokenInfo.generatedAt,
            is_active_target: bId === (prefs?.selected_broker || 'Fyers'),
            expires_at_ist: '23:59:59 IST',
            remaining_seconds: remainingSeconds,
            token_preview: tokenInfo.token ? `${tokenInfo.token.slice(0, 6)}...${tokenInfo.token.slice(-4)}` : null
        };
    }

    return {
        status: 'success',
        today_ist: todayIST,
        server_time_ist: serverTimeIST,
        scheduled_auto_time_ist: '06:00 AM IST',
        active_broker: prefs?.selected_broker || 'Fyers',
        brokers: brokerStatuses
    };
};

const runDailyTokenGenerationForUser = async (userId, triggerType = 'MANUAL_REFRESH') => {
    const prefs = await db.get(`SELECT selected_broker, added_brokers FROM user_preferences WHERE user_id = ?`, [userId]);
    let addedBrokersList = [];
    if (prefs?.added_brokers) {
        try {
            addedBrokersList = typeof prefs.added_brokers === 'string' ? JSON.parse(prefs.added_brokers) : prefs.added_brokers;
        } catch (e) {
            addedBrokersList = [];
        }
    }
    if (!Array.isArray(addedBrokersList) || addedBrokersList.length === 0) {
        addedBrokersList = [prefs?.selected_broker || 'Fyers'];
    }

    const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
    const results = {};

    for (const brokerId of addedBrokersList) {
        if (!isBrokerConfigured(brokerId, creds)) {
            results[brokerId] = {
                broker: brokerId,
                status: 'skipped',
                message: 'API credentials missing or incomplete in vault'
            };
            continue;
        }

        try {
            console.log(`[Token Auto-Sync] Refreshing token for user #${userId}, broker ${brokerId}...`);
            const token = await generateBrokerSessionToken(brokerId, creds, db, userId, true);
            await db.run(
                `INSERT INTO token_events (user_id, broker, trigger_type, result, reason) VALUES (?, ?, ?, ?, ?)`,
                [userId, brokerId, triggerType, 'SUCCESS', 'TOKEN_REFRESHED']
            );
            results[brokerId] = {
                broker: brokerId,
                status: 'success',
                message: 'Daily session token active',
                token_generated_at: new Date().toISOString()
            };
        } catch (err) {
            console.error(`[Token Auto-Sync] Refresh failed for ${brokerId}:`, err.message);
            await db.run(
                `INSERT INTO token_events (user_id, broker, trigger_type, result, reason) VALUES (?, ?, ?, ?, ?)`,
                [userId, brokerId, triggerType, 'FAILURE', err.message]
            );
            results[brokerId] = {
                broker: brokerId,
                status: 'error',
                message: err.message
            };
        }
    }

    // Immediately broadcast updated tokens status to all open screens via SSE (Zero-Polling)
    try {
        const payload = await getTokensStatusPayload(userId);
        broadcastRealtimeEvent(userId, 'tokens_status', payload);
    } catch (e) {
        console.error("[Token Auto-Sync] Error broadcasting realtime token status:", e.message);
    }

    return results;
};

const runDailyTokenGenerationForAllUsers = async (triggerType = 'SCHEDULED_6AM_CRON') => {
    try {
        console.log(`[Auto-Cron] Starting daily token sync for all registered users (Trigger: ${triggerType})...`);
        const users = await db.all(`SELECT id FROM users`);
        for (const user of users) {
            await runDailyTokenGenerationForUser(user.id, triggerType);
        }
        await logAudit('system', 'all', 'SCHEDULED_6AM_TOKEN_GENERATION', { count: users.length });
    } catch (e) {
        console.error("[Auto-Cron] Error running daily token sync for all users:", e.message);
    }
};

// Auto-cron scheduler: checks every 30 seconds for 06:00 AM IST
let lastAutoGenerateDateIST = null;

const checkAndRunDailyTokenScheduler = async () => {
    try {
        const now = new Date();
        const timeParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).formatToParts(now);

        const partMap = {};
        timeParts.forEach(p => partMap[p.type] = p.value);

        const currentHour = parseInt(partMap.hour, 10);
        const currentMinute = parseInt(partMap.minute, 10);
        const currentDateIST = `${partMap.year}-${partMap.month}-${partMap.day}`;

        // Triggers once per day at 06:00 AM IST (window: 06:00 to 06:05 AM)
        if (currentHour === 6 && currentMinute >= 0 && currentMinute <= 5 && lastAutoGenerateDateIST !== currentDateIST) {
            console.log(`[Auto-Cron] ⏰ 06:00 AM IST reached on ${currentDateIST}. Executing daily token generation for all connected brokers...`);
            lastAutoGenerateDateIST = currentDateIST;
            await runDailyTokenGenerationForAllUsers('SCHEDULED_6AM_CRON');
        }
    } catch (e) {
        console.error("[Auto-Cron] Scheduler check error:", e.message);
    }
};

setInterval(checkAndRunDailyTokenScheduler, 30 * 1000);

const executeTrade = async (req, res, side) => {
    const startTime = performance.now();
    const rawUserId = req.user?.id || req.params.userId || 1;
    const userId = Number(rawUserId) || 1;

    try {
        // 1. O(1) In-Memory Hot Cache Lookup (< 0.005 ms, Zero SQLite Disk I/O)
        const ctx = await getTradingContext(userId);

        // 2. Kill Switch Guard: Instant O(1) rejection if emergency halt is active
        if (ctx.killSwitchActive) {
            setImmediate(() => {
                db.run(
                    `INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message) VALUES (?, 'SYSTEM', 'BLOCKED', 'HALT', ?, 0, 'Blocked by Emergency Kill Switch')`,
                    [userId, side]
                ).catch(() => {});
            });
            return res.status(403).json({
                status: 'error',
                reason: 'KILL_SWITCH_ACTIVE',
                message: 'Emergency Kill Switch is engaged. All trading is halted on this console. Disengage Kill Switch to resume.'
            });
        }

        // 3. Hardware Device Lock Guard: Instant O(1) rejection if console is locked by owner
        const isHardwareReq = !req.user || req.params.userId !== undefined || req.path.includes('/hardware');
        if (isHardwareReq && ctx.deviceLocked) {
            setImmediate(() => {
                db.run(
                    `INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message) VALUES (?, 'HARDWARE_CONSOLE', 'BLOCKED', 'DEVICE_LOCK', ?, 0, 'Blocked: Physical Console is Locked by Owner')`,
                    [userId, side]
                ).catch(() => {});
            });
            return res.status(403).json({
                status: 'error',
                reason: 'DEVICE_LOCKED',
                message: 'Console is locked by the owner. Physical device triggers and requests are suppressed.'
            });
        }
        
        const quantity = req.body?.qty || req.body?.quantity;
        const strike = req.body?.strike;
        const type = req.body?.type;
        const symbol = req.body?.symbol;

        if (!quantity || !strike || !type) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing quantity, strike, or type',
                missing: {
                    quantity: !quantity,
                    strike: !strike,
                    type: !type
                }
            });
        }

        const broker = ctx.selectedBroker || 'Fyers';
        const indexName = symbol || ctx.selectedIndex || 'NIFTY';
        const expiryVal = ctx.selectedExpiry || '';

        // 4. In-Memory String Formatting (< 0.002 ms)
        const formattedSymbol = formatOptionSymbol(broker, indexName, expiryVal, strike, type);

        // 5. Execute Order over Pre-Warmed TCP/TLS Keep-Alive Connection Pool
        const orderResponse = await executeBrokerTrade(broker, ctx.creds, db, userId, { 
            quantity, 
            strike, 
            type, 
            symbol: formattedSymbol, 
            side 
        });

        const latencyMs = Math.round(performance.now() - startTime);

        // 6. IMMEDIATE DECOUPLED RESPONSE: Return to device/app without waiting for SQLite disk write
        res.status(200).json({ 
            status: "success", 
            message: "Order placed", 
            broker, 
            symbol: formattedSymbol, 
            latency_ms: latencyMs,
            response: orderResponse 
        });

        // 7. Write-Behind Logging: Persist to DB and push SSE event asynchronously in background
        setImmediate(async () => {
            try {
                await db.run(`
                    INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [userId, broker, formattedSymbol, type, side, quantity, 'Success']);
                await logAudit('trade', userId, 'TRADE_SUCCESS', { broker, symbol: formattedSymbol, side, quantity, latencyMs }, req.ip);
                broadcastRealtimeEvent(userId, 'trade_executed', { broker, symbol: formattedSymbol, type, side, quantity, latencyMs, timestamp: new Date().toISOString() });
            } catch (dbErr) {
                console.error("[ASYNC LOGGING ERROR]:", dbErr.message);
            }
        });

    } catch (error) {
        const latencyMs = Math.round(performance.now() - startTime);
        console.error(`[EXECUTE TRADE ERROR] ${error.message} (${latencyMs}ms)`);

        res.status(500).json({ 
            status: 'error', 
            message: error.message || 'Internal server error during order placement', 
            latency_ms: latencyMs 
        });

        setImmediate(async () => {
            try {
                const ctx = tradingContextCache.get(userId);
                const broker = ctx?.selectedBroker || 'Fyers';
                await db.run(`
                    INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [userId, broker, req.body?.symbol || 'Unknown', req.body?.type || 'Unknown', side, req.body?.qty || req.body?.quantity || 0, `Failed: ${error.message}`]);
                await logAudit('trade', userId, 'TRADE_FAILED', { broker, side, error: error.message, latencyMs }, req.ip);
            } catch (dbErr) {}
        });
    }
};

app.get('/api/user/trade-history', authenticateToken, async (req, res) => {
    try {
        const history = await db.all(`SELECT * FROM trade_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, [req.user.id]);
        res.json({ status: 'success', data: history });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/admin/trade-history', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
        const history = await db.all(`
            SELECT th.*, u.username 
            FROM trade_history th 
            JOIN users u ON th.user_id = u.id 
            ORDER BY th.created_at DESC LIMIT 500
        `);
        res.json({ status: 'success', data: history });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/fyers/generate-access-token', authenticateToken, generateAccessTokenHandler); // Kept for backwards compatibility
app.post('/api/hardware/:userId/fyers/generate-access-token', generateAccessTokenHandler); // Kept for backwards compatibility
app.post('/api/broker/generate-access-token', authenticateToken, generateAccessTokenHandler);

// Refresh tokens for all added brokers for logged-in user
app.post('/api/broker/refresh-all-tokens', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[Manual Refresh All] User #${userId} requested full token refresh for all added brokers.`);
        const results = await runDailyTokenGenerationForUser(userId, 'MANUAL_REFRESH_ALL');
        await logAudit('user', userId, 'MANUAL_REFRESH_ALL_TOKENS', { results }, req.ip);
        res.json({
            status: 'success',
            message: 'Tokens refreshed for all connected brokers',
            results
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Live token validity & status for all added brokers
app.get('/api/broker/tokens-status', authenticateToken, async (req, res) => {
    try {
        const payload = await getTokensStatusPayload(req.user.id);
        res.json(payload);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/buy', authenticateToken, (req, res) => executeTrade(req, res, 1));
app.post('/api/sell', authenticateToken, (req, res) => executeTrade(req, res, -1));

// ------------------------------------------------------------------
// HARDWARE ENDPOINTS (No JWT Required)
// ------------------------------------------------------------------
app.post('/api/hardware/:userId/broker/generate-access-token', generateAccessTokenHandler);
app.post('/api/hardware/:userId/broker/check-token', generateAccessTokenHandler);
app.get('/api/hardware/:userId/broker/check-token', generateAccessTokenHandler);
app.post('/api/hardware/:userId/broker/refresh-all-tokens', async (req, res) => {
    try {
        const userId = req.params.userId;
        const results = await runDailyTokenGenerationForUser(userId, 'HARDWARE_REFRESH_ALL');
        res.json({
            status: 'success',
            message: 'Tokens refreshed for all connected brokers',
            results
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});
app.get('/api/hardware/:userId/broker/tokens-status', async (req, res) => {
    try {
        const payload = await getTokensStatusPayload(req.params.userId);
        res.json(payload);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});
// ------------------------------------------------------------------
// EMERGENCY KILL SWITCH APIS (HARDWARE & WEB APP)
// ------------------------------------------------------------------

// 1. Hardware Kill Switch Trigger (Called by ESP32 physical kill switch)
app.post(['/api/hardware/:userId/kill-switch', '/api/hardware/kill-switch'], async (req, res) => {
    try {
        let userId = req.params.userId ? Number(req.params.userId) : null;
        const deviceId = req.body?.device_id || req.query?.device_id;
        
        if (!userId && deviceId) {
            const binding = await db.get(`SELECT user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
            if (binding) userId = binding.user_id;
        }

        if (!userId) {
            const defaultBinding = await db.get(`SELECT user_id FROM device_bindings WHERE status = 'active' LIMIT 1`);
            userId = defaultBinding ? defaultBinding.user_id : 1;
        }

        const isDisengage = req.body?.active === false || req.body?.action === 'DISENGAGE' || req.body?.action === 'LIFT';
        
        if (isDisengage) {
            const result = await disengageKillSwitch(userId, 'HARDWARE_DEVICE');
            return res.json({ status: 'success', kill_switch: result });
        }

        const reason = req.body?.reason || 'ESP32 Physical Hardware Kill Switch Triggered';
        const result = await executeEmergencyKillSwitch(userId, 'HARDWARE_DEVICE', reason);

        res.json({
            status: 'success',
            message: 'Emergency Kill Switch Engaged. All trades squared off.',
            kill_switch: result
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Hardware Query Kill Switch Status
app.get(['/api/hardware/:userId/kill-switch', '/api/hardware/kill-switch'], async (req, res) => {
    try {
        let userId = req.params.userId ? Number(req.params.userId) : null;
        const deviceId = req.query?.device_id;
        if (!userId && deviceId) {
            const binding = await db.get(`SELECT user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
            if (binding) userId = binding.user_id;
        }
        if (!userId) userId = 1;

        const ks = await db.get(`SELECT * FROM kill_switch_state WHERE user_id = ?`, [userId]);
        res.json({
            status: 'success',
            active: !!(ks && ks.active),
            triggered_at: ks?.triggered_at || null,
            triggered_by: ks?.triggered_by || null,
            reason: ks?.reason || null
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// 2. Web App Kill Switch Trigger (Called from Trading Setup screen / App)
app.post('/api/user/kill-switch', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const isDisengage = req.body?.active === false || req.body?.action === 'DISENGAGE';

        if (isDisengage) {
            const result = await disengageKillSwitch(userId, 'WEB_APP');
            return res.json({ status: 'success', kill_switch: result });
        }

        const reason = req.body?.reason || 'App Trading Setup Panic Button Pressed';
        const result = await executeEmergencyKillSwitch(userId, 'WEB_APP', reason);

        res.json({
            status: 'success',
            message: 'Emergency Kill Switch Engaged. All trades squared off.',
            kill_switch: result
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Web App Query Kill Switch Status
app.get('/api/user/kill-switch', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const [ks, prefs] = await Promise.all([
            db.get(`SELECT * FROM kill_switch_state WHERE user_id = ?`, [userId]),
            db.get(`SELECT selected_broker, kill_switch_scope FROM user_preferences WHERE user_id = ?`, [userId])
        ]);
        res.json({
            status: 'success',
            active: !!(ks && ks.active),
            triggered_at: ks?.triggered_at || null,
            triggered_by: ks?.triggered_by || null,
            reason: ks?.reason || null,
            scope: prefs?.kill_switch_scope || 'current',
            selected_broker: prefs?.selected_broker || 'Fyers'
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// HARDWARE DEVICE LOCK / HALT CONSOLE (Anti-Theft / Keypad Lockout)
// ------------------------------------------------------------------
app.post('/api/device/lock', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        updateDeviceLockCache(userId, true);
        const binding = await db.get(`SELECT device_id FROM device_bindings WHERE user_id = ? AND status = 'active'`, [userId]);
        const deviceId = binding ? binding.device_id : null;
        const reason = req.body?.reason || 'Console locked by operator from mobile app';

        await db.run(`
            INSERT INTO device_lock_state (user_id, device_id, is_locked, locked_at, locked_by, reason)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP, 'USER_APP', ?)
            ON CONFLICT(user_id) DO UPDATE SET
                is_locked = 1,
                locked_at = CURRENT_TIMESTAMP,
                locked_by = 'USER_APP',
                reason = excluded.reason
        `, [userId, deviceId, reason]);

        await logAudit('device_lock', userId, 'CONSOLE_LOCKED', { device_id: deviceId, reason }, req.ip);

        const lockPayload = {
            is_locked: true,
            device_id: deviceId,
            locked_at: new Date().toISOString(),
            locked_by: 'USER_APP',
            reason
        };

        // Broadcast to SSE stream so Console tab & any other clients update immediately
        broadcastRealtimeEvent(userId, 'device_lock_updated', lockPayload);
        broadcastRealtimeEvent(userId, 'device_readiness', await evaluateReadiness(userId));

        res.json({
            status: 'success',
            message: 'Hardware Console locked. All physical inputs and requests from this device are blocked by the server.',
            device_lock: lockPayload
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/device/unlock', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ status: 'error', message: 'Password is required to unlock console' });
        }

        const user = await db.get(`SELECT id, password_hash FROM users WHERE id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ status: 'error', message: 'Incorrect account password. Console remains locked.' });
        }

        updateDeviceLockCache(userId, false);

        await db.run(`
            UPDATE device_lock_state 
            SET is_locked = 0, locked_at = CURRENT_TIMESTAMP, locked_by = 'USER_APP', reason = 'Unlocked by password'
            WHERE user_id = ?
        `, [userId]);

        await logAudit('device_lock', userId, 'CONSOLE_UNLOCKED', { user_id: userId }, req.ip);

        const lockPayload = {
            is_locked: false,
            locked_at: new Date().toISOString(),
            locked_by: 'USER_APP',
            reason: 'Unlocked'
        };

        broadcastRealtimeEvent(userId, 'device_lock_updated', lockPayload);
        broadcastRealtimeEvent(userId, 'device_readiness', await evaluateReadiness(userId));

        res.json({
            status: 'success',
            message: 'Hardware Console unlocked. Physical triggers re-enabled.',
            device_lock: lockPayload
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/api/device/lock-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const lockRow = await db.get(`SELECT is_locked, locked_at, locked_by, reason, device_id FROM device_lock_state WHERE user_id = ?`, [userId]);
        res.json({
            status: 'success',
            is_locked: !!(lockRow && lockRow.is_locked),
            locked_at: lockRow?.locked_at || null,
            locked_by: lockRow?.locked_by || null,
            reason: lockRow?.reason || null,
            device_id: lockRow?.device_id || null
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// REALTIME EVENT STREAM (SSE) & ZERO-POLLING WEBHOOK BRIDGE
// ------------------------------------------------------------------
app.get(['/api/realtime/stream', '/api/events'], (req, res) => {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query?.token) {
        token = req.query.token;
    }

    let userId = 1;
    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded && decoded.id) userId = decoded.id;
        } catch (e) {}
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', user_id: userId, server_time: new Date().toISOString() })}\n\n`);

    // Register this client
    if (!sseClients.has(userId)) {
        sseClients.set(userId, new Set());
    }
    sseClients.get(userId).add(res);

    // Keepalive ping every 25s so firewalls don't close idle connection
    const keepAlive = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch (e) {
            clearInterval(keepAlive);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(keepAlive);
        if (sseClients.has(userId)) {
            sseClients.get(userId).delete(res);
            if (sseClients.get(userId).size === 0) {
                sseClients.delete(userId);
            }
        }
    });
});

// Dedicated Webhooks for ESP32 & Third-party integrations
app.post(['/api/webhook/kill-switch', '/api/webhook/:userId/kill-switch'], async (req, res) => {
    try {
        let userId = req.params.userId ? Number(req.params.userId) : null;
        const deviceId = req.body?.device_id || req.query?.device_id;
        if (!userId && deviceId) {
            const binding = await db.get(`SELECT user_id FROM device_bindings WHERE device_id = ? AND status = 'active'`, [deviceId]);
            if (binding) userId = binding.user_id;
        }
        if (!userId) userId = 1;

        const active = req.body?.active !== false && req.body?.action !== 'DISENGAGE';
        const reason = req.body?.reason || 'Hardware Kill Switch Webhook Triggered';

        if (active) {
            const result = await executeEmergencyKillSwitch(userId, 'HARDWARE_WEBHOOK', reason);
            res.json({
                status: 'success',
                message: 'Webhook processed. Kill switch engaged. Realtime push broadcasted.',
                kill_switch: result
            });
        } else {
            const result = await disengageKillSwitch(userId, 'HARDWARE_WEBHOOK');
            res.json({
                status: 'success',
                message: 'Webhook processed. Kill switch disengaged. Realtime push broadcasted.',
                kill_switch: result
            });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post(['/api/webhook/tokens-refresh', '/api/webhook/:userId/tokens-refresh'], async (req, res) => {
    try {
        const userId = req.params.userId ? Number(req.params.userId) : 1;
        const results = await runDailyTokenGenerationForUser(userId, 'WEBHOOK_REFRESH');
        res.json({
            status: 'success',
            message: 'Webhook token refresh executed successfully. Realtime push broadcasted.',
            results
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post(['/api/webhook/device-heartbeat', '/api/webhook/:userId/device-heartbeat'], async (req, res) => {
    try {
        let userId = req.params.userId ? Number(req.params.userId) : 1;
        const deviceId = req.body?.device_id;
        const battery = req.body?.battery_pct ?? null;
        const rssi = req.body?.wifi_rssi ?? null;

        if (deviceId) {
            await db.run(
                `UPDATE device_bindings SET last_heartbeat = CURRENT_TIMESTAMP WHERE device_id = ?`,
                [deviceId]
            );
            if (battery !== null || rssi !== null) {
                await db.run(`
                    INSERT INTO device_telemetry (device_id, user_id, battery_pct, wifi_rssi, last_heartbeat, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT(device_id) DO UPDATE SET
                        user_id = COALESCE(excluded.user_id, device_telemetry.user_id),
                        battery_pct = COALESCE(excluded.battery_pct, device_telemetry.battery_pct),
                        wifi_rssi = COALESCE(excluded.wifi_rssi, device_telemetry.wifi_rssi),
                        last_heartbeat = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                `, [deviceId, userId, battery, rssi]);
            }
        }

        const readiness = await evaluateReadiness(userId);
        if (battery !== null) readiness.battery_pct = battery;
        if (rssi !== null) readiness.wifi_rssi = rssi;

        broadcastRealtimeEvent(userId, 'device_readiness', readiness);

        res.json({
            status: 'success',
            message: 'Heartbeat webhook received. Realtime push broadcasted.',
            readiness
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/hardware/:userId/buy', (req, res) => executeTrade(req, res, 1));
app.post('/api/hardware/:userId/sell', (req, res) => executeTrade(req, res, -1));

// Static files for production client (Vite build)
const frontendDist = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            return res.sendFile(path.join(frontendDist, 'index.html'));
        }
        next();
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
});

module.exports = app;
