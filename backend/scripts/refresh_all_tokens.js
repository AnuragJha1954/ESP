#!/usr/bin/env node

/**
 * Tradopad Multi-Broker Daily Morning Token Refresh Job (6:00 AM - 7:00 AM IST)
 * 
 * Can be run manually or automated via system cron:
 * Example crontab entry for 06:15 AM IST (Monday to Friday):
 * 45 0 * * 1-5 /usr/bin/node /home/ubuntu/ESP/backend/scripts/refresh_all_tokens.js >> /var/log/tradopad_token_refresh.log 2>&1
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const brokerVault = require('../brokers/brokerVault');

async function run() {
    console.log(`[Tradopad Token Job] Initializing morning refresh runner...`);
    const dbPath = path.resolve(__dirname, '..', 'esp_database.sqlite');
    
    let db;
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Initialize broker vault with database
        await brokerVault.init(db);

        // Run automated renewal for all active brokers (Fyers, Dhan, Zerodha, Kotak, Groww, Delta)
        const summary = await brokerVault.refreshAllTokens(db);

        console.log(`[Tradopad Token Job] Completed successfully:`, summary);
        await db.close();
        process.exit(0);
    } catch (err) {
        console.error(`[Tradopad Token Job] Critical Failure:`, err.message);
        if (db) {
            try { await db.close(); } catch (e) {}
        }
        process.exit(1);
    }
}

run();
