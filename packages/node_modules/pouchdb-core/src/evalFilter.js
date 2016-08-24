import scopedEval from 'scope-eval';

function evalFilter(input) {
  return scopedEval('return ' + input + ';', {});
}

export default evalFilter;