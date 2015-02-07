/* jshint worker: true */
'use strict';

function bigTest(name) {
  new PouchDB(name, function (err, db) {
    if (err) {
      throw err;
    }
    db.post({
      _id: 'blablah',
      key: 'lala'
    }, function (err) {
      if (err) {
        throw err;
      }
      db.get('blablah', function (err, doc) {
        if (err) {
          throw err;
        }
        self.postMessage(doc.key);
        db.destroy();
      });
    });
  });
}

function allDocs(name) {
  new PouchDB(name, function (err, db) {
    if (err) {
      throw err;
    }
    db.post({
      _id: 'blah',
      title: 'lalaa',
      _attachments: {
        'test': {
          data: new Blob(),
          content_type: ''
        }
      }
    }, function(err, doc) {
      db.get(doc.id, function (err, doc) {
        if (err) {
          throw err;
        }
        self.postMessage(doc);
        db.destroy();
      });
    });
  });
}

self.addEventListener('message', function (e) {
  if (typeof e.data === 'string' && e.data.indexOf('/dist/') > -1) {
    importScripts(e.data);
  }
  if (e.data === 'ping') {
    self.postMessage('pong');
  }
  if (e.data === 'version') {
    self.postMessage(PouchDB.version);
  }
  if (Array.isArray(e.data) && e.data[0] === 'create') {
    bigTest(e.data[1]);
  }
  if (Array.isArray(e.data) && e.data[0] === 'allDocs') {
    allDocs(e.data[1]);
  }
});
