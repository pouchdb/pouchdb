'use strict';

import openDatabase from 'websql'; // nodejs version of websql

function createOpenDBFunction() {
  return function openDB(opts) {
    return openDatabase(opts.name, opts.version, opts.description, opts.size);
  };
}

export default createOpenDBFunction;