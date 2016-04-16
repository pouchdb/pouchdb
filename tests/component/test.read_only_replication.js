'use strict';

var PouchDB = require('../../lib');
var Checkpointer = require('../../lib/extras/checkpointer');

var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.json());

var replicationDoc;

function reject(req, res) {
  replicationDoc = req.body.docs[0];
  res.status(403).send({error: true, message: 'Unauthorized'});
}

app.post('*', reject);
app.delete('*', reject);
app.put('*', reject);
app.use(require('pouchdb-express-router')(PouchDB));

require('chai').should();

describe('test.read_only_replication.js', function () {
  var server;

  before(function () {
    server = app.listen(0);
  });

  after(function () {
    return server.close();
  });

  it('Test checkpointer handles error codes', function () {
    var db = new PouchDB('test');

    // These are the same, but one goes over HTTP so that we have the
    // above access control
    var remote = new PouchDB('remote');
    var remoteHTTP = new PouchDB('http://127.0.0.1:' + server.address().port +
                                 '/remote');

    var expectedLastSeq;
    var checkpointer;

    return remote.bulkDocs([{_id: 'foo'}, {_id: 'bar'}]).then(function () {
      return db.replicate.from(remoteHTTP);
    }).then(function (replicationResult) {
      expectedLastSeq = replicationResult.last_seq;
      checkpointer = new Checkpointer(remoteHTTP, db, replicationDoc._id,
                                      replicationResult);

      return checkpointer.getCheckpoint().then(function (actualLastSeq) {
        actualLastSeq.should.equal(expectedLastSeq);
      });
    }).then(function () {
      return remote.destroy();
    }).then(function () {
      // By now, the checkpointer should have marked the source database
      // read-only, and make no other request to read or write a
      // replication log from or rather to it. We therefore expect
      // `checkpointer.getCheckpoint()` to resolve with the same result
      // as previously, even though the source database has now been
      // destroyed.
      return checkpointer.getCheckpoint().then(function (actualLastSeq) {
        actualLastSeq.should.equal(expectedLastSeq);
      });
    }).then(function () {
      return db.destroy();
    });
  });
});
