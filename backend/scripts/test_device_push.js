const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const http = require('http');
const express = require('express');
const { WebSocket } = require('ws');
const axios = require('axios');
const {
    initDevicePushWebSocket,
    send_to_device,
    getConnectedDevices,
    isDeviceOnline,
    validateAdminApiKey,
    closeAll
} = require('../devicePushService');

async function runDevicePushTestSuite() {
    console.log('================================================================');
    console.log('STARTING DEVICE PUSH MESSAGING & WEBSOCKET ENGINE TEST SUITE');
    console.log('================================================================\n');

    const DEVICE_TOKEN = process.env.DEVICE_TOKEN;
    const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

    if (!DEVICE_TOKEN || !ADMIN_API_KEY) {
        throw new Error('DEVICE_TOKEN and ADMIN_API_KEY must be set in environment');
    }

    // 1. Setup isolated test Express & HTTP server
    const app = express();
    app.use(express.json());

    app.post('/api/hardware/push/:deviceId', validateAdminApiKey, async (req, res) => {
        try {
            const { deviceId } = req.params;
            const { title, message, duration, buzz, data } = req.body || {};
            if (!message || typeof message !== 'string') {
                return res.status(400).json({ status: "error", message: "'message' (string) is required" });
            }
            const pushResult = await send_to_device(deviceId, message, title, duration, buzz, data);
            if (!pushResult.delivered) {
                return res.status(404).json({ status: "error", message: "Device offline", device_id: deviceId });
            }
            return res.status(200).json({
                status: "success",
                device_id: deviceId,
                id: pushResult.id,
                delivered: true,
                acked: !!pushResult.acked
            });
        } catch (err) {
            return res.status(500).json({ status: "error", message: err.message });
        }
    });

    app.get('/api/hardware/devices/online', validateAdminApiKey, (req, res) => {
        const devices = getConnectedDevices();
        return res.status(200).json({
            status: "success",
            devices: devices.map(d => ({
                device_id: d.device_id,
                connected_at: d.connected_at,
                last_seen: d.last_seen
            }))
        });
    });

    app.get('/api/hardware/devices/:deviceId/online', validateAdminApiKey, (req, res) => {
        const { deviceId } = req.params;
        const online = isDeviceOnline(deviceId);
        return res.status(200).json({
            status: "success",
            device_id: deviceId,
            online
        });
    });

    const server = http.createServer(app);
    initDevicePushWebSocket(server, null);

    const TEST_PORT = 3199;
    await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
    console.log(`✓ Test HTTP & WebSocket server bound to 127.0.0.1:${TEST_PORT}\n`);

    const BASE_HTTP = `http://127.0.0.1:${TEST_PORT}`;
    const BASE_WS = `ws://127.0.0.1:${TEST_PORT}/ws`;
    const TEST_DEVICE_ID = 'DEV-A4CF12F3B2C8';

    try {
        // -------------------------------------------------------------
        // TEST 1: Handshake Rejection - Invalid Device ID Format (HTTP 400)
        // -------------------------------------------------------------
        console.log('[Test 1] Testing handshake rejection on invalid device_id...');
        await new Promise((resolve, reject) => {
            const wsBadId = new WebSocket(`${BASE_WS}?device_id=INVALID_FORMAT`, ['arduino'], {
                headers: { 'Authorization': `Bearer ${DEVICE_TOKEN}` }
            });
            wsBadId.on('open', () => reject(new Error('Expected invalid device_id to be rejected')));
            wsBadId.on('unexpected-response', (req, res) => {
                if (res.statusCode === 400) {
                    console.log('  ✓ Correctly rejected with HTTP 400 Bad Request');
                    resolve();
                } else {
                    reject(new Error(`Expected status 400, got ${res.statusCode}`));
                }
            });
            wsBadId.on('error', () => {});
        });

        // -------------------------------------------------------------
        // TEST 2: Handshake Rejection - Invalid Bearer Token (HTTP 401)
        // -------------------------------------------------------------
        console.log('[Test 2] Testing handshake rejection on unauthorized Bearer token...');
        await new Promise((resolve, reject) => {
            const wsBadToken = new WebSocket(`${BASE_WS}?device_id=${TEST_DEVICE_ID}`, ['arduino'], {
                headers: { 'Authorization': `Bearer wrong_token_value_xyz` }
            });
            wsBadToken.on('open', () => reject(new Error('Expected invalid token to be rejected')));
            wsBadToken.on('unexpected-response', (req, res) => {
                if (res.statusCode === 401) {
                    console.log('  ✓ Correctly rejected with HTTP 401 Unauthorized');
                    resolve();
                } else {
                    reject(new Error(`Expected status 401, got ${res.statusCode}`));
                }
            });
            wsBadToken.on('error', () => {});
        });

        // -------------------------------------------------------------
        // TEST 3: Successful WebSocket Handshake & Subprotocol Negotiation
        // -------------------------------------------------------------
        console.log('[Test 3] Testing successful WebSocket connection with arduino subprotocol...');
        let deviceWs;
        let receivedDisplayFrames = [];

        await new Promise((resolve, reject) => {
            deviceWs = new WebSocket(`${BASE_WS}?device_id=${TEST_DEVICE_ID}`, ['arduino'], {
                headers: { 'Authorization': `Bearer ${DEVICE_TOKEN}` }
            });

            deviceWs.on('open', () => {
                console.log(`  ✓ WebSocket connected. Subprotocol: "${deviceWs.protocol}"`);
                if (deviceWs.protocol !== 'arduino') {
                    return reject(new Error(`Expected subprotocol "arduino", got "${deviceWs.protocol}"`));
                }
                resolve();
            });

            deviceWs.on('message', (data) => {
                const parsed = JSON.parse(data.toString());
                receivedDisplayFrames.push(parsed);

                // Auto-reply with ack if it is a display frame
                if (parsed.type === 'display' && parsed.id) {
                    deviceWs.send(JSON.stringify({ type: 'ack', id: parsed.id }));
                }
            });

            deviceWs.on('error', (err) => reject(err));
        });

        // -------------------------------------------------------------
        // TEST 4: Sending "hello" Frame From Device
        // -------------------------------------------------------------
        console.log('[Test 4] Sending device "hello" telemetry handshake frame...');
        deviceWs.send(JSON.stringify({
            type: 'hello',
            device_id: TEST_DEVICE_ID,
            fw: '1.1.0',
            broker: 'Fyers',
            ready: true,
            battery_pct: 85
        }));
        await new Promise(r => setTimeout(r, 100)); // Allow frame processing

        // Verify device is now recognized as online
        if (!isDeviceOnline(TEST_DEVICE_ID)) {
            throw new Error(`Device ${TEST_DEVICE_ID} should be online`);
        }
        console.log('  ✓ Device recognized as ONLINE in internal memory map');

        // -------------------------------------------------------------
        // TEST 5: HTTP REST API - GET /api/hardware/devices/online
        // -------------------------------------------------------------
        console.log('[Test 5] Querying GET /api/hardware/devices/online with ADMIN_API_KEY...');
        // 5a. Unauthorized attempt
        try {
            await axios.get(`${BASE_HTTP}/api/hardware/devices/online`, {
                headers: { 'x-api-key': 'invalid_admin_key' }
            });
            throw new Error('Expected 401 for bad API key');
        } catch (err) {
            if (err.response?.status === 401) {
                console.log('  ✓ Correctly rejected unauthorized admin API call with 401');
            } else {
                throw err;
            }
        }

        // 5b. Authorized attempt
        const onlineRes = await axios.get(`${BASE_HTTP}/api/hardware/devices/online`, {
            headers: { 'x-api-key': ADMIN_API_KEY }
        });
        console.log('  ✓ Online devices response:', onlineRes.data);
        if (!onlineRes.data.devices.some(d => d.device_id === TEST_DEVICE_ID)) {
            throw new Error(`Device ${TEST_DEVICE_ID} missing from online list`);
        }

        // -------------------------------------------------------------
        // TEST 6: HTTP REST API - GET /api/hardware/devices/<DEVICE_ID>/online
        // -------------------------------------------------------------
        console.log('[Test 6] Checking single device online status endpoint...');
        const devStatusRes = await axios.get(`${BASE_HTTP}/api/hardware/devices/${TEST_DEVICE_ID}/online`, {
            headers: { 'x-api-key': ADMIN_API_KEY }
        });
        if (devStatusRes.data.online !== true) {
            throw new Error(`Expected online: true for ${TEST_DEVICE_ID}`);
        }
        console.log('  ✓ Single device online query confirmed: online = true');

        // Check offline query for non-existent device
        const offlineQueryRes = await axios.get(`${BASE_HTTP}/api/hardware/devices/DEV-000000000000/online`, {
            headers: { 'x-api-key': ADMIN_API_KEY }
        });
        if (offlineQueryRes.data.online !== false) {
            throw new Error('Expected online: false for non-existent device');
        }
        console.log('  ✓ Non-existent device query confirmed: online = false');

        // -------------------------------------------------------------
        // TEST 7: Server-to-Device Push Notification with Ack Roundtrip
        // -------------------------------------------------------------
        console.log('[Test 7] Executing push notification via POST /api/hardware/push/:deviceId...');
        const t0 = performance.now();
        const pushRes = await axios.post(
            `${BASE_HTTP}/api/hardware/push/${TEST_DEVICE_ID}`,
            {
                title: 'ALERT',
                message: 'Nifty crossed 24300',
                duration: 5000,
                buzz: 1,
                data: { strike: 24300, sentiment: 'BULLISH' }
            },
            {
                headers: { 'x-api-key': ADMIN_API_KEY }
            }
        );
        const t1 = performance.now();
        const roundtripMs = (t1 - t0).toFixed(2);

        console.log(`  ✓ Push response received in ${roundtripMs} ms:`, pushRes.data);
        if (pushRes.data.delivered !== true || pushRes.data.acked !== true) {
            throw new Error(`Expected delivered: true and acked: true, got ${JSON.stringify(pushRes.data)}`);
        }

        // Verify the frame received by simulated hardware
        const receivedFrame = receivedDisplayFrames.find(f => f.id === pushRes.data.id);
        if (!receivedFrame) {
            throw new Error(`Device did not receive display frame with id ${pushRes.data.id}`);
        }
        console.log('  ✓ Device received frame:', receivedFrame);
        if (receivedFrame.type !== 'display' || receivedFrame.title !== 'ALERT' || receivedFrame.buzz !== 1) {
            throw new Error(`Display frame mismatch: ${JSON.stringify(receivedFrame)}`);
        }

        // -------------------------------------------------------------
        // TEST 8: Push to Offline Device (HTTP 404)
        // -------------------------------------------------------------
        console.log('[Test 8] Testing push to offline device...');
        try {
            await axios.post(
                `${BASE_HTTP}/api/hardware/push/DEV-FFFFFFFFFFFF`,
                { message: 'Test message' },
                { headers: { 'x-api-key': ADMIN_API_KEY } }
            );
            throw new Error('Expected 404 for offline device');
        } catch (err) {
            if (err.response?.status === 404) {
                console.log('  ✓ Correctly returned HTTP 404 Device offline:', err.response.data);
            } else {
                throw err;
            }
        }

        // -------------------------------------------------------------
        // TEST 9: Duplicate Connection Replacement
        // -------------------------------------------------------------
        console.log('[Test 9] Testing duplicate connection replacement...');
        let oldClosed = false;
        deviceWs.on('close', () => {
            oldClosed = true;
        });

        // Open second connection with same device ID
        const secondWs = new WebSocket(`${BASE_WS}?device_id=${TEST_DEVICE_ID}`, ['arduino'], {
            headers: { 'Authorization': `Bearer ${DEVICE_TOKEN}` }
        });

        await new Promise((resolve) => {
            secondWs.on('open', resolve);
        });
        await new Promise(r => setTimeout(r, 100));

        if (!oldClosed) {
            throw new Error('Old WebSocket connection was not closed on duplicate handshake');
        }
        console.log('  ✓ Stale connection successfully closed when newer connection connected');

        // Cleanup second socket
        secondWs.close();
        await new Promise(r => setTimeout(r, 100));

        // -------------------------------------------------------------
        // TEST 10: Disconnect Cleanup
        // -------------------------------------------------------------
        console.log('[Test 10] Testing connection cleanup on disconnect...');
        if (isDeviceOnline(TEST_DEVICE_ID)) {
            throw new Error('Device should be marked offline after disconnect');
        }
        console.log('  ✓ Device removed from online registry after disconnect');

        console.log('\n================================================================');
        console.log('ALL 10 DEVICE PUSH & WEBSOCKET TESTS PASSED CLEANLY! (100% SLA)');
        console.log('================================================================\n');

    } finally {
        closeAll();
        await new Promise((resolve) => server.close(resolve));
    }
}

runDevicePushTestSuite().catch((err) => {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
});
