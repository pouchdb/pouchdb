'use strict';

function randomBrowserBlob(size) {
  var buff = new ArrayBuffer(size);
  var arr = new Uint8Array(buff);
  for (var i = 0; i < size; i++) {
    arr[i] = Math.floor(65535 * Math.random());
  }
  return new Blob([buff], {type: 'application/octet-stream'});
}

function randomBuffer(size) {
  var buff = new Buffer(size);
  for (var i = 0; i < size; i++) {
    buff.write(
      String.fromCharCode(Math.floor(65535 * Math.random())),
      i, 1, 'binary');
  }
  return buff;
}


function randomBlob(size) {
  if (process.browser) {
    return randomBrowserBlob(size);
  } else { // node
    return randomBuffer(size);
  }
}

module.exports = function (PouchDB, opts) {

  // need to use bluebird for promises everywhere, so we're comparing
  // apples to apples
  require('bluebird'); // var Promise = require('bluebird');
  var utils = require('./utils');

  var testCases = [
    {
      name: 'basic-attachments',
      assertions: 1,
      iterations: 1000,
      setup: function (db, callback) {

        var blob = randomBlob(50000);
        db._blob = blob;
        callback();
      },
      test: function (db, itr, doc, done) {
        db.putAttachment(Math.random().toString(), 'foo.txt', db._blob,
          'application/octet-stream').then(function () {
          done();
        }, done);
      }
    }
  ];

  utils.runTests(PouchDB, 'views', testCases, opts);

};
