'use strict';

if (typeof global.Promise === 'function') {
  module.exports = global.Promise;
} else {
  module.exports = require('bluebird');
}
