'use strict';

module.exports = function generateCode(combo) {
  var str = '\'use strict\';\n' +
    '\n' +
    'var PouchDB = require(\'pouchdb/custom/pouchdb\');\n' +
    '\n';
  for (var i = 0; i < combo.length; i++) {
    var option = combo[i];
    str += option.code + '\n';
  }
  str += '\n' +
    'module.exports = PouchDB;';
  return str;
};