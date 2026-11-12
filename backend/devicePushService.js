const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

/**
 * TRADOPAD PHYSICAL DEVICE PUSH MESSAGING SERVICE (WEBSOCKET ENGINE)
 * 
 * Hardware Protocol Specifications:
 * - WebSocket URL: /ws?device_id=<DEVICE_ID>
 * - Subprotocol: arduino (Sec-WebSocket-Protocol: arduino)
 * - Device ID format: ^DEV-[0-9A-F]{12}$
 * - Bearer Authentication: Authorization: Bearer <DEVICE_TOKEN> (Constant-time compare)
 * - Admin API Key: Header x-api-key: <ADMIN_API_KEY> (Constant-time compare)
 * 
 * Latency & Data Structure:
 * - O(1) In-Memory Map of live device sockets: connectedDevices.get(device_id)
 * - Microsecond message dispatch (< 100 microseconds server framing overhead)
 * - Asynchronous Ack resolution with 5000ms SLA timeout
 */

// In-Memory live connection registry: deviceId -> { ws, connected_at, last_seen, fw, battery_pct, broker, ready, pendingAcks: Map }
const connectedDevices = new Map();

let wssInstance = null;
let heartbeatInterval = null;
let dbInstance = null;

/**
 * Cryptographically constant-time string comparison (immune to timing attacks on length and content)
 * @param {string} provided
 * @param {string} expected
 * @returns {boolean}
 */
function safeCompare(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') {
        return false;
    }
    const hashA = crypto.createHash('sha256').update(provided).digest();
    const hashB = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Express middleware for Admin API Key verification (constant-time)
 */
function validateAdminApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    const expected = process.env.ADMIN_API_KEY;

    if (!expected || !safeCompare(key, expected)) {
        return res.status(401).json({
            status: "error",
            message: "Unauthorized"
        });
    }
    next();
}

/**
 * Helper to reject HTTP upgrade requests cleanly with raw socket writes
 */
function rejectHttpUpgrade(socket, statusCode, statusText, message) {
    const body = message || statusText;
    const response = [
        `HTTP/1.1 ${statusCode} ${statusText}`,
        'Content-Type: text/plain',
        `Content-Length: ${Buffer.byteLength(body)}`,
        'Connection: close',
        '',
        body
    ].join('\r\n');
    try {
        socket.write(response);
    } catch (e) {}
    socket.destroy();
}

/**
 * Initializes WebSocket server and attaches to the underlying HTTP server's upgrade event
 * @param {import('http').Server} server - Node HTTP server instance
 * @param {Object} [db] - Optional SQLite database handle for updating device telemetry
 */
