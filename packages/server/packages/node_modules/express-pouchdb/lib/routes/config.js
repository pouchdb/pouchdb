"use strict";

var utils = require('../utils');

module.exports = function (app) {
  utils.requires(app, 'config-infrastructure');

  // Config
  app.get('/_config', function (req, res) {
    utils.sendJSON(res, 200, app.couchConfig.getAll());
  });

  app.get('/_config/:section', function (req, res) {
    utils.sendJSON(res, 200, app.couchConfig.getSection(req.params.section));
  });

  app.get('/_config/:section/:key', function (req, res) {
    var value = app.couchConfig.get(req.params.section, req.params.key);
    sendConfigValue(res, value);
  });

  function sendConfigValue(res, value) {
    if (typeof value === "undefined") {
      return utils.sendJSON(res, 404, {
        error: "not_found",
        reason: "unknown_config_value"
      });
    }
    if (typeof value !== 'string') {
      value = JSON.stringify(value);
    }
    utils.sendJSON(res, 200, value);
  }

  function putHandler(req, res) {
    // Custom JSON parsing, because the default JSON body parser
    // middleware only supports JSON lists and objects. (Not numbers etc.)
    var value;
    try {
      value = JSON.parse(req.rawBody.toString('utf-8'));
    } catch (err) {
      return utils.sendJSON(res, 400, {
        error: "bad_request",
        reason: "invalid_json"
      });
    }
    if (typeof value !== "string") {
      return utils.sendJSON(res, 500, {
        error: "unknown_error",
        reason: "badarg"
      });
    }
    var section = req.params.section;
    var key = req.params.key;
    if (!whitelisted(section, key)) {
      return sendModificationNotAllowed(res);
    }
    try {
      value = JSON.parse(value);
    } catch (err) {}

    function cb(err, oldValue) {
      utils.sendJSON(res, 200, oldValue || "");
    }
    app.couchConfig.set(section, key, value, cb);
  }
  app.put('/_config/:section/:key', utils.parseRawBody, putHandler);

  app.delete('/_config/:section/:key', function (req, res) {
    var section = req.params.section;
    var key = req.params.key;
    if (!whitelisted(section, key)) {
      return sendModificationNotAllowed(res);
    }
    app.couchConfig.delete(section, key, function (err, oldValue) {
      sendConfigValue(res, oldValue);
    });
  });

  function getWhitelist() {
    // parses an erlang term like:
    //  [{httpd,config_whitelist}, {<<"test">>,<<"foo">>}]
    // into a JS array like:
    //  [['httpd', 'config_whitelist'], ['test', 'foo']]
    //
    // returns undefined when a parse error occurs, or when there is
    // no whitelist
    var val = app.couchConfig.get('httpd', 'config_whitelist');
    val = (val || '').trim();
    if (!val) {
      return;
    }
    if (val[0] + val[val.length - 1] !== '[]') {
      // invalid syntax
      return;
    }
    val = val.slice(1, -1).trim();
    var whitelist = [];
    if (!val) {
      return whitelist;
    }

    var foundAtLeastOneMatch = false;
    var re = /{([^}]*)}/g;
    var match;
    while ((match = re.exec(val))) {
      foundAtLeastOneMatch = true;

      var part = match[1];
      var subParts = parseToJSStrings(part.split(','));
      if (subParts.length !== 2) {
        // invalid syntax
        return;
      }
      whitelist.push(subParts);
    }
    if (foundAtLeastOneMatch) {
      return whitelist;
    }
    // invalid syntax, return undefined
  }

  function whitelisted(section, key) {
    var wl = getWhitelist();
    if (!wl) {
      // when the whitelist doesn't exist or can't be parsed every
      // change is allowed
      return true;
    }
    // only section/key pairs on the whitelist are allowed when there is
    // one
    return wl.some(function (item) {
      return item[0] === section && item[1] === key;
    });
  }
};

function parseToJSStrings(erlangStrings) {
  return erlangStrings.map(function (str) {
    return str.trim();
  }).map(function (str) {
    // "string" -> string
    return (/"([^"]*)"/.exec(str) || {})[1] || str;
  }).map(function (str) {
    // <<"string">> -> string
    return (/<<"([^"]*)">>/.exec(str) || {})[1] || str;
  });
}

function sendModificationNotAllowed(res) {
  utils.sendJSON(res, 400, {
    name: "modification_not_allowed",
    reason: "This config variable is read-only"
  });
}
