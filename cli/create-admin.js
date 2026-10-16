#!/usr/bin/env node
/**
 * Tradopad Single-Admin Provisioning CLI
 * Usage: node cli/create-admin.js [--username <name>] [--email <email>] [--password <pass>]
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

    const username = getArg('--username', 'admin');
    const email = getArg('--email', 'admin@infirow.in');
    const rawPassword = getArg('--password', crypto.randomBytes(6).toString('hex') + 'A1!');

    console.log('\n========================================');
    console.log('   TRADOPAD SINGLE-ADMIN SETUP CLI');
    console.log('========================================\n');

    const dbPath = path.resolve(__dirname, '../esp_database.sqlite');
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    try {
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        
        // Generate MFA recovery backup codes
        const recoveryCodes = Array.from({ length: 5 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());

        const existing = await db.get(`SELECT id FROM users WHERE username = ? OR role = 'admin'`, [username]);
        let adminId;

        if (existing) {
            await db.run(
                `UPDATE users SET username = ?, password_hash = ?, email = ?, role = 'admin' WHERE id = ?`,
                [username, passwordHash, email, existing.id]
            );
            adminId = existing.id;
            console.log(`[+] Existing admin account (ID: ${adminId}) updated successfully.`);
        } else {
            const res = await db.run(
                `INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, 'admin')`,
                [username, passwordHash, email]
            );
            adminId = res.lastID;
            console.log(`[+] New admin account (ID: ${adminId}) created successfully.`);
        }

        // Record audit entry
        try {
            await db.run(
                `INSERT INTO audit_log (actor_type, actor_id, action, details) VALUES ('cli', ?, 'ADMIN_SETUP_CLI', ?)`,
                [String(adminId), JSON.stringify({ username, email })]
            );
        } catch (e) {
            // Non-blocking
        }

        console.log('\n--- ADMIN CREDENTIALS ---');
        console.log(`Username : ${username}`);
        console.log(`Email    : ${email}`);
        console.log(`Password : ${rawPassword}`);
        console.log('\n--- EMERGENCY RECOVERY CODES (Store Safely) ---');
        recoveryCodes.forEach((code, i) => console.log(` Code ${i + 1}: ${code}`));
        console.log('\n========================================\n');

    } catch (err) {
        console.error('[-] Error configuring admin account:', err);
    } finally {
        await db.close();
    }
}

main();
