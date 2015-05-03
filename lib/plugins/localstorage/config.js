'use strict';

module.exports = {
  name: 'localstorage',
  valid: function () {
    return typeof localStorage !== 'undefined';
  },
  use_prefix: true
};
