'use strict';

var vm = require('vm');

function evalSafely(code) {
  return vm.runInNewContext('(function() {"use strict"; return ' +
    code +
    ';})()');
}

module.exports = evalSafely;