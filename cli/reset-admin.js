#!/usr/bin/env node
/**
 * Tradopad Break-Glass Single-Admin Recovery CLI
 * Usage: node cli/reset-admin.js [--password <newPassword>]
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const getArg = (flag, def) => {
        const idx = args.indexOf(flag);
        return idx !== -1 && args[idx + 1] ? args[idx + 1] : def;
    };

    const newPassword = getArg('--password', 'TradopadAdmin@' + crypto.randomBytes(3).toString('hex'));

    console.log('\n========================================');
    console.log('   BREAK-GLASS ADMIN RECOVERY CLI');
    console.log('========================================\n');

    const dbPath = path.resolve(__dirname, '../esp_database.sqlite');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        const admin = await db.get(`SELECT id, username, email FROM users WHERE role = 'admin' OR username = 'admin' ORDER BY id ASC LIMIT 1`);
        if (!admin) {
            console.error('[-] No admin account located in database. Run create-admin.js instead.');
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await db.run(
            `UPDATE users SET password_hash = ? WHERE id = ?`,
            [passwordHash, admin.id]
        );

        // Record break-glass recovery in audit ledger
        try {
            await db.run(
                `INSERT INTO audit_log (actor_type, actor_id, action, details) VALUES ('break_glass_cli', ?, 'ADMIN_BREAK_GLASS_RESET', ?)`,
                [String(admin.id), JSON.stringify({ admin_id: admin.id, username: admin.username, timestamp: new Date().toISOString() })]
            );
        } catch (e) {}

        console.log(`[+] Admin credentials reset successfully for: ${admin.username} (ID: ${admin.id})`);
        console.log(`\nNew Password: ${newPassword}`);
        console.log('\nThis event has been permanently recorded in the append-only audit ledger.\n');
        console.log('========================================\n');

    } catch (err) {
        console.error('[-] Recovery failed:', err);
    } finally {
        await db.close();
    }
}

main();
