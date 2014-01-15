"use strict";

var utils = require('../utils');
var errors = require('../deps/errors');

// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri(str) {
  var o = parseUri.options;
  var m = o.parser[o.strictMode ? "strict" : "loose"].exec(str);
  var uri = {};
  var i = 14;

  while (i--) {
    uri[o.key[i]] = m[i] || "";
  }

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) {
      uri[o.q.name][$1] = $2;
    }
  });

  return uri;
}

function encodeDocId(id) {
  if (/^_(design|local)/.test(id)) {
    return id;
  }
  return encodeURIComponent(id);
}

parseUri.options = {
  strictMode: false,
  key: ["source", "protocol", "authority", "userInfo", "user", "password", "host",
        "port", "relative", "path", "directory", "file", "query", "anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

// Get all the information you possibly can about the URI given by name and
// return it as a suitable object.
function getHost(name, opts) {
  // If the given name contains "http:"
  if (/http(s?):/.test(name)) {
    // Prase the URI into all its little bits
    var uri = parseUri(name);

    // Store the fact that it is a remote URI
    uri.remote = true;

    // Store the user and password as a separate auth object
    if (uri.user || uri.password) {
      uri.auth = {username: uri.user, password: uri.password};
    }

    // Split the path part of the URI into parts using '/' as the delimiter
    // after removing any leading '/' and any trailing '/'
    var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');

    // Store the first part as the database name and remove it from the parts
    // array
    uri.db = parts.pop();

    // Restore the path by joining all the remaining parts (all the parts
    // except for the database name) with '/'s
    uri.path = parts.join('/');
    opts = opts || {};
    uri.headers = opts.headers || {};

    if (opts.auth || uri.auth) {
      var nAuth = opts.auth || uri.auth;
      var token = utils.btoa(nAuth.username + ':' + nAuth.password);
      uri.headers.Authorization = 'Basic ' + token;
    }

    if (opts.headers) {
      uri.headers = opts.headers;
    }

    return uri;
  }

  // If the given name does not contain 'http:' then return a very basic object
  // with no host, the current path, the given name as the database name and no
  // username/password
  return {host: '', path: '/', db: name, auth: false};
}

// Generate a URL with the host data given by opts and the given path
function genDBUrl(opts, path) {
  // If the host is remote
  if (opts.remote) {
    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    var pathDel = !opts.path ? '' : '/';

    // Return the URL made up of all the host's information and the given path
    return opts.protocol + '://' + opts.host + ':' + opts.port + '/' +
      opts.path + pathDel + opts.db + '/' + path;
  }

  // If the host is not remote, then return the URL made up of just the
  // database name and the given path
  return '/' + opts.db + '/' + path;
}

// Generate a URL with the host data given by opts and the given path
function genUrl(opts, path) {
  if (opts.remote) {
    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    var pathDel = !opts.path ? '' : '/';

    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    return opts.protocol + '://' + opts.host + ':' + opts.port + '/' + opts.path + pathDel + path;
  }

  return '/' + path;
}

// Implements the PouchDB API for dealing with CouchDB instances over HTTP
function HttpPouch(opts, callback) {

  // Parse the URI given by opts.name into an easy-to-use object
  var host = getHost(opts.name, opts);

  // Generate the database URL based on the host
  var db_url = genDBUrl(host, '');

  // The functions that will be publically available for HttpPouch
  var api = {};
  var ajaxOpts = opts.ajax || {};
  function ajax(options, callback) {
    return utils.ajax(utils.extend({}, ajaxOpts, options), callback);
  }
  var uuids = {
    list: [],
    get: function (opts, callback) {
      if (typeof opts === 'function') {
        callback = opts;
        opts = {count: 10};
      }
      var cb = function (err, body) {
        if (err || !('uuids' in body)) {
          utils.call(callback, err || errors.UNKNOWN_ERROR);
        } else {
          uuids.list = uuids.list.concat(body.uuids);
          utils.call(callback, null, "OK");
        }
      };
      var params = '?count=' + opts.count;
      ajax({
        headers: host.headers,
        method: 'GET',
        url: genUrl(host, '_uuids') + params
      }, cb);
    }
  };

  // Create a new CouchDB database based on the given opts
  var createDB = function () {
    ajax({headers: host.headers, method: 'PUT', url: db_url}, function (err, ret) {
      // If we get an "Unauthorized" error
      if (err && err.status === 401) {
        // Test if the database already exists
        ajax({headers: host.headers, method: 'HEAD', url: db_url}, function (err, ret) {
          // If there is still an error
          if (err) {
            // Give the error to the callback to deal with
            utils.call(callback, err);
          } else {
            // Continue as if there had been no errors
            utils.call(callback, null, api);
          }
        });
        // If there were no errros or if the only error is "Precondition Failed"
        // (note: "Precondition Failed" occurs when we try to create a database
        // that already exists)
      } else if (!err || err.status === 412) {
        // Continue as if there had been no errors
        utils.call(callback, null, api);
      } else {
        utils.call(callback, errors.UNKNOWN_ERROR);
      }
    });
  };
  if (!opts.skipSetup) {
    ajax({headers: host.headers, method: 'GET', url: db_url}, function (err, ret) {
      //check if the db exists
      if (err) {
        if (err.status === 404) {
          //if it doesn't, create it
          createDB();
        } else {
          utils.call(callback, err);
        }
      } else {
        //go do stuff with the db
        utils.call(callback, null, api);
      }
    });
  }

  api.type = function () {
    return 'http';
  };

  // The HttpPouch's ID is its URL
  api.id = function () {
    return genDBUrl(host, '');
  };

  api.request = utils.toPromise(function (options, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('request', arguments);
      return;
    }
    options.headers = host.headers;
    options.url = genDBUrl(host, options.url);
    ajax(options, callback);
  });

  // Sends a POST request to the host calling the couchdb _compact function
  //    version: The version of CouchDB it is running
  api.compact = utils.toPromise(function (opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('compact', arguments);
      return;
    }
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    ajax({
      headers: host.headers,
      url: genDBUrl(host, '_compact'),
      method: 'POST'
    }, function () {
      function ping() {
        api.info(function (err, res) {
          if (!res.compact_running) {
            utils.call(callback, null);
          } else {
            setTimeout(ping, opts.interval || 200);
          }
        });
      }
      // Ping the http if it's finished compaction
      if (typeof callback === "function") {
        ping();
      }
    });
  });

  // Calls GET on the host, which gets back a JSON string containing
  //    couchdb: A welcome string
  //    version: The version of CouchDB it is running
  api.info = utils.toPromise(function (callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('info', arguments);
      return;
    }
    ajax({
      headers: host.headers,
      method: 'GET',
      url: genDBUrl(host, '')
    }, callback);
  });

  // Get the document with the given id from the database given by host.
  // The id could be solely the _id in the database, or it may be a
  // _design/ID or _local/ID path
  api.get = utils.toPromise(function (id, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('get', arguments);
      return;
    }
    // If no options were given, set the callback to the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (opts.auto_encode === undefined) {
      opts.auto_encode = true;
    }

    // List of parameters to add to the GET request
    var params = [];

    // If it exists, add the opts.revs value to the list of parameters.
    // If revs=true then the resulting JSON will include a field
    // _revisions containing an array of the revision IDs.
    if (opts.revs) {
      params.push('revs=true');
    }

    // If it exists, add the opts.revs_info value to the list of parameters.
    // If revs_info=true then the resulting JSON will include the field
    // _revs_info containing an array of objects in which each object
    // representing an available revision.
    if (opts.revs_info) {
      params.push('revs_info=true');
    }

    if (opts.local_seq) {
      params.push('local_seq=true');
    }
    // If it exists, add the opts.open_revs value to the list of parameters.
    // If open_revs=all then the resulting JSON will include all the leaf
    // revisions. If open_revs=["rev1", "rev2",...] then the resulting JSON
    // will contain an array of objects containing data of all revisions
    if (opts.open_revs) {
      if (opts.open_revs !== "all") {
        opts.open_revs = JSON.stringify(opts.open_revs);
      }
      params.push('open_revs=' + opts.open_revs);
    }

    // If it exists, add the opts.attachments value to the list of parameters.
    // If attachments=true the resulting JSON will include the base64-encoded
    // contents in the "data" property of each attachment.
    if (opts.attachments) {
      params.push('attachments=true');
    }

    // If it exists, add the opts.rev value to the list of parameters.
    // If rev is given a revision number then get the specified revision.
    if (opts.rev) {
      params.push('rev=' + opts.rev);
    }

    // If it exists, add the opts.conflicts value to the list of parameters.
    // If conflicts=true then the resulting JSON will include the field
    // _conflicts containing all the conflicting revisions.
    if (opts.conflicts) {
      params.push('conflicts=' + opts.conflicts);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    if (opts.auto_encode) {
      id = encodeDocId(id);
    }

    // Set the options for the ajax call
    var options = {
      headers: host.headers,
      method: 'GET',
      url: genDBUrl(host, id + params)
    };

    // If the given id contains at least one '/' and the part before the '/'
    // is NOT "_design" and is NOT "_local"
    // OR
    // If the given id contains at least two '/' and the part before the first
    // '/' is "_design".
    // TODO This second condition seems strange since if parts[0] === '_design'
    // then we already know that parts[0] !== '_local'.
    var parts = id.split('/');
    if ((parts.length > 1 && parts[0] !== '_design' && parts[0] !== '_local') ||
        (parts.length > 2 && parts[0] === '_design' && parts[0] !== '_local')) {
      // Binary is expected back from the server
      options.binary = true;
    }

    // Get the document
    ajax(options, function (err, doc, xhr) {
      // If the document does not exist, send an error to the callback
      if (err) {
        return utils.call(callback, err);
      }

      // Send the document to the callback
      utils.call(callback, null, doc, xhr);
    });
  });

  // Delete the document given by doc from the database given by host.
  api.remove = utils.toPromise(function (doc, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('remove', arguments);
      return;
    }
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    // Delete the document
    ajax({
      headers: host.headers,
      method: 'DELETE',
      url: genDBUrl(host, encodeDocId(doc._id)) + '?rev=' + doc._rev
    }, callback);
  });

  // Get the attachment
  api.getAttachment = utils.toPromise(function (docId, attachmentId, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (opts.auto_encode === undefined) {
      opts.auto_encode = true;
    }
    if (opts.auto_encode) {
      docId = encodeDocId(docId);
    }
    opts.auto_encode = false;
    api.get(docId + '/' + attachmentId, opts, callback);
  });

  // Remove the attachment given by the id and rev
  api.removeAttachment = utils.toPromise(function (docId, attachmentId, rev, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('removeAttachment', arguments);
      return;
    }
    ajax({
      headers: host.headers,
      method: 'DELETE',
      url: genDBUrl(host, encodeDocId(docId) + '/' + attachmentId) + '?rev=' + rev
    }, callback);
  });

  // Add the attachment given by blob and its contentType property
  // to the document with the given id, the revision given by rev, and
  // add it to the database given by host.
  api.putAttachment = utils.toPromise(function (docId, attachmentId, rev, blob, type, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('putAttachment', arguments);
      return;
    }
    if (typeof type === 'function') {
      callback = type;
      type = blob;
      blob = rev;
      rev = null;
    }
    if (typeof type === 'undefined') {
      type = blob;
      blob = rev;
      rev = null;
    }
    var id = encodeDocId(docId) + '/' + attachmentId;
    var url = genDBUrl(host, id);
    if (rev) {
      url += '?rev=' + rev;
    }

    var opts = {
      headers: host.headers,
      method: 'PUT',
      url: url,
      processData: false,
      body: blob,
      timeout: 60000
    };
    opts.headers['Content-Type'] = type;
    // Add the attachment
    ajax(opts, callback);
  });

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This fails if the doc has no _id field.
  api.put = utils.toPromise(function (doc, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('put', arguments);
      return;
    }
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (typeof doc !== 'object') {
      return utils.call(callback, errors.NOT_AN_OBJECT);
    }
    if (!utils.isValidId(doc._id)) {
      return utils.call(callback, errors.MISSING_ID);
    }

    // List of parameter to add to the PUT request
    var params = [];

    // If it exists, add the opts.new_edits value to the list of parameters.
    // If new_edits = false then the database will NOT assign this document a
    // new revision number
    if (opts && typeof opts.new_edits !== 'undefined') {
      params.push('new_edits=' + opts.new_edits);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    // Add the document
    ajax({
      headers: host.headers,
      method: 'PUT',
      url: genDBUrl(host, encodeDocId(doc._id)) + params,
      body: doc
    }, callback);
  });

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This does not assume that doc is a new document (i.e. does not
  // have a _id or a _rev field.
  api.post = utils.toPromise(function (doc, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('post', arguments);
      return;
    }
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (typeof doc !== 'object') {
      return utils.call(callback, errors.NOT_AN_OBJECT);
    }
    if (! ("_id" in doc)) {
      if (uuids.list.length > 0) {
        doc._id = uuids.list.pop();
        api.put(doc, opts, callback);
      } else {
        uuids.get(function (err, resp) {
          if (err) {
            return utils.call(callback, errors.UNKNOWN_ERROR);
          }
          doc._id = uuids.list.pop();
          api.put(doc, opts, callback);
        });
      }
    } else {
      api.put(doc, opts, callback);
    }
  });

  // Update/create multiple documents given by req in the database
  // given by host.
  api.bulkDocs = utils.toPromise(function (req, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('bulkDocs', arguments);
      return;
    }
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    if (!opts) {
      opts = {};
    }

    // If opts.new_edits exists add it to the document data to be
    // send to the database.
    // If new_edits=false then it prevents the database from creating
    // new revision numbers for the documents. Instead it just uses
    // the old ones. This is used in database replication.
    if (typeof opts.new_edits !== 'undefined') {
      req.new_edits = opts.new_edits;
    }

    // Update/create the documents
    ajax({
      headers: host.headers,
      method: 'POST',
      url: genDBUrl(host, '_bulk_docs'),
      body: req
    }, callback);
  });

  // Get a listing of the documents in the database given
  // by host and ordered by increasing id.
  api.allDocs = utils.toPromise(function (opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('allDocs', arguments);
      return;
    }
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    // List of parameters to add to the GET request
    var params = [];
    var body;
    var method = 'GET';

    // TODO I don't see conflicts as a valid parameter for a
    // _all_docs request (see http://wiki.apache.org/couchdb/HTTP_Document_API#all_docs)
    if (opts.conflicts) {
      params.push('conflicts=true');
    }

    // If opts.descending is truthy add it to params
    if (opts.descending) {
      params.push('descending=true');
    }

    // If opts.include_docs exists, add the include_docs value to the
    // list of parameters.
    // If include_docs=true then include the associated document with each
    // result.
    if (opts.include_docs) {
      params.push('include_docs=true');
    }

    // If opts.startkey exists, add the startkey value to the list of
    // parameters.
    // If startkey is given then the returned list of documents will
    // start with the document whose id is startkey.
    if (opts.startkey) {
      params.push('startkey=' +
                  encodeURIComponent(JSON.stringify(opts.startkey)));
    }

    // If opts.endkey exists, add the endkey value to the list of parameters.
    // If endkey is given then the returned list of docuemnts will
    // end with the document whose id is endkey.
    if (opts.endkey) {
      params.push('endkey=' + encodeURIComponent(JSON.stringify(opts.endkey)));
    }

    // If opts.limit exists, add the limit value to the parameter list.
    if (opts.limit) {
      params.push('limit=' + opts.limit);
    }

    if (typeof opts.skip !== 'undefined') {
      params.push('skip=' + opts.skip);
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    // If keys are supplied, issue a POST request to circumvent GET query string limits
    // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
    if (typeof opts.keys !== 'undefined') {
      method = 'POST';
      body = JSON.stringify({keys: opts.keys});
    }

    // Get the document listing
    ajax({
      headers: host.headers,
      method: method,
      url: genDBUrl(host, '_all_docs' + params),
      body: body
    }, callback);
  });

  // Get a list of changes made to documents in the database given by host.
  // TODO According to the README, there should be two other methods here,
  // api.changes.addListener and api.changes.removeListener.
  api.changes = function (opts) {

    // We internally page the results of a changes request, this means
    // if there is a large set of changes to be returned we can start
    // processing them quicker instead of waiting on the entire
    // set of changes to return and attempting to process them at once
    var CHANGES_LIMIT = 25;

    if (!api.taskqueue.ready()) {
      var task = api.taskqueue.addTask('changes', arguments);
      return {
        cancel: function () {
          if (task.task) {
            return task.task.cancel();
          }
          //console.log(db_url + ': Cancel Changes Feed');
          task.parameters[0].aborted = true;
        }
      };
    }

    if (opts.since === 'latest') {
      var changes;
      api.info(function (err, info) {
        if (!opts.aborted) {
          opts.since = info.update_seq;
          changes = api.changes(opts);
        }
      });
      // Return a method to cancel this method from processing any more
      return {
        cancel: function () {
          if (changes) {
            return changes.cancel();
          }
          //console.log(db_url + ': Cancel Changes Feed');
          opts.aborted = true;
        }
      };
    }

    //console.log(db_url + ': Start Changes Feed: continuous=' + opts.continuous);

    var params = {};
    var limit = (typeof opts.limit !== 'undefined') ? opts.limit : false;
    if (limit === 0) {
      limit = 1;
    }
    //
    var leftToFetch = limit;

    if (opts.style) {
      params.style = opts.style;
    }

    if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
      params.include_docs = true;
    }

    if (opts.continuous) {
      params.feed = 'longpoll';
    }

    if (opts.conflicts) {
      params.conflicts = true;
    }

    if (opts.descending) {
      params.descending = true;
    }

    if (opts.filter && typeof opts.filter === 'string') {
      params.filter = opts.filter;
      if (opts.filter === '_view' && opts.view && typeof opts.view === 'string') {
        params.view = opts.view;
      }
    }

    // If opts.query_params exists, pass it through to the changes request.
    // These parameters may be used by the filter on the source database.
    if (opts.query_params && typeof opts.query_params === 'object') {
      for (var param_name in opts.query_params) {
        if (opts.query_params.hasOwnProperty(param_name)) {
          params[param_name] = opts.query_params[param_name];
        }
      }
    }

    var xhr;
    var lastFetchedSeq;
    var remoteLastSeq;
    var pagingCount;

    // Get all the changes starting wtih the one immediately after the
    // sequence number given by since.
    var fetch = function (since, callback) {
      params.since = since;
      if (!opts.continuous && !pagingCount) {
        pagingCount = remoteLastSeq;
      }
      params.limit = (!limit || leftToFetch > CHANGES_LIMIT) ?
        CHANGES_LIMIT : leftToFetch;

      var paramStr = '?' + Object.keys(params).map(function (k) {
        return k + '=' + params[k];
      }).join('&');

      // Set the options for the ajax call
      var xhrOpts = {
        headers: host.headers,
        method: 'GET',
        url: genDBUrl(host, '_changes' + paramStr),
        // _changes can take a long time to generate, especially when filtered
        timeout: null
      };
      lastFetchedSeq = since;

      if (opts.aborted) {
        return;
      }

      // Get the changes
      xhr = ajax(xhrOpts, callback);
    };

    // If opts.since exists, get all the changes from the sequence
    // number given by opts.since. Otherwise, get all the changes
    // from the sequence number 0.
    var fetchTimeout = 10;
    var fetchRetryCount = 0;

    var results = {results: []};

    var fetched = function (err, res) {
      // If the result of the ajax call (res) contains changes (res.results)
      if (res && res.results) {
        results.last_seq = res.last_seq;
        // For each change
        var req = {};
        req.query = opts.query_params;
        res.results = res.results.filter(function (c) {
          leftToFetch--;
          var ret = utils.filterChange(opts)(c);
          if (ret) {
            results.results.push(c);
            utils.call(opts.onChange, c);
          }
          return ret;
        });
      } else if (err) {
        // In case of an error, stop listening for changes and call opts.complete
        opts.aborted = true;
        utils.call(opts.complete, err, null);
      }

      // The changes feed may have timed out with no results
      // if so reuse last update sequence
      if (res && res.last_seq) {
        lastFetchedSeq = res.last_seq;
      }

      var resultsLength = res && res.results.length || 0;

      pagingCount -= CHANGES_LIMIT;

      var finished = (limit && leftToFetch <= 0) ||
        (res && !resultsLength && pagingCount <= 0) ||
        (resultsLength && res.last_seq === remoteLastSeq) ||
        (opts.descending && lastFetchedSeq !== 0);

      if (opts.continuous || !finished) {
        // Increase retry delay exponentially as long as errors persist
        if (err) {
          fetchRetryCount += 1;
        } else {
          fetchRetryCount = 0;
        }
        var timeoutMultiplier = 1 << fetchRetryCount;
        var retryWait = fetchTimeout * timeoutMultiplier;
        var maximumWait = opts.maximumWait || 30000;

        if (retryWait > maximumWait) {
          utils.call(opts.complete, err || errors.UNKNOWN_ERROR, null);
        }

        // Queue a call to fetch again with the newest sequence number
        setTimeout(function () { fetch(lastFetchedSeq, fetched); }, retryWait);
      } else {
        // We're done, call the callback
        utils.call(opts.complete, null, results);
      }
    };

    // If we arent doing a continuous changes request we need to know
    // the current update_seq so we know when to stop processing the
    // changes
    if (opts.continuous) {
      fetch(opts.since || 0, fetched);
    } else {
      api.info(function (err, res) {
        if (err) {
          return utils.call(opts.complete, err);
        }
        remoteLastSeq = res.update_seq;
        fetch(opts.since || 0, fetched);
      });
    }

    // Return a method to cancel this method from processing any more
    return {
      cancel: function () {
        //console.log(db_url + ': Cancel Changes Feed');
        opts.aborted = true;
        xhr.abort();
      }
    };
  };

  // Given a set of document/revision IDs (given by req), tets the subset of
  // those that do NOT correspond to revisions stored in the database.
  // See http://wiki.apache.org/couchdb/HttpPostRevsDiff
  api.revsDiff = utils.toPromise(function (req, opts, callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('revsDiff', arguments);
      return;
    }
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    // Get the missing document/revision IDs
    ajax({
      headers: host.headers,
      method: 'POST',
      url: genDBUrl(host, '_revs_diff'),
      body: req
    }, function (err, res) {
      utils.call(callback, err, res);
    });
  });

  api.close = utils.toPromise(function (callback) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('close', arguments);
      return;
    }
    utils.call(callback, null);
  });

  api.replicateOnServer = function (target, opts, promise) {
    if (!api.taskqueue.ready()) {
      api.taskqueue.addTask('replicateOnServer', arguments);
      return promise;
    }

    var targetHost = getHost(target.id());
    var params = {
      source: host.db,
      target: targetHost.protocol === host.protocol && targetHost.authority === host.authority ? targetHost.db : targetHost.source
    };

    if (opts.continuous) {
      params.continuous = true;
    }

    if (opts.create_target) {
      params.create_target = true;
    }

    if (opts.doc_ids) {
      params.doc_ids = opts.doc_ids;
    }

    if (opts.filter && typeof opts.filter === 'string') {
      params.filter = opts.filter;
    }

    if (opts.query_params) {
      params.query_params = opts.query_params;
    }

    var result = {};
    var repOpts = {
      headers: host.headers,
      method: 'POST',
      url: host.protocol + '://' + host.host + (host.port === 80 ? '' : (':' + host.port)) + '/_replicate',
      body: params
    };
    var xhr;
    promise.cancel = function () {
      this.cancelled = true;
      if (xhr && !result.ok) {
        xhr.abort();
      }
      if (result._local_id) {
        repOpts.body = {
          replication_id: result._local_id
        };
      }
      repOpts.body.cancel = true;
      ajax(repOpts, function (err, resp, xhr) {
        // If the replication cancel request fails, send an error to the callback
        if (err) {
          return utils.call(callback, err);
        }
        // Send the replication cancel result to the complete callback
        utils.call(opts.complete, null, result, xhr);
      });
    };

    if (promise.cancelled) {
      return;
    }

    xhr = ajax(repOpts, function (err, resp, xhr) {
      // If the replication fails, send an error to the callback
      if (err) {
        return utils.call(callback, err);
      }

      result.ok = true;

      // Provided by CouchDB from 1.2.0 onward to cancel replication
      if (resp._local_id) {
        result._local_id = resp._local_id;
      }

      // Send the replication result to the complete callback
      utils.call(opts.complete, null, resp, xhr);
    });
  };

  return api;
}

// Delete the HttpPouch specified by the given name.
HttpPouch.destroy = utils.toPromise(function (name, opts, callback) {
  var host = getHost(name, opts);
  opts = opts || {};
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  opts.headers = host.headers;
  opts.method = 'DELETE';
  opts.url = genDBUrl(host, '');
  utils.ajax(opts, callback);
});

// HttpPouch is a valid adapter.
HttpPouch.valid = function () {
  return true;
};

module.exports = HttpPouch;
