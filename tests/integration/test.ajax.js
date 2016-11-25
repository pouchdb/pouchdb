'use strict';

var adapters = ['http', 'local'];


adapters.forEach(function (adapter) {

  describe('test.ajax.js-' + adapter, function () {

    it('#5061 ajax returns ETIMEDOUT error on timeout', function (done) {
      this.timeout(240000);
      testUtils.ajax({
        method: 'GET',
        url: 'http://192.0.2.1/',
        timeout: 10
      }, function (err, res) {
        // here's the test, we should get an 'err' response
        should.exist(err);
        if (err.code) { // xhr
          err.code.should.match(/(ESOCKETTIMEDOUT|ETIMEDOUT|ENETUNREACH|EAGAIN|ECONNREFUSED)/);
        } else { // fetch
          err.status.should.equal(500);
        }
        should.not.exist(res);
        done();
      });
    });
  });
});

