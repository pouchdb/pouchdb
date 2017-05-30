'use strict';

var PouchDB = require('../../packages/pouchdb-for-coverage');
var express = require('express');
var bodyParser = require('body-parser');

require('chai').should();

var app = express();

app.use(bodyParser.json());
app.use(require('pouchdb-express-router')(PouchDB));


describe('test.memleak.js', function () {

  var server;

  before(function () {
    server = app.listen(0);
  });

  after(function () {
    return server.close();
  });

  it('Test basic memory leak', function (done) {

    var host = 'http://127.0.0.1:' + server.address().port + '/';
    var heapUsed = null;

    var interval = setInterval(function () {

      global.gc();

      var db = new PouchDB('goodluck');

      var memory = process.memoryUsage();
      var last_heapUsed = heapUsed;
      heapUsed = memory.heapUsed;

      if (last_heapUsed !== null) {

        console.log('difference is', heapUsed - last_heapUsed);

        if (heapUsed - last_heapUsed === 0) {
          clearInterval(interval);
          db.destroy(function() { done(); });
        }
      }

    }, 10);
  });


});

