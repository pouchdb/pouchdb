'use strict';

module.exports = {
  name: 'localstorage',
  valid: function () {
    return 'localStorage' in window;
  },
  use_prefix: true
};