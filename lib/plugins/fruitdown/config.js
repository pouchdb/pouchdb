'use strict';

module.exports = {
  name: 'fruitdown',
  valid: function () {
    return !!global.indexedDB;
  },
  use_prefix: true
};
