'use strict';
/* istanbul ignore next */
module.exports = typeof Promise === 'function' ? Promise : require('lie');
