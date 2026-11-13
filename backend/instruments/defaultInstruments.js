const { generateExpiriesThrough2027 } = require('./expiryGenerator');

/**
 * Builds standard instrument definitions pre-seeded with all expiries through Dec 2027
 */
function getDefaultInstruments() {
    const today = new Date();
    // Start generating expiries from current date or Nov 1, 2026
    const startDate = new Date(Math.min(today.getTime(), new Date('2026-11-01').getTime()));
    const endDate = new Date('2027-12-31');

    return [
        // ====================================================================
        // 1. INDIAN INDEX DERIVATIVES (NSE & BSE)
        // ====================================================================
        {
            symbol: 'NIFTY',
            name: 'NIFTY 50 Index',
            exchange: 'NSE',
            segment: 'INDEX',
            lot_size: 65, // Specified by user
            tick_size: 0.05,
            strike_interval: 50,
            freeze_limit: 1800,
            weekly_expiry_day: 4, // Thursday
            expiries: generateExpiriesThrough2027({
                weeklyDay: 4,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: false,
                startDate,
                endDate
            })
        },
        {
            symbol: 'BANKNIFTY',
            name: 'NIFTY Bank Index',
            exchange: 'NSE',
            segment: 'INDEX',
            lot_size: 30,
            tick_size: 0.05,
            strike_interval: 100,
            freeze_limit: 900,
            weekly_expiry_day: 4, // Thursday
            expiries: generateExpiriesThrough2027({
                weeklyDay: 4,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: false,
                startDate,
                endDate
            })
        },
        {
            symbol: 'FINNIFTY',
            name: 'NIFTY Financial Services',
            exchange: 'NSE',
            segment: 'INDEX',
            lot_size: 65,
            tick_size: 0.05,
            strike_interval: 50,
            freeze_limit: 1800,
            weekly_expiry_day: 2, // Tuesday
            expiries: generateExpiriesThrough2027({
                weeklyDay: 2,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: false,
                startDate,
                endDate
            })
        },
        {
            symbol: 'MIDCPNIFTY',
            name: 'NIFTY Midcap Select',
            exchange: 'NSE',
            segment: 'INDEX',
            lot_size: 120,
            tick_size: 0.05,
            strike_interval: 25,
            freeze_limit: 4200,
            weekly_expiry_day: 1, // Monday
            expiries: generateExpiriesThrough2027({
                weeklyDay: 1,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: false,
                startDate,
                endDate
            })
        },
        {
            symbol: 'SENSEX',
            name: 'BSE SENSEX Index',
            exchange: 'BSE',
            segment: 'INDEX',
            lot_size: 20,
            tick_size: 0.05,
            strike_interval: 100,
            freeze_limit: 1000,
            weekly_expiry_day: 5, // Friday
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: false,
                startDate,
                endDate
            })
        },
        {
            symbol: 'BANKEX',
            name: 'BSE BANKEX Index',
            exchange: 'BSE',
            segment: 'INDEX',
            lot_size: 30,
            tick_size: 0.05,
            strike_interval: 100,
            freeze_limit: 900,
            weekly_expiry_day: 1, // Monday
            expiries: generateExpiriesThrough2027({
                weeklyDay: 1,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: false,
                startDate,
                endDate
            })
        },

        // ====================================================================
        // 2. TOP INDIAN F&O EQUITIES (Monthly Expiries through Dec 2027)
        // ====================================================================
        ...[
            { symbol: 'RELIANCE', name: 'Reliance Industries', lot_size: 250, strike_interval: 20, freeze_limit: 25000 },
            { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', lot_size: 550, strike_interval: 10, freeze_limit: 27500 },
            { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', lot_size: 700, strike_interval: 10, freeze_limit: 35000 },
            { symbol: 'INFY', name: 'Infosys Ltd', lot_size: 400, strike_interval: 20, freeze_limit: 20000 },
            { symbol: 'TCS', name: 'Tata Consultancy Services', lot_size: 175, strike_interval: 50, freeze_limit: 8750 },
            { symbol: 'SBIN', name: 'State Bank of India', lot_size: 750, strike_interval: 10, freeze_limit: 37500 },
            { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', lot_size: 550, strike_interval: 10, freeze_limit: 27500 },
            { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', lot_size: 475, strike_interval: 20, freeze_limit: 23750 },
            { symbol: 'ITC', name: 'ITC Ltd', lot_size: 1600, strike_interval: 5, freeze_limit: 80000 },
            { symbol: 'LT', name: 'Larsen & Toubro Ltd', lot_size: 150, strike_interval: 25, freeze_limit: 7500 },
            { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', lot_size: 400, strike_interval: 20, freeze_limit: 20000 },
            { symbol: 'AXISBANK', name: 'Axis Bank Ltd', lot_size: 625, strike_interval: 10, freeze_limit: 31250 },
            { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', lot_size: 125, strike_interval: 100, freeze_limit: 6250 },
            { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', lot_size: 50, strike_interval: 100, freeze_limit: 2500 },
            { symbol: 'TITAN', name: 'Titan Company Ltd', lot_size: 175, strike_interval: 25, freeze_limit: 8750 }
        ].map(stock => ({
            ...stock,
            exchange: 'NSE',
            segment: 'EQUITY',
            tick_size: 0.05,
            weekly_expiry_day: 4,
            expiries: generateExpiriesThrough2027({
                weeklyDay: 4,
                mode: 'MONTHLY_ONLY',
                isCrypto: false,
                startDate,
                endDate
            })
        })),

        // ====================================================================
        // 3. DELTA EXCHANGE (Crypto Perpetual Futures & Options)
        // ====================================================================
        {
            symbol: 'BTCUSD',
            name: 'Bitcoin Perpetual & Options',
            exchange: 'DELTA',
            segment: 'CRYPTO',
            lot_size: 1,
            tick_size: 0.5,
            strike_interval: 1000,
            freeze_limit: 100,
            weekly_expiry_day: 5, // Friday 08:00 UTC
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: true,
                startDate,
                endDate
            })
        },
        {
            symbol: 'ETHUSD',
            name: 'Ethereum Perpetual & Options',
            exchange: 'DELTA',
            segment: 'CRYPTO',
            lot_size: 1,
            tick_size: 0.1,
            strike_interval: 50,
            freeze_limit: 1000,
            weekly_expiry_day: 5,
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: true,
                startDate,
                endDate
            })
        },
        {
            symbol: 'SOLUSD',
            name: 'Solana Perpetual & Options',
            exchange: 'DELTA',
            segment: 'CRYPTO',
            lot_size: 1,
            tick_size: 0.05,
            strike_interval: 5,
            freeze_limit: 5000,
            weekly_expiry_day: 5,
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: true,
                startDate,
                endDate
            })
        },
        {
            symbol: 'XRPUSD',
            name: 'Ripple Perpetual Contract',
            exchange: 'DELTA',
            segment: 'CRYPTO',
            lot_size: 10,
            tick_size: 0.0001,
            strike_interval: 0.05,
            freeze_limit: 50000,
            weekly_expiry_day: 5,
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: true,
                startDate,
                endDate
            })
        },
        {
            symbol: 'DOGEUSD',
            name: 'Dogecoin Perpetual Contract',
            exchange: 'DELTA',
            segment: 'CRYPTO',
            lot_size: 100,
            tick_size: 0.0001,
            strike_interval: 0.01,
            freeze_limit: 200000,
            weekly_expiry_day: 5,
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: true,
                startDate,
                endDate
            })
        },
        {
            symbol: 'BNBUSD',
            name: 'BNB Perpetual Contract',
            exchange: 'DELTA',
            segment: 'CRYPTO',
            lot_size: 1,
            tick_size: 0.1,
            strike_interval: 10,
            freeze_limit: 5000,
            weekly_expiry_day: 5,
            expiries: generateExpiriesThrough2027({
                weeklyDay: 5,
                mode: 'WEEKLY_AND_MONTHLY',
                isCrypto: true,
                startDate,
                endDate
            })
        }
    ];
}

module.exports = {
    getDefaultInstruments
};
