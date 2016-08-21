function evalView(input) {
  /* jshint evil:true */
  return new Function('doc', [
    'var emitted = false;',
    'var emit = function (a, b) {',
    '  emitted = true;',
    '};',
    'var view = ' + input + ';',
    'view(doc);',
    'if (emitted) {',
    '  return true;',
    '}'
  ].join('\n'));
}

export default evalView;