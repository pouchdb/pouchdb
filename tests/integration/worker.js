/* jshint worker: true */
'use strict';

function onError(err) {
  setTimeout(function () {
    throw err; // can catch this in the worker's 'error' listener
  }, 0);
}

function bigTest(name) {
  var db = new PouchDB(name);
  db.post({
    _id: 'blablah',
    key: 'lala'
  }).then(function () {
    return db.get('blablah');
  }).then(function (doc) {
    return db.destroy().then(function () {
      self.postMessage(doc.key);
    });
  }).catch(onError);
}

function allDocs(name) {
  var db = new PouchDB(name);
  db.post({
    _id: 'blah',
    title: 'lalaa',
    _attachments: {
      'test': {
        data: new Blob(),
        content_type: ''
      }
    }
  }).then(function () {
    return db.get('blah');
  }).then(function (doc) {
    return db.destroy().then(function () {
      self.postMessage(doc);
    });
  }).catch(onError);
}

function putAttachment(name, docId, attId, att, type) {
  var db = new PouchDB(name);
  db.putAttachment(docId, attId, att, type).then(function () {
    return db.getAttachment(docId, attId);
  }).then(function (fetchedAtt) {
    return db.destroy().then(function () {
      self.postMessage(fetchedAtt);
    });
  }).catch(onError);
}

self.addEventListener('message', function (e) {
  if (Array.isArray(e.data) && e.data[0] === 'source') {
    importScripts(e.data[1]);
  } else if (e.data === 'ping') {
    self.postMessage('pong');
  } else if (e.data === 'version') {
    self.postMessage(PouchDB.version);
  } else if (Array.isArray(e.data) && e.data[0] === 'create') {
    bigTest(e.data[1]);
  } else if (Array.isArray(e.data) && e.data[0] === 'allDocs') {
    allDocs(e.data[1]);
  } else if (Array.isArray(e.data) && e.data[0] === 'putAttachment') {
    putAttachment(e.data[1], e.data[2], e.data[3], e.data[4], e.data[5]);
  } else {
    onError(new Error('unknown message: ' + JSON.stringify(e.data)));
  }

});
