/**
 * Indian Stock Market (NSE & BSE) Trading Holidays for 2026 and 2027
 * Standard exchange holidays when trading is closed and derivatives expiries roll to preceding day.
 */

const INDIAN_TRADING_HOLIDAYS = new Set([
    // 2026 Holidays
    '2026-01-26', // Republic Day
    '2026-03-03', // Mahashivratri
    '2026-03-20', // Id-Ul-Fitr (Ramzan Id)
    '2026-03-25', // Holi
    '2026-04-03', // Good Friday
    '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
    '2026-05-01', // Maharashtra Day
    '2026-05-27', // Bakri Id / Eid ul-Adha
    '2026-06-26', // Muharram
    '2026-08-15', // Independence Day
    '2026-08-26', // Milad-un-Nabi
    '2026-10-02', // Mahatma Gandhi Jayanti
    '2026-10-20', // Dussehra
    '2026-11-08', // Diwali Laxmi Pujan (Special Muhurat Trading only)
    '2026-11-10', // Diwali Balipratipada
    '2026-11-24', // Gurunanak Jayanti
    '2026-12-25', // Christmas

    // 2027 Holidays
    '2027-01-26', // Republic Day
    '2027-02-23', // Mahashivratri
    '2027-03-10', // Id-Ul-Fitr
    '2027-03-15', // Holi
    '2027-03-26', // Good Friday
    '2027-04-14', // Dr. Ambedkar Jayanti
    '2027-05-01', // Maharashtra Day
    '2027-05-17', // Bakri Id
    '2027-06-16', // Muharram
    '2027-08-15', // Independence Day
    '2027-08-16', // Milad-un-Nabi
    '2027-10-02', // Mahatma Gandhi Jayanti
    '2027-10-09', // Dussehra
    '2027-10-28', // Diwali Balipratipada
    '2027-11-14', // Gurunanak Jayanti
    '2027-12-25'  // Christmas
]);

/**
 * Checks if a given date string (YYYY-MM-DD) is a trading holiday
 * @param {string} dateStr
 * @returns {boolean}
 */
function isIndianTradingHoliday(dateStr) {
    return INDIAN_TRADING_HOLIDAYS.has(dateStr);
}

module.exports = {
    INDIAN_TRADING_HOLIDAYS,
    isIndianTradingHoliday
};
