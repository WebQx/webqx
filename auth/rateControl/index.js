/**
 * Rate Control Module Index
 * Exports token-based rate control components
 */

const TokenBasedRateControl = require('./tokenBasedRateControl');
const RateControlMiddleware = require('./rateControlMiddleware');

module.exports = {
    TokenBasedRateControl,
    RateControlMiddleware
};