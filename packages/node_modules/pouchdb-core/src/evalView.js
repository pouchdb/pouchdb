import vm from 'vm';

function evalView(input) {
  var code = [
    '"use strict";',
    'var emitted = false;',
    'var emit = function (a, b) {',
    '  emitted = true;',
    '};',
    'var view = ' + input + ';',
    'view(doc);',
    'if (emitted) {',
    '  return true;',
    '}'
  ].join('\n');

  return vm.runInNewContext('(function(doc) {\n' + code + '\n})');
}

export default evalView;
