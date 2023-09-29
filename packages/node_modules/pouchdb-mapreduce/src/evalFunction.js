import evalFunctionWithVm from './evalFunctionInVm';
import evalFunctionWithEval from './evalFunctionWithEval';

// The "stringify, then execute in a VM" strategy totally breaks Istanbul due
// to missing __coverage global objects. As a solution, export different
// code during coverage testing and during regular execution.
// Note that this doesn't get shipped to consumers because Rollup replaces it
// with rollup-plugin-replace, so process.env.COVERAGE is replaced with `false`
var evalFunc;
/* istanbul ignore else */
if (process.env.COVERAGE) {
  evalFunc = evalFunctionWithEval;
} else {
  evalFunc = evalFunctionWithVm;
}

export default evalFunc;
