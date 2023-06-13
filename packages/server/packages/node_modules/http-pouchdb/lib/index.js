"use strict";

var XHR = global.XMLHttpRequest;

/* istanbul ignore else */
if (typeof XHR === "undefined") {
  XHR = require('xhr2');
}
var Promise = require('bluebird');
var extend = require('extend');
var wrappers = require('pouchdb-wrappers');
var basicAuthHeader = require('basic-authorization-header');

module.exports = function (PouchDB, url, opts) {
  var api = {};

  api.allDbs = function () {
    return new Promise(function (resolve) {
      var xhr = new XHR();
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          resolve(JSON.parse(xhr.responseText));
        }
      };
      xhr.open('GET', url + '_all_dbs');

      if (opts && opts.auth) {
        xhr.setRequestHeader('Authorization', basicAuthHeader(opts.auth.username, opts.auth.password));
      }

      xhr.send();
    });
  };

  var HTTPPouchDB = PouchDB.defaults(extend({}, opts, {
    prefix: url,
  }));

  // https://github.com/marten-de-vries/http-pouchdb/issues/1
  HTTPPouchDB.adapters.http.use_prefix = false;

  /* istanbul ignore next */
  // noop that can be 'wrapped' soon
  HTTPPouchDB.allDbs = function () {};
  wrappers.installStaticWrapperMethods(HTTPPouchDB, api);

  HTTPPouchDB.isHTTPPouchDB = true;
  return HTTPPouchDB;
};
