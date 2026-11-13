const { isIndianTradingHoliday } = require('./holidays');

const MONTH_NAMES_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Formats a Date object to YYYY-MM-DD in Asia/Kolkata timezone
 */
function toDateStr(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formats date into standard exchange contract code: DDMMMYY (e.g. 26NOV26)
 */
function toContractCode(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const mStr = MONTH_NAMES_SHORT[d.getMonth()];
    const yr = String(d.getFullYear()).slice(-2);
    return `${day}${mStr}${yr}`;
}

/**
 * Formats date for display: "26 Nov 2026"
 */
function toDisplayDate(d) {
    const day = d.getDate();
    const mStr = MONTH_NAMES_SHORT[d.getMonth()];
    const yr = d.getFullYear();
    return `${day} ${mStr} ${yr}`;
}

/**
 * Checks if a given date is a valid Indian stock market trading day (not weekend, not holiday)
 */
function isValidIndianTradingDay(d) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Sunday or Saturday
    const dateStr = toDateStr(d);
    return !isIndianTradingHoliday(dateStr);
}

/**
 * Adjusts an expiry date: if falls on holiday or weekend, rolls back to preceding valid trading day
 */
function adjustToTradingDay(d, isCrypto = false) {
    if (isCrypto) {
        // Crypto trades 24/7/365 with zero holidays
        return new Date(d);
    }
    const current = new Date(d);
    while (!isValidIndianTradingDay(current)) {
        current.setDate(current.getDate() - 1);
    }
    return current;
}

/**
 * Finds the last occurrence of a given day-of-week in a month (e.g. Last Thursday)
 */
function getLastWeekdayOfMonth(year, monthIndex, targetWeekday) {
    // Start from last day of the month
    const d = new Date(year, monthIndex + 1, 0);
    while (d.getDay() !== targetWeekday) {
        d.setDate(d.getDate() - 1);
    }
    return d;
}

/**
 * Generates all expiry dates through December 31, 2027
 * 
 * @param {Object} options
 * @param {number} [options.weeklyDay=4] - 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
 * @param {string} [options.mode='WEEKLY_AND_MONTHLY'] - 'WEEKLY_AND_MONTHLY' or 'MONTHLY_ONLY'
 * @param {boolean} [options.isCrypto=false]
 * @param {Date} [options.startDate]
 * @param {Date} [options.endDate]
 * @returns {Array<{date: string, code: string, display: string, is_monthly: boolean}>}
 */
function generateExpiriesThrough2027(options = {}) {
    const {
        weeklyDay = 4, // Thursday by default
        mode = 'WEEKLY_AND_MONTHLY',
        isCrypto = false,
        startDate = new Date(2026, 10, 1), // Nov 1, 2026
        endDate = new Date(2027, 11, 31)   // Dec 31, 2027
    } = options;

    const expiries = [];
    const seenDates = new Set();

    // Map monthly last Thursdays/Fridays for each month between startDate and endDate
    const monthlyLastDates = new Map();
    let iterMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (iterMonth <= endMonth) {
        const y = iterMonth.getFullYear();
        const m = iterMonth.getMonth();
        const rawMonthlyDay = getLastWeekdayOfMonth(y, m, weeklyDay);
        const adjustedMonthly = adjustToTradingDay(rawMonthlyDay, isCrypto);
        monthlyLastDates.set(`${y}-${m}`, toDateStr(adjustedMonthly));
        iterMonth.setMonth(iterMonth.getMonth() + 1);
    }

    if (mode === 'MONTHLY_ONLY') {
        for (const [key, dateStr] of monthlyLastDates.entries()) {
            const [yStr, mStr] = key.split('-');
            const y = parseInt(yStr, 10);
            const m = parseInt(mStr, 10);
            const parts = dateStr.split('-');
            const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

            if (dObj >= startDate && dObj <= endDate && !seenDates.has(dateStr)) {
                seenDates.add(dateStr);
                expiries.push({
                    date: dateStr,
                    code: toContractCode(dObj),
                    display: toDisplayDate(dObj),
                    is_monthly: true
                });
            }
        }
    } else {
        // Step day-by-day looking for weeklyDay
        const cur = new Date(startDate);
        // Align to start of day
        cur.setHours(0, 0, 0, 0);

        while (cur <= endDate) {
            if (cur.getDay() === weeklyDay) {
                const adjusted = adjustToTradingDay(cur, isCrypto);
                const dateStr = toDateStr(adjusted);

                if (adjusted >= startDate && adjusted <= endDate && !seenDates.has(dateStr)) {
                    seenDates.add(dateStr);
                    const y = cur.getFullYear();
                    const m = cur.getMonth();
                    const isMonthly = monthlyLastDates.get(`${y}-${m}`) === dateStr;

                    expiries.push({
                        date: dateStr,
                        code: toContractCode(adjusted),
                        display: toDisplayDate(adjusted),
                        is_monthly: isMonthly
                    });
                }
            }
            cur.setDate(cur.getDate() + 1);
        }
    }

    // Sort chronologically
    expiries.sort((a, b) => a.date.localeCompare(b.date));
    return expiries;
}

module.exports = {
    generateExpiriesThrough2027,
    toDateStr,
    toContractCode,
    toDisplayDate,
    isValidIndianTradingDay,
    adjustToTradingDay
};
