var path    = require('path')
  , fs      = require('fs')
  , cfg     = JSON.parse(
    fs.readFileSync(path.join(__dirname, '/fixtures/cfg.json')))
  , nano     = require('../nano')
  , helpers  = exports
  ;

function endsWith (string, ending) {
  return string.length >= ending.length && 
    string.substr(string.length - ending.length) == ending;
}

function noop(){}

function fake_chain() {
  return {
      "get"                  : fake_chain
    , "post"                 : fake_chain
    , "delete"               : fake_chain
    , "put"                  : fake_chain
    , "intercept"            : fake_chain
    , "done"                 : fake_chain
    , "isDone"               : function () { return true; }
    , "filteringPath"        : fake_chain
    , "filteringRequestBody" : fake_chain
    , "matchHeader"          : fake_chain
    , "defaultReplyHeaders"  : fake_chain
    , "log"                  : fake_chain
  };
}

helpers.timeout = cfg.timeout;
helpers.nano    = nano(cfg.couch);
helpers.Nano    = nano;
helpers.couch   = cfg.couch;
helpers.admin   = cfg.admin;
helpers.pixel   = "Qk06AAAAAAAAADYAAAAoAAAAAQAAAP////8BABgAAAAA" + 
                  "AAAAAAATCwAAEwsAAAAAAAAAAAAAWm2CAA==";

var auth        = require("url").parse(cfg.admin).auth.split(":");

helpers.username = auth[0];
helpers.password = auth[1];

helpers.loadFixture = function helpersLoadFixture(filename, json) {
  var contents = fs.readFileSync(
    path.join(__dirname, 'fixtures', filename), (json ? 'ascii' : null));
  return json ? JSON.parse(contents): contents;
};

helpers.nock = function helpersNock(url, fixture) {
  if(process.env.NOCK) {
    var nock    = require('nock')
      , nocks   = helpers.loadFixture(fixture + '.json', true)
      ;
    nocks.forEach(function(n) {
      var npath      = n.path
        , method     = n.method     || "get"
        , status     = n.status     || 200
        , response   = n.buffer
                     ? endsWith(n.buffer, '.png') 
                       ? helpers.loadFixture(n.buffer)
                       : new Buffer(n.buffer, 'base64')
                     : n.response || ""
        , headers    = n.headers    || {}
        , reqheaders = n.reqheaders || {}
        , body       = n.base64
                     ? new Buffer(n.base64, 'base64').toString()
                     : n.body       || ""
        ;

      if(typeof response === "string" && endsWith(response, '.json')) {
        response = helpers.loadFixture(path.join(fixture, response));
      }
      if(typeof headers === "string" && endsWith(headers, '.json')) {
        headers = helpers.loadFixture(path.join(fixture, headers));
      }

      if(body==="*") {
        nock(url).filteringRequestBody(function() {
          return "*";
        })[method](npath, "*").reply(status, response, headers);
      } else {
        var nk = nock(url);
        if(reqheaders !== {}) {
          for (var k in reqheaders) {
            nk = nk.matchHeader(k, reqheaders[k]);
          }
        }
        nk.intercept(npath, method, body).reply(status, response, headers);
      }
    });
    nock(url).log(console.log);
    return nock(url);
  } else {
    return fake_chain();
  }
};