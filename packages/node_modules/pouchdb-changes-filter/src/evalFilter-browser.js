import { scopeEval } from 'pouchdb-utils';

function evalFilter(input) {
  return scopeEval('"use strict";\nreturn ' + input + ';', {});
}

export default evalFilter;
