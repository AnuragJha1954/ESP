require('dotenv').config();
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
const { sendApprovalEmail } = require('./emailService');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_super_secret_key_change_in_production';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

let db;

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
        `);

        // Seed default admin
        const adminExists = await db.get(`SELECT id FROM users WHERE username = 'admin'`);
        if (!adminExists) {
            const hash = await bcrypt.hash('admin', 10);
            await db.run(`INSERT INTO users (username, password_hash, role) VALUES ('admin', ?, 'admin')`, hash);
            console.log("Default admin account created (admin/admin).");
        }

        console.log("Database initialized successfully.");
    } catch (err) {
        console.error("Error initializing SQLite database:", err);
    }
};
initDB();

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
    if (req.user.role !== 'admin') {
        return res.status(403).json({ status: 'error', message: 'Admin access required' });
    }
    next();
};

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
        res.json({ status: 'success', token, user: { id: user.id, username: user.username, role: user.role } });
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
        res.json({ status: 'success', token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'Google Authentication Failed', error: err.message });
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
        const users = await db.all(`SELECT id, username, email, google_id, role, created_at FROM users`);
        res.json({ status: 'success', data: users });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
    const { username, password, email, role } = req.body;
    try {
        const hash = password ? await bcrypt.hash(password, 10) : null;
        const result = await db.run(`INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)`, 
            [username || null, hash, email || null, role || 'user']);
        res.json({ status: 'success', message: 'User created', userId: result.lastID });
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
        const user = await db.get(`SELECT id, username, email, google_id, role, created_at FROM users WHERE id = ?`, [userId]);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'User not found' });
        }
        const preferences = await db.get(`SELECT selected_broker, selected_index, selected_expiry FROM user_preferences WHERE user_id = ?`, [userId]);
        const broker_credentials = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);

        res.json({
            status: 'success',
            data: {
                user,
                preferences: preferences || null,
                broker_credentials: broker_credentials || null
            }
        });
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
            await db.run(`INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)`, [username, hash, entry.email]);
        } catch (insertErr) {
            username = username + '_' + crypto.randomBytes(2).toString('hex');
            await db.run(`INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)`, [username, hash, entry.email]);
        }
        
        await db.run(`UPDATE waitlist SET status = 'approved' WHERE id = ?`, [id]);
        
        // Send Onboarding Email
        await sendApprovalEmail(entry.email, entry.name, username, password);
        
        res.json({ status: 'success', message: 'User approved and email sent', credentials: { username, password } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// USER PREFERENCES API
// ------------------------------------------------------------------
app.get('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        const prefs = await db.get(`SELECT * FROM user_preferences WHERE user_id = ?`, [req.user.id]);
        res.json({ status: 'success', data: prefs || {} });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/user/preferences', authenticateToken, async (req, res) => {
    const { selected_broker, selected_index, selected_expiry } = req.body;
    try {
        await db.run(`
            INSERT INTO user_preferences (user_id, selected_broker, selected_index, selected_expiry)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET 
            selected_broker = excluded.selected_broker,
            selected_index = excluded.selected_index,
            selected_expiry = excluded.selected_expiry;
        `, [req.user.id, selected_broker, selected_index, selected_expiry]);
        res.json({ status: 'success' });
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
        fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key,
        dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token
    } = req.body;
    
    // Trim to prevent copy-paste whitespace issues
    fyers_id = fyers_id?.trim();
    fyers_totp_secret = fyers_totp_secret?.trim();
    fyers_pin = fyers_pin?.trim();
    fyers_app_id = fyers_app_id?.trim();
    fyers_secret_key = fyers_secret_key?.trim();
    dhan_client_id = dhan_client_id?.trim();
    dhan_password = dhan_password?.trim();
    dhan_totp_secret = dhan_totp_secret?.trim();
    dhan_api_key = dhan_api_key?.trim();
    dhan_api_secret = dhan_api_secret?.trim();
    dhan_access_token = dhan_access_token?.trim();

    try {
        await db.run(`
            INSERT INTO broker_credentials (
                user_id, fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key,
                dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET 
            fyers_id = COALESCE(excluded.fyers_id, broker_credentials.fyers_id),
            fyers_totp_secret = COALESCE(excluded.fyers_totp_secret, broker_credentials.fyers_totp_secret),
            fyers_pin = COALESCE(excluded.fyers_pin, broker_credentials.fyers_pin),
            fyers_app_id = COALESCE(excluded.fyers_app_id, broker_credentials.fyers_app_id),
            fyers_secret_key = COALESCE(excluded.fyers_secret_key, broker_credentials.fyers_secret_key),
            dhan_client_id = COALESCE(excluded.dhan_client_id, broker_credentials.dhan_client_id),
            dhan_password = COALESCE(excluded.dhan_password, broker_credentials.dhan_password),
            dhan_totp_secret = COALESCE(excluded.dhan_totp_secret, broker_credentials.dhan_totp_secret),
            dhan_api_key = COALESCE(excluded.dhan_api_key, broker_credentials.dhan_api_key),
            dhan_api_secret = COALESCE(excluded.dhan_api_secret, broker_credentials.dhan_api_secret),
            dhan_access_token = COALESCE(excluded.dhan_access_token, broker_credentials.dhan_access_token),
            updated_at = CURRENT_TIMESTAMP;
        `, [
            req.user.id, fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key,
            dhan_client_id, dhan_password, dhan_totp_secret, dhan_api_key, dhan_api_secret, dhan_access_token
        ]);
        res.json({ status: 'success', message: 'Credentials saved' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ------------------------------------------------------------------
// FYERS TRADING LOGIC
// ------------------------------------------------------------------
function generateAppIdHash(clientId, secretKey) {
    const hash = crypto.createHash('sha256');
    hash.update(`${clientId}:${secretKey}`);
    return hash.digest('hex');
}

function base32tohex(base32) {
    let base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    let hex = "";
    for (let i = 0; i < base32.length; i++) {
        let val = base32chars.indexOf(base32.charAt(i).toUpperCase());
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
    }
    for (let i = 0; i + 4 <= bits.length; i += 4) {
        let chunk = bits.substring(i, i + 4);
        hex = hex + parseInt(chunk, 2).toString(16);
    }
    return hex;
}

function generateTOTP(secret) {
    const key = Buffer.from(base32tohex(secret), 'hex');
    const epoch = Math.round(Date.now() / 1000.0);
    const time = Buffer.alloc(8);
    let timeVal = Math.floor(epoch / 30);
    for (let i = 7; i >= 0; i--) {
        time[i] = timeVal & 0xff;
        timeVal >>= 8;
    }
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(time);
    const result = hmac.digest();
    const offset = result[result.length - 1] & 0xf;
    const otp = (((result[offset] & 0x7f) << 24) | ((result[offset + 1] & 0xff) << 16) | ((result[offset + 2] & 0xff) << 8) | (result[offset + 3] & 0xff)) % 1000000;
    return otp.toString().padStart(6, '0');
}

const generateAccessTokenHandler = async (req, res) => {
    try {
        const userId = req.user?.id || req.params.userId;
        const prefs = await db.get(`SELECT selected_broker FROM user_preferences WHERE user_id = ?`, [userId]);
        const broker = prefs ? prefs.selected_broker : 'Fyers';

        if (broker === 'Dhan') {
            try {
                const token = await generateDhanToken(db, userId);
                return res.status(200).json({ status: 'success', message: 'Dhan Access Token generated successfully.', token });
            } catch (dhanError) {
                return res.status(500).json({ status: 'error', message: 'Dhan Auto-Login failed', error: dhanError.message });
            }
        }

        // Fyers Flow
        const creds = await db.get(`SELECT * FROM broker_credentials WHERE user_id = ?`, [userId]);
        if (!creds || !creds.fyers_id || !creds.fyers_totp_secret || !creds.fyers_pin || !creds.fyers_app_id || !creds.fyers_secret_key) {
            return res.status(400).json({ status: 'error', message: 'Missing Fyers credentials for this user. Please configure them in your profile.' });
        }

        let { fyers_id, fyers_totp_secret, fyers_pin, fyers_app_id, fyers_secret_key } = creds;
        
        // Trim all credentials to prevent copy-paste whitespace errors
        fyers_id = fyers_id?.trim();
        fyers_totp_secret = fyers_totp_secret?.trim();
        fyers_pin = fyers_pin?.trim();
        fyers_app_id = fyers_app_id?.trim();
        fyers_secret_key = fyers_secret_key?.trim();

        const redirectUri = "https://trade.fyers.in/api-login/redirect-uri/index.html";
        const appIdHash = generateAppIdHash(fyers_app_id, fyers_secret_key);

        let attempt = 1;
        const maxAttempts = 3;
        let lastError = null;

        while (attempt <= maxAttempts) {
            try {
                console.log(`[Fyers Auth] Attempt ${attempt} for user ${userId}`);
                
                const payload1 = { fy_id: Buffer.from(fyers_id).toString('base64'), app_id: "2" };
                const sendOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/send_login_otp_v2', payload1, { timeout: 10000 });
                if (sendOtpResponse.data.code !== 200 && sendOtpResponse.data.code !== 1043 && sendOtpResponse.data.s !== 'ok') {
                    throw new Error(`Failed to send OTP: ${JSON.stringify(sendOtpResponse.data)}`);
                }
                const requestKey = sendOtpResponse.data.request_key;

                // Generating TOTP right before using it to ensure it's as fresh as possible
                const totp = generateTOTP(fyers_totp_secret);
                const payload2 = { request_key: requestKey, otp: totp };
                const verifyOtpResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_otp', payload2, { timeout: 10000 });
                if (verifyOtpResponse.data.code !== 200 && verifyOtpResponse.data.s !== 'ok') {
                    throw new Error(`Failed to verify TOTP: ${JSON.stringify(verifyOtpResponse.data)}`);
                }
                const requestKey2 = verifyOtpResponse.data.request_key;

                const payload3 = { request_key: requestKey2, identity_type: "pin", identifier: Buffer.from(fyers_pin).toString('base64') };
                const verifyPinResponse = await axios.post('https://api-t2.fyers.in/vagator/v2/verify_pin_v2', payload3, { timeout: 10000 });
                if (verifyPinResponse.data.code !== 200 && verifyPinResponse.data.s !== 'ok') {
                    throw new Error(`Failed to verify PIN: ${JSON.stringify(verifyPinResponse.data)}`);
                }
                const accessTokenVagator = verifyPinResponse.data.data.access_token;

                const payload4 = {
                    fyers_id: fyers_id,
                    app_id: fyers_app_id.includes('-') ? fyers_app_id.split('-')[0] : fyers_app_id,
                    redirect_uri: redirectUri,
                    appType: fyers_app_id.includes('-') ? fyers_app_id.split('-')[1] : "100",
                    code_challenge: "",
                    state: crypto.randomBytes(8).toString('hex'),
                    scope: "",
                    nonce: "",
                    response_type: "code",
                    create_cookie: true
                };
                const authCodeResponse = await axios.post('https://api-t1.fyers.in/api/v3/token', payload4, {
                    headers: { 'Authorization': `Bearer ${accessTokenVagator}` },
                    validateStatus: (status) => status >= 200 && status < 400,
                    timeout: 10000
                });
                
                if (authCodeResponse.data.s !== 'ok') {
                    throw new Error(`Failed to get auth code: ${JSON.stringify(authCodeResponse.data)}`);
                }
                
                const urlParams = new URLSearchParams(authCodeResponse.data.Url.split('?')[1]);
                const authCode = urlParams.get('auth_code');

                const payload5 = { grant_type: "authorization_code", appIdHash: appIdHash, code: authCode };
                const tokenReq = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', payload5, { timeout: 10000 });
                const tokenResponse = tokenReq.data;

                if (tokenResponse.s === 'ok' || tokenResponse.access_token) {
                    await db.run(`UPDATE broker_credentials SET fyers_access_token = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [tokenResponse.access_token, userId]);
                    return res.status(200).json({ status: 'success', message: 'Fyers Access Token generated successfully.' });
                } else {
                    throw new Error(`Failed to generate final access token: ${JSON.stringify(tokenResponse)}`);
                }

            } catch (error) {
                lastError = error.response ? error.response.data : (error.message || String(error));
                console.error(`[Fyers Auth] Attempt ${attempt} failed:`, JSON.stringify(lastError));
                
                if (attempt < maxAttempts) {
                    // Wait for a few seconds before retrying (2s, 4s, etc.)
                    // This is especially useful if TOTP was out of sync or rate limit triggered
                    const waitTime = attempt * 2000;
                    console.log(`[Fyers Auth] Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                attempt++;
            }
        }

        // If we reach here, all attempts failed
        console.error("[Fyers Auth] All attempts exhausted.");
        return res.status(500).json({ status: 'error', message: 'Fyers authentication failed after multiple attempts', error: lastError });
    } catch (error) {
        const errorDetail = error.message || String(error);
        return res.status(500).json({ status: 'error', message: 'Internal server error during auto-authentication', error: errorDetail });
    }
};

const executeTrade = async (req, res, side) => {
    try {
        const userId = req.user?.id || req.params.userId;
        const { quantity, strike, type, symbol } = req.body;
        
        if (!quantity || !strike || !type || !symbol) {
            return res.status(400).json({ status: 'error', message: 'Missing quantity, strike, symbol, or type' });
        }

        const prefs = await db.get(`SELECT selected_broker FROM user_preferences WHERE user_id = ?`, [userId]);
        const broker = prefs ? prefs.selected_broker : 'Fyers';

        let orderResponse;
        
        if (broker === 'Dhan') {
            orderResponse = await executeDhanTrade(db, userId, { quantity, strike, type, symbol, side });
        } else {
            // Fyers Logic
            const creds = await db.get(`SELECT fyers_access_token, fyers_app_id FROM broker_credentials WHERE user_id = ?`, [userId]);
            if (!creds || !creds.fyers_access_token) {
                throw new Error('No Fyers access token found. Please run the generate token flow first.');
            }

            const fyers = new fyersModel();
            fyers.setAppId(creds.fyers_app_id);
            fyers.setRedirectUrl("https://trade.fyers.in/api-login/redirect-uri/index.html");
            fyers.setAccessToken(creds.fyers_access_token);

            const optionType = type.toUpperCase();
            const tradingSymbol = `NSE:${symbol}${strike}${optionType}`;

            orderResponse = await fyers.place_order({
                "symbol": tradingSymbol,
                "qty": Number(quantity),
                "type": 2, // Market
                "side": side, 
                "productType": "INTRADAY",
                "limitPrice": 0,
                "stopPrice": 0,
                "validity": "DAY",
                "disclosedQty": 0,
                "offlineOrder": false,
                "stopLoss": 0,
                "takeProfit": 0,
                "orderTag": "InfirowAPI",
                "isSliceOrder": false
            });

            if (orderResponse.s !== "ok") {
                throw new Error(`Fyers Order Failed: ${JSON.stringify(orderResponse)}`);
            }
        }

        // Save trade to history
        await db.run(`
            INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, broker, symbol, type, side, quantity, 'Success']);

        return res.status(200).json({ status: "success", message: "Order placed", broker: broker, response: orderResponse });
    } catch (error) {
        console.log(`FAILURE: Execute Trade - Error: ${error.message}`);
        
        // Log failed trade to history
        const userId = req.user?.id || req.params.userId;
        const prefs = await db.get(`SELECT selected_broker FROM user_preferences WHERE user_id = ?`, [userId]);
        const broker = prefs ? prefs.selected_broker : 'Fyers';
        
        try {
            await db.run(`
                INSERT INTO trade_history (user_id, broker, symbol, type, side, quantity, message) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, broker, req.body?.symbol || 'Unknown', req.body?.type || 'Unknown', side, req.body?.quantity || 0, `Failed: ${error.message}`]);
        } catch (dbErr) {
            console.error("Failed to log failed trade to DB:", dbErr);
        }

        return res.status(500).json({ status: 'error', message: 'Internal server error', error: error.message });
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
app.post('/api/buy', authenticateToken, (req, res) => executeTrade(req, res, 1));
app.post('/api/sell', authenticateToken, (req, res) => executeTrade(req, res, -1));

// ------------------------------------------------------------------
// HARDWARE ENDPOINTS (No JWT Required)
// ------------------------------------------------------------------
app.post('/api/hardware/:userId/broker/generate-access-token', generateAccessTokenHandler);
app.post('/api/hardware/:userId/buy', (req, res) => executeTrade(req, res, 1));
app.post('/api/hardware/:userId/sell', (req, res) => executeTrade(req, res, -1));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
});

module.exports = app;
