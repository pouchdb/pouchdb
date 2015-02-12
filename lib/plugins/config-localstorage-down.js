'use strict';

module.exports = {
  name: 'localstorage',
  require: 'localstorage-down',
  valid: function () {
    return typeof localStorage !== 'undefined';
  },
  use_prefix: true
};
