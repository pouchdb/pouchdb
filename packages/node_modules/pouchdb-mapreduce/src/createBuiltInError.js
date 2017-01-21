import { BuiltInError } from 'pouchdb-mapreduce-utils';

function createBuiltInError(name) {
  var message = 'builtin ' + name +
    ' function requires map values to be numbers' +
    ' or number arrays';
  return new BuiltInError(message);
}

export default createBuiltInError;
