'use strict';

// This test only runs on Node.js
var http = require('http');

var adapters = ['http', 'local'];


adapters.forEach(function (adapter) {

  describe('test.ajax.node.js-' + adapter, function () {

    it('#6815 ajax uses cookies', function (done) {
      var server = http.createServer(function (req, res) {
        if (req.url === '/install-cookie') {
          res.writeHead(200, {'Set-Cookie': 'Test=test; Version=1; Path=/; HttpOnly'});
          res.end(JSON.stringify({ok: true}));
        } else if (req.url === '/check-cookie') {
          res.end(JSON.stringify({ok: req.headers.cookie === 'Test=test'}));
        }
      });
      server.listen(6000, function () {
        testUtils.ajax({
          method: 'GET',
          url: 'http://127.0.0.1:6000/install-cookie',
          timeout: 10
        }, function (err, res) {
          should.equal(res.ok, true, "Server not responding");

          testUtils.ajax({
            method: 'GET',
            url: 'http://127.0.0.1:6000/check-cookie',
            timeout: 10
          }, function (err, res) {
            server.close();

            should.equal(res.ok, true, "Cookie not set");
            done();
          });
        });
      });
    });
  });
});