function initDevicePushWebSocket(server, db = null) {
    if (wssInstance) {
        return wssInstance;
    }
    dbInstance = db;

    const wss = new WebSocketServer({
        noServer: true,
        handleProtocols: (protocols) => {
            // Must accept 'arduino' subprotocol
            if (protocols instanceof Set) {
                if (protocols.has('arduino')) return 'arduino';
            } else if (Array.isArray(protocols)) {
                if (protocols.includes('arduino')) return 'arduino';
            } else if (typeof protocols === 'string') {
                if (protocols.includes('arduino')) return 'arduino';
            }
            return false;
        }
    });

    wssInstance = wss;

    // HTTP Upgrade Handshake Handler
    server.on('upgrade', (request, socket, head) => {
        let parsedUrl;
        try {
            parsedUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        } catch (e) {
            return rejectHttpUpgrade(socket, 400, 'Bad Request', 'Malformed URL');
        }

        // Only handle requests on /ws path
        if (parsedUrl.pathname !== '/ws') {
            return; // Let other upgrade handlers (if any) inspect or ignore
        }

        // 1. Validate device_id query param: ^DEV-[0-9A-F]{12}$
        const deviceId = parsedUrl.searchParams.get('device_id');
        if (!deviceId || !/^DEV-[0-9A-F]{12}$/.test(deviceId)) {
            console.warn(`[Device WS] Rejected upgrade: Invalid device_id format "${deviceId}"`);
            return rejectHttpUpgrade(socket, 400, 'Bad Request', 'Invalid device_id format');
        }

        // 2. Validate Bearer token against DEVICE_TOKEN (Constant-time compare)
        const authHeader = request.headers['authorization'] || '';
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        const token = match ? match[1].trim() : '';
        const expectedDeviceToken = process.env.DEVICE_TOKEN;

        if (!expectedDeviceToken || !safeCompare(token, expectedDeviceToken)) {
            console.warn(`[Device WS] Rejected upgrade for ${deviceId}: Unauthorized Bearer token`);
            return rejectHttpUpgrade(socket, 401, 'Unauthorized', 'Unauthorized');
        }

        // 3. Complete WebSocket upgrade
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request, deviceId);
        });
    });

    // WebSocket Connection Handler
    wss.on('connection', (ws, request, deviceId) => {
        const nowIso = new Date().toISOString();

        // If duplicate connection for same deviceId exists, terminate the old one
        const existing = connectedDevices.get(deviceId);
        if (existing && existing.ws) {
            console.log(`[Device WS] Closing stale connection for device ${deviceId} due to new connection.`);
            try {
                existing.ws.close(4000, 'Replaced by newer connection');
            } catch (e) {
                existing.ws.terminate();
            }
        }

        ws.isAlive = true;
        const entry = {
            ws,
            deviceId,
            connected_at: nowIso,
            last_seen: nowIso,
            fw: null,
            battery_pct: null,
            broker: null,
            ready: false,
            pendingAcks: new Map() // id -> { resolve, timer }
        };

        connectedDevices.set(deviceId, entry);
        console.log(`[Device WS] Device connected: ${deviceId}`);

        // Device ping / pong telemetry tracking
        ws.on('pong', () => {
            ws.isAlive = true;
            entry.last_seen = new Date().toISOString();
        });

        // The device itself pings every 15s
        ws.on('ping', () => {
            ws.isAlive = true;
            entry.last_seen = new Date().toISOString();
        });

        // Messages from the physical device
        ws.on('message', (data) => {
            entry.last_seen = new Date().toISOString();

            let msg;
            try {
                msg = JSON.parse(data.toString());
            } catch (err) {
                // Ignore malformed text frames
                return;
            }

            // CRITICAL SECURITY RULE: Reject order placement over this socket
            if (msg.type === 'buy' || msg.type === 'sell' || msg.type === 'order' || msg.type === 'trade') {
                console.warn(`[Device WS] DROPPED invalid order attempt over push socket from ${deviceId}. Orders accepted only via hardware POST /buy and /sell.`);
                return;
            }

            // Handshake Hello frame
            if (msg.type === 'hello') {
                entry.fw = msg.fw || null;
                entry.battery_pct = typeof msg.battery_pct === 'number' ? msg.battery_pct : null;
                entry.broker = msg.broker || null;
                entry.ready = !!msg.ready;

                console.log(`[Device WS] Hello received from ${deviceId} (FW: ${entry.fw || 'unknown'}, Broker: ${entry.broker || 'unknown'}, Ready: ${entry.ready}, Battery: ${entry.battery_pct}%)`);

                // Update database heartbeat if bound in device_bindings
                if (dbInstance) {
                    dbInstance.run(
                        `UPDATE device_bindings SET last_heartbeat = CURRENT_TIMESTAMP WHERE device_id = ?`,
                        [deviceId]
                    ).catch(() => {});
                }
                return;
            }

            // Acknowledgment frame: {"type":"ack","id":"<message_id>"}
            if (msg.type === 'ack' && msg.id) {
                const pending = entry.pendingAcks.get(msg.id);
                if (pending) {
                    clearTimeout(pending.timer);
                    entry.pendingAcks.delete(msg.id);
                    pending.resolve({
                        delivered: true,
                        acked: true,
                        id: msg.id
                    });
                }
                return;
            }

            // Ignore any other message types per specifications
        });

        // Cleanup on connection close
        ws.on('close', () => {
            const current = connectedDevices.get(deviceId);
            if (current && current.ws === ws) {
                connectedDevices.delete(deviceId);
                // Clear any remaining pending acks
                for (const [msgId, pending] of current.pendingAcks.entries()) {
                    clearTimeout(pending.timer);
                    pending.resolve({ delivered: true, acked: false, id: msgId });
                }
                current.pendingAcks.clear();
                console.log(`[Device WS] Device disconnected: ${deviceId}`);
            }
        });

        ws.on('error', (err) => {
            console.error(`[Device WS] Socket error on ${deviceId}:`, err.message);
        });
    });

    // Heartbeat check: Ping every 30s; terminate connections that miss a pong
    if (!heartbeatInterval) {
        heartbeatInterval = setInterval(() => {
            for (const [deviceId, entry] of connectedDevices.entries()) {
                if (entry.ws.isAlive === false) {
                    console.log(`[Device WS] Heartbeat timeout for ${deviceId}. Terminating connection.`);
                    entry.ws.terminate();
                    connectedDevices.delete(deviceId);
                    continue;
                }
                entry.ws.isAlive = false;
                try {
                    entry.ws.ping();
                } catch (err) {
                    entry.ws.terminate();
                    connectedDevices.delete(deviceId);
                }
            }
        }, 30000);
        heartbeatInterval.unref();
    }

    return wss;
}

/**
 * Sends a display push message to a connected physical device and waits for acknowledgment
 * 
 * @param {string} deviceId - Target device ID (e.g. 'DEV-A4CF12F3B2C8')
 * @param {string} message - Message text to display (required, max 84 chars)
 * @param {string} [title="SERVER"] - Header banner title (max 21 chars, default 'SERVER')
 * @param {number} [duration=5000] - Screen display duration in ms (clamped 1000 - 30000, default 5000)
 * @param {number} [buzz=0] - Haptic vibration pulses (clamped 0 - 3, default 0)
 * @param {Object|null} [data=null] - Optional extra metadata passed through
 * @returns {Promise<{delivered: boolean, acked?: boolean, id?: string, reason?: string}>}
 */
