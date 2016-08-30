import vm from 'vm';

function evalFilter(input) {
  var code = '(function() {\n"use strict";\nreturn ' + input + '\n})()';

  return vm.runInNewContext(code);
}

export default evalFilter;
