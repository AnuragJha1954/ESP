const express = require('express');

const app = express();
app.use(express.json());

// --- TEST ENDPOINTS FOR MICROCONTROLLER ---

const dummyTradeResponse = (req, res, tradeType) => {
    const { quantity, strike_price } = req.body || {};
    console.log(`[TEST] Received ${tradeType} - Qty: ${quantity}, Strike: ${strike_price}`);
    return res.status(200).json({
        status: 'success',
        message: `[TEST MODE] ${tradeType} order placed successfully`,
        order_id: `test_${Math.floor(Math.random() * 100000000)}`,
        symbol: `TEST_SYMBOL_${strike_price || '00000'}`,
        quantity: quantity || 0
    });
};

app.post('/test/buy/call', (req, res) => dummyTradeResponse(req, res, 'Buy Call'));
app.post('/test/buy/put', (req, res) => dummyTradeResponse(req, res, 'Buy Put'));
app.post('/test/sell/call', (req, res) => dummyTradeResponse(req, res, 'Sell Call'));
app.post('/test/sell/put', (req, res) => dummyTradeResponse(req, res, 'Sell Put'));

app.all('/test/device/ready', (req, res) => {
    console.log("[TEST] Device Ready Ping Received");
    return res.status(200).json({
        status: 'success',
        message: 'Device is connected and ready'
    });
});
// ------------------------------------------

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running in TEST MODE on port ${PORT}`);
    });
}

module.exports = app;
