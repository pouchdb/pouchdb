var specify  = require('specify')
  , helpers  = require('../helpers')
  , timeout  = helpers.timeout
  , nano     = helpers.nano
  , Nano     = helpers.Nano
  , nock     = helpers.nock
  ;

var mock = nock(helpers.couch, "shared/config");

specify("shared_config:root", timeout, function (assert) {
  nano.dinosaur('', function (err, response) {
    assert.equal(err, undefined, "Failed to get root");
    assert.ok(response.version, "Version is defined");
  });
  nano.relax(function (err, response) {
    assert.equal(err, undefined, "Failed to get root");
    assert.ok(response.version, "Version is defined");
  });
});

specify("shared_config:url_parsing", timeout, function (assert) {
  var base_url = 'http://someurl.com';

  assert.equal(Nano(base_url).config.url, base_url, "Simple URL failed");
  assert.equal(
    Nano(base_url+'/').config.url, base_url+'/', "Simple URL with / failed");
  assert.equal(
    Nano('http://a:b@someurl.com:5984').config.url,
    'http://a:b@someurl.com:5984', "Auth failed");
  assert.equal(
    Nano(base_url+':5984/a').config.url, base_url+':5984', 
    "Port failed");
  assert.equal(
    Nano(base_url+'/a').config.url, base_url, "Simple db failed");
});

specify.run(process.argv.slice(2));