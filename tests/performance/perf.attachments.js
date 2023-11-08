'use strict';

const MIME_OCTET = 'application/octet-stream';

function randomBrowserBlob(size) {
  var buff = new ArrayBuffer(size);
  var arr = new Uint8Array(buff);
  for (var i = 0; i < size; i++) {
    arr[i] = Math.floor(65535 * Math.random());
  }
  return new Blob([buff], {type: MIME_OCTET});
}

function randomBuffer(size) {
  var buff = Buffer.alloc(size);
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

module.exports = function (PouchDB, callback) {

  var utils = require('./utils');

  var testCases = [
    {
      name: 'basic-attachments',
      assertions: 1,
      iterations: 1000,
      setup: function (db, _, callback) {

        var blob = randomBlob(50000);
        db._blob = blob;
        callback();
      },
      test: function (db, itr, doc, done) {
        db.putAttachment(Math.random().toString(), 'foo.txt', db._blob,
          MIME_OCTET).then(function () {
          done();
        }, done);
      }
    },
    {
      name: 'many-attachments-base64',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        const doc = {
          _id: 'doc1',
          _attachments: {},
        };
        for (let i=0; i<100; ++i) {
          doc._attachments['att-' + i] = {
            content_type: MIME_OCTET,
            data: randomBlob(50000),
          };
        }
        db.put(doc).then(() => callback()).catch(callback);
      },
      test: function (db, itr, doc, done) {
        db.get('doc1', {attachments: true}).then(() => done()).catch(done);
      }
    },
    {
      name: 'many-attachments-binary',
      assertions: 1,
      iterations: 100,
      setup: function (db, _, callback) {
        const doc = {
          _id: 'doc1',
          _attachments: {},
        };
        for (let i=0; i<100; ++i) {
          doc._attachments['att-' + i] = {
            content_type: MIME_OCTET,
            data: randomBlob(50000),
          };
        }
        db.put(doc).then(() => callback()).catch(callback);
      },
      test: function (db, itr, doc, done) {
        db.get('doc1', {attachments: true, binary: true}).then(() => done()).catch(done);
      }
    },
  ];

  utils.runTests(PouchDB, 'attachments', testCases, callback);

};
