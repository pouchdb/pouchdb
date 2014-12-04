'use strict';

module.exports = {
  name: 'localstorage',
  valid: function () {
    return 'localStorage' in global;
  },
  use_prefix: true
};