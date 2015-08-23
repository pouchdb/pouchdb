'use strict';

module.exports = function () {
  if ('console' in global && 'error' in console) {
    console.error('PouchDB error: the remote database does not seem to have ' +
      'CORS enabled. To fix this, please enable CORS: ' +
      'http://pouchdb.com/errors.html#no_access_control_allow_origin_header');
  }
};