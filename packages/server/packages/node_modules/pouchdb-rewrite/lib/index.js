/*
	Copyright 2014-2015, Marten de Vries

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

/*
  Nice extras/TODO:

  - secure_rewrite; false by default is ok, but it might be nice to be
    able to set it to true as an option.
  - loop protection.

  Tests for all those can be found in the final part of the CouchDB
  rewrite tests, which haven't (yet) been ported to Python/this plug-in.
*/

'use strict';

var couchdb_objects = require('couchdb-objects');
var nodify = require('promise-nodify');
var httpQuery = require('pouchdb-req-http-query');
var extend = require('extend');
var PouchPluginError = require('pouchdb-plugin-error');
var routePouchDB = require('pouchdb-route');

exports.rewriteResultRequestObject = function (rewritePath, options, callback) {
  var args = parseArgs(this, rewritePath, options, callback);
  var p = buildRewriteResultReqObj(args.db, args.designDocName, args.rewriteUrl, args.options);
  nodify(p, callback);
  return p;
};

function parseArgs(db, rewritePath, options, callback) {
  if (['function', 'undefined'].indexOf(typeof options) !== -1) {
    callback = options;
    options = {};
  }
  return {
    db: db,
    callback: callback,
    options: options,
    designDocName: splitUrl(rewritePath)[0],
    rewriteUrl: splitUrl(rewritePath).slice(1)
  };
}

function splitUrl(url) {
  return url.split('/').filter(function (part) {
    return part;
  });
}

function buildRewriteResultReqObj(db, designDocName, rewriteUrl, options) {
  return db.get('_design/' + designDocName).then(function (ddoc) {
    //rewrite algorithm source:
    //https://github.com/apache/couchdb/blob/master/src/couchdb/couch_httpd_rewrite.erl
    var rewrites = ddoc.rewrites;
    if (typeof rewrites === 'undefined') {
      throw new PouchPluginError({
        status: 404,
        name: 'rewrite_error',
        message:'Invalid path.'
      });
    }
    if (!Array.isArray(rewrites)) {
      throw new PouchPluginError({
        status: 400,
        name: 'rewrite_error',
        message: 'Rewrite rules should be a JSON Array.'
      });
    }
    var rules = rewrites.map(function (rewrite) {
      if (typeof rewrite.to === 'undefined') {
        throw new PouchPluginError({
          status: 500,
          name:'error',
          message:'invalid_rewrite_target'
        });
      }
      return {
        method: rewrite.method || '*',
        from: splitUrl(typeof rewrite.from == 'undefined' ? '*' : rewrite.from),
        to: splitUrl(rewrite.to),
        query: rewrite.query || {}
      };
    });
    var match = tryToFindMatch({
      method: options.method || 'GET',
      url: rewriteUrl,
      query: options.query || {}
    }, rules);

    var pathEnd = ['_design', designDocName];
    pathEnd.push.apply(pathEnd, match.url);

    options.query = match.query;

    options.headers = options.headers || {};
    if (!options.headers['x-couchdb-requested-path'] && options.requested_path) {
      options.headers['x-couchdb-requested-path'] = '/' + options.requested_path.join('/');
    }

    return couchdb_objects.buildRequestObject(db, pathEnd, options);
  });
}

function tryToFindMatch(input, rules) {
  if (arrayEquals(rules, [])) {
    throw404();
  }
  var bindings = {};
  if (methodMatch(rules[0].method, input.method)) {
    var match = pathMatch(rules[0].from, input.url, bindings);
    if (match.ok) {
      var allBindings = extend(bindings, input.query);

      var url = [];
      url.push.apply(url, replacePathBindings(rules[0].to, allBindings));
      url.push.apply(url, match.remaining);

      var ruleQueryArgs = replaceQueryBindings(rules[0].query, allBindings);
      var query = extend(allBindings, ruleQueryArgs);
      delete query['*'];

      return {
        url: url,
        query: query
      };
    } else {
      return tryToFindMatch(input, rules.slice(1));
    }
  } else {
    return tryToFindMatch(input, rules.slice(1));
  }
}

function throw404() {
  throw new PouchPluginError({status: 404, name: 'not_found', message: 'missing'});
}

function arrayEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function methodMatch(required, given) {
  //corresponds to bind_method in the couchdb code
  return required === '*' || required === given;
}

function pathMatch(required, given, bindings) {
  //corresponds to bind_path in the couchdb code
  if (arrayEquals(required, []) && arrayEquals(given, [])) {
    return {ok: true, remaining: []};
  }
  if (arrayEquals(required, ['*'])) {
    bindings['*'] = given[0];
    return {ok: true, remaining: given.slice(1)};
  }
  if (arrayEquals(given, [])) {
    return {ok: false};
  }
  if ((required[0] || '')[0] === ':') {
    bindings[required[0].slice(1)] = given[0];
    return pathMatch(required.slice(1), given.slice(1), bindings);
  }
  if (required[0] === given[0]) {
    return pathMatch(required.slice(1), given.slice(1), bindings);
  }
  return {ok: false};
}

function replacePathBindings(path, bindings) {
  for (var i = 0; i < path.length; i += 1) {
    var bindingName = path[i];
    if (bindingName[0] === ':') {
      bindingName = bindingName.slice(1);
    }
    if (bindings.hasOwnProperty(bindingName)) {
      path[i] = bindings[bindingName];
    }
  }
  return path;
}

function replaceQueryBindings(query, bindings) {
  for (var key in query) {
    /* istanbul ignore if */
    if (!query.hasOwnProperty(key)) {
      continue;
    }
    if (typeof query[key] === 'object') {
      query[key] = replaceQueryBindings(query[key], bindings);
    } else if (typeof query[key] === 'string') {
      var bindingKey = query[key];
      if (bindingKey[0] === ':') {
        bindingKey = bindingKey.slice(1);
      }
      if (bindings.hasOwnProperty(bindingKey)) {
        var val = bindings[bindingKey];
        try {
          val = JSON.parse(val);
        } catch (e) {/* just use the raw string*/}
        query[key] = val;
      }
    }
  }
  return query;
}

exports.rewrite = function (rewritePath, options, callback) {
  //options: values to end up in the request object that's used to call
  //the rewrite destination (next to their defaults).

  var args = parseArgs(this, rewritePath, options, callback);

  var promise;
  if (['http', 'https'].indexOf(args.db.type()) === -1) {
    promise = offlineRewrite(args.db, args.designDocName, args.rewriteUrl, args.options);
  } else {
    promise = httpRewrite(args.db, args.designDocName, args.rewriteUrl, args.options);
  }
  nodify(promise, args.callback);
  return promise;
};

function offlineRewrite(currentDb, designDocName, rewriteUrl, options) {
  var PouchDB = currentDb.constructor;

  var withValidation = options.withValidation;
  delete options.withValidation;

  var resultReqPromise = buildRewriteResultReqObj(currentDb, designDocName, rewriteUrl, options);
  return resultReqPromise.then(function (req) {
    return routePouchDB(PouchDB, req, {withValidation: withValidation});
  });
}

function httpRewrite(db, designDocName, rewriteUrl, options) {
  //no choice when http...
  delete options.withValidation;

  var pathEnd = ['_design', designDocName, '_rewrite'];
  pathEnd.push.apply(pathEnd, rewriteUrl);
  var reqPromise = couchdb_objects.buildRequestObject(db, pathEnd, options);
  return reqPromise.then(httpQuery.bind(null, db));
}
