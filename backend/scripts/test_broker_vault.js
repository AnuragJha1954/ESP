const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const brokerVault = require('../brokers/brokerVault');

async function test() {
    console.log('--- STARTING BROKER VAULT COMPREHENSIVE LOCAL TEST ---');
    const dbPath = path.resolve(__dirname, '..', 'esp_database.sqlite');
    const db = await open({ filename: dbPath, driver: sqlite3.Database });

    // 1. Initialize DB and Broker Vault
    console.log('[Test 1] Initializing broker vault schema and cache...');
    await brokerVault.init(db);
    console.log('✓ Broker vault initialized.');

    // 2. Save mock credentials for all 6 brokers for test user 999
    const testUserId = 999;
    const brokersToTest = [
        { broker: 'ZERODHA', client_id: 'ZR1234', api_key: 'kite_key_mock', api_secret: 'kite_sec_mock', access_token: 'mock_kite_token' },
        { broker: 'KOTAK', client_id: 'KT9988', api_key: 'kotak_c_key', api_secret: 'kotak_c_sec', pin: '1234', access_token: 'mock_kotak_token' },
        { broker: 'GROWW', client_id: 'GW5566', api_key: 'groww_key', api_secret: 'groww_sec', access_token: 'mock_groww_token' },
        { broker: 'DHAN', client_id: 'DH4433', api_key: 'dhan_key', api_secret: 'dhan_sec', access_token: 'mock_dhan_token' },
        { broker: 'FYERS', client_id: 'FY7711', api_key: 'fyers_app_id', api_secret: 'fyers_sec', pin: '4321', access_token: 'mock_fyers_token' },
        { broker: 'DELTA', client_id: 'DL9900', api_key: 'delta_api_key', api_secret: 'delta_api_secret' }
    ];

    console.log('[Test 2] Saving credentials for 6 brokers in broker_vault...');
    for (const b of brokersToTest) {
        await brokerVault.saveCredentials(testUserId, b.broker, b);
        console.log(`  ✓ Saved credentials for ${b.broker}`);
    }

    // 3. Fast In-Memory O(1) Adapter Retrieval (< 0.05ms)
    console.log('[Test 3] Testing O(1) in-memory retrieval latency...');
    for (const b of brokersToTest) {
        const t0 = performance.now();
        const adapter = await brokerVault.getAdapter(testUserId, b.broker);
        const t1 = performance.now();
        const latencyMicroseconds = ((t1 - t0) * 1000).toFixed(2);
        if (!adapter) throw new Error(`Adapter for ${b.broker} failed to load`);
        console.log(`  ✓ Retrieved ${adapter.brokerName} adapter in ${latencyMicroseconds} μs`);
    }

    // 4. Safe User Broker Listing (Masked Secrets)
    console.log('[Test 4] Verifying masked user brokers listing...');
    const userBrokers = await brokerVault.getUserBrokers(testUserId);
    console.log(`  Retrieved ${userBrokers.length} broker profiles for user #${testUserId}:`);
    for (const ub of userBrokers) {
        if (ub.api_secret || ub.pin || ub.totp_secret) {
            throw new Error(`CRITICAL SECURITY FAILURE: Raw secrets exposed in getUserBrokers for ${ub.broker}!`);
        }
        console.log(`  ✓ ${ub.broker}: active=${ub.is_active}, has_secret=${ub.has_secret}, has_token=${ub.has_token}`);
    }

    // 5. Normalization Test
    console.log('[Test 5] Testing broker name alias normalization...');
    const aliases = [
        ['kite', 'ZERODHA'],
        ['Zerodha Kite', 'ZERODHA'],
        ['Kotak Neo', 'KOTAK'],
        ['groww api', 'GROWW'],
        ['DhanHQ', 'DHAN'],
        ['Delta Exchange', 'DELTA']
    ];
    for (const [input, expected] of aliases) {
        const norm = brokerVault.normalizeBroker(input);
        if (norm !== expected) throw new Error(`Normalization failed for ${input}: got ${norm}, expected ${expected}`);
    }
    console.log('  ✓ Broker alias normalization passed.');

    // 6. Clean up test records
    console.log('[Test 6] Cleaning up test records for user #999...');
    await db.run(`DELETE FROM broker_vault WHERE user_id = ?`, [testUserId]);
    console.log('✓ Cleanup completed.');

    await db.close();
    console.log('--- ALL BROKER VAULT TESTS PASSED SUCCESSFULLY! ---');
}

test().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
