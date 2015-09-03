'use strict';

module.exports = function () {
  if ('console' in global && 'warn' in console) {
    console.warn('PouchDB: the remote database may not have CORS enabled.' +
      'If not please enable CORS: ' +
      'http://pouchdb.com/errors.html#no_access_control_allow_origin_header');
  }
};
