/*
	Copyright 2014, Marten de Vries

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

"use strict";

var nodify = require('promise-nodify');
var route = require('pouchdb-route');
var querystring = require('querystring');

module.exports = function (PouchDB) {
  PouchDB.virtualHost = function (req, vhosts, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (typeof options === 'undefined') {
      options = {};
    }

    var url = PouchDB.resolveVirtualHost(req, vhosts);
    var path = url.split("?")[0];
    var qs = url.split("?")[1];
    var newReq = {
      path: splitUrl(path),
      query: querystring.parse(qs),
      raw_path: req.raw_path,
      requested_path: splitUrl(req.raw_path),
      method: 'GET'
    };
    var promise = route(PouchDB, newReq, options);

    nodify(promise, callback);
    return promise;
  };

  PouchDB.resolveVirtualHost = function (req, vhosts) {
    var headers = req.headers || {};
    var hostHeader = splitHost(headers.Host || headers.host || '');
    var match, targetParts;
    for (var unsplittedVHost in vhosts) {
      /* istanbul ignore else */
      if (vhosts.hasOwnProperty(unsplittedVHost)) {
        var vhost = splitHost(unsplittedVHost);
        targetParts = splitUrl(vhosts[unsplittedVHost]);

        match = findMatch(hostHeader, vhost);
        if (match) {
          break;
        }
      }
    }
    var path = '';
    if (match) {
      path = '/' + targetParts.map(function (part) {
        return match.bindings[part] || part;
      }).join('/');
    }
    //no vhosts matched
    return path + req.raw_path;
  };
};

function splitHost(host) {
  return host.split('.');
}

function splitUrl(url) {
  return url.split('/').filter(function (part) {
    return part;
  });
}

function findMatch(hostHeader, vhost) {
  if (hostHeader.length !== vhost.length) {
    return;
  }
  var match = {bindings: {}};

  for (var i = 0; i < hostHeader.length; i++) {
    if (vhost[i] === '*' || vhost[i][0] === ':') {
      match.bindings[vhost[i]] = hostHeader[i];
    } else if (vhost[i] !== hostHeader[i]) {
      return;
    }
  }
  return match;
}
