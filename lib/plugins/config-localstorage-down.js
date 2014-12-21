'use strict';

module.exports = {
  name: 'localstorage',
  valid: function () {
    return typeof window !== 'undefined' && 'localStorage' in window;
  },
  use_prefix: true
};