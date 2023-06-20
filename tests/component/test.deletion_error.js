'use strict';

var PouchDB = require('../../packages/pouchdb-for-coverage');

var express = require('express');
var bodyParser = require('body-parser');

require('chai').should();

var app = express();
app.use(bodyParser.json());

var deleted = false;
app.delete('*', function (req, res, next) {
  if (!deleted) {
    res.status(500).send({message: 'Oops'});
    deleted = true;
    return;
  }
  next();
});

app.use(require('pouchdb-express-router')(PouchDB));

describe('test.deletion_error.js', function () {
  var server;

  before(function () {
    server = app.listen(0);
  });

  after(function () {
    return server.close();
  });

  it('Test error during deletion', function () {

    var url = 'http://127.0.0.1:' + server.address().port + '/remote';
    var db = new PouchDB(url);

    return db.post({foo: 'bar'}).then(function () {
    }).then(function () {
      return db.destroy();
    }).catch(function (err) {
      err.status.should.equal(500);
    }).then(function () {
      return db.destroy();
    });
  });
});
