'use strict';

var utils = require('./pouch-utils');

exports.sayHello = utils.toPromise(function (callback) {
  //
  // You can use the following code to 
  // get the pouch or PouchDB objects
  //
  // var pouch = this;
  // var PouchDB = pouch.constructor;

  callback(null, 'hello');
});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