async function send_to_device(deviceId, message, title = "SERVER", duration = 5000, buzz = 0, data = null) {
    const entry = connectedDevices.get(deviceId);
    if (!entry || !entry.ws || entry.ws.readyState !== WebSocket.OPEN) {
        return { delivered: false, reason: "offline" };
    }

    const id = crypto.randomUUID();

    // 1. Sanitize & clamp title (max 21 chars, default "SERVER")
    const safeTitle = (typeof title === 'string' && title.trim().length > 0)
        ? title.trim().slice(0, 21)
        : 'SERVER';

    // 2. Sanitize & clamp message (required, max 84 chars)
    const safeMessage = String(message || '').trim().slice(0, 84);

    // 3. Clamp duration: 1000 - 30000 ms, default 5000
    let safeDuration = Number.isInteger(Number(duration)) ? Number(duration) : 5000;
    if (safeDuration < 1000) safeDuration = 1000;
    if (safeDuration > 30000) safeDuration = 30000;

    // 4. Clamp buzz: 0 - 3 pulses, default 0
    let safeBuzz = Number.isInteger(Number(buzz)) ? Number(buzz) : 0;
    if (safeBuzz < 0) safeBuzz = 0;
    if (safeBuzz > 3) safeBuzz = 3;

    const frame = {
        type: "display",
        id,
        title: safeTitle,
        message: safeMessage,
        duration: safeDuration,
        buzz: safeBuzz,
        data: data !== undefined ? data : null
    };

    return new Promise((resolve) => {
        // Wait up to 5000 ms for device ack
        const timer = setTimeout(() => {
            if (entry.pendingAcks.has(id)) {
                entry.pendingAcks.delete(id);
                resolve({ delivered: true, acked: false, id });
            }
        }, 5000);

        entry.pendingAcks.set(id, { resolve, timer });

        try {
            entry.ws.send(JSON.stringify(frame), (err) => {
                if (err) {
                    clearTimeout(timer);
                    entry.pendingAcks.delete(id);
                    resolve({ delivered: false, reason: "send_error", error: err.message, id });
                }
            });
        } catch (err) {
            clearTimeout(timer);
            entry.pendingAcks.delete(id);
            resolve({ delivered: false, reason: "send_exception", error: err.message, id });
        }
    });
}

/**
 * Pushes a notification to all physical devices bound to a user
 * @param {number|string} userId
 * @param {string} message
 * @param {string} [title="SERVER"]
 * @param {number} [duration=5000]
 * @param {number} [buzz=0]
 * @param {Object} [data=null]
 * @param {Object} [db]
 */
async function push_to_user_devices(userId, message, title = "SERVER", duration = 5000, buzz = 0, data = null, db = dbInstance) {
    if (!db) return [];
    try {
        const bindings = await db.all(
            `SELECT device_id FROM device_bindings WHERE user_id = ? AND is_active = 1`,
            [userId]
        );
        const results = [];
        for (const b of bindings) {
            const res = await send_to_device(b.device_id, message, title, duration, buzz, data);
            results.push({ deviceId: b.device_id, ...res });
        }
        return results;
    } catch (e) {
        console.error(`[Device WS] Error pushing to user #${userId} devices:`, e.message);
        return [];
    }
}

/**
 * Returns list of currently online devices with metadata
 * @returns {Array<{device_id: string, connected_at: string, last_seen: string, fw?: string, battery_pct?: number, broker?: string, ready?: boolean}>}
 */
function getConnectedDevices() {
    const list = [];
    for (const [deviceId, entry] of connectedDevices.entries()) {
        if (entry.ws && entry.ws.readyState === WebSocket.OPEN) {
            list.push({
                device_id: deviceId,
                connected_at: entry.connected_at,
                last_seen: entry.last_seen,
                fw: entry.fw,
                battery_pct: entry.battery_pct,
                broker: entry.broker,
                ready: entry.ready
            });
        }
    }
    return list;
}

/**
 * Checks whether a specific device is currently online and connected
 * @param {string} deviceId
 * @returns {boolean}
 */
function isDeviceOnline(deviceId) {
    const entry = connectedDevices.get(deviceId);
    return !!(entry && entry.ws && entry.ws.readyState === WebSocket.OPEN);
}

/**
 * Clean shutdown helper for testing or server restart
 */
function closeAll() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
    for (const [deviceId, entry] of connectedDevices.entries()) {
        try {
            entry.ws.terminate();
        } catch (e) {}
    }
    connectedDevices.clear();
    if (wssInstance) {
        try {
            wssInstance.close();
        } catch (e) {}
        wssInstance = null;
    }
}

function setDatabase(db) {
    dbInstance = db;
}

module.exports = {
    initDevicePushWebSocket,
    setDatabase,
    send_to_device,
    push_to_user_devices,
    getConnectedDevices,
    isDeviceOnline,
    safeCompare,
    validateAdminApiKey,
    closeAll
};
