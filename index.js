const express = require('express');
const app = express();

app.use(express.json());

const processTrade = (req, res, tradeType) => {
    try {
        const { quantity } = req.body;
        
        if (quantity === undefined || quantity === null) {
            console.log(`FAILURE: ${tradeType} - Missing 'quantity' in payload.`);
            return res.status(400).json({ status: 'error', message: 'Missing quantity parameter' });
        }
        
        const numericQuantity = Number(quantity);
        if (isNaN(numericQuantity) || numericQuantity <= 0) {
            console.log(`FAILURE: ${tradeType} - Invalid 'quantity' value provided: ${quantity}`);
            return res.status(400).json({ status: 'error', message: 'Quantity must be a positive number' });
        }
        
        console.log(`SUCCESS: ${tradeType} - Quantity processed: ${numericQuantity}`);
        return res.status(200).json({
            status: 'success',
            message: `${tradeType} processed successfully`,
            quantity: numericQuantity
        });
        
    } catch (error) {
        console.log(`FAILURE: ${tradeType} - Unexpected Error: ${error.message}`);
        return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
};

app.post('/api/buy/call', (req, res) => processTrade(req, res, 'Buy Call'));
app.post('/api/buy/put', (req, res) => processTrade(req, res, 'Buy Put'));
app.post('/api/sell/call', (req, res) => processTrade(req, res, 'Sell Call'));
app.post('/api/sell/put', (req, res) => processTrade(req, res, 'Sell Put'));

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running locally on port ${PORT}`);
    });
}

module.exports = app;
