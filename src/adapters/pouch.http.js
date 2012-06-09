// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License
function parseUri (str) {
  var o = parseUri.options;
  var m = o.parser[o.strictMode ? "strict" : "loose"].exec(str);
  var uri = {};
  var i = 14;

  while (i--) uri[o.key[i]] = m[i] || "";

  uri[o.q.name] = {};
  uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
    if ($1) uri[o.q.name][$1] = $2;
  });

  return uri;
};

parseUri.options = {
  strictMode: false,
  key: ["source","protocol","authority","userInfo","user","password","host",
        "port","relative","path","directory","file","query","anchor"],
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
function getHost(name) {
  // If the given name contains "http:"
  if (/http:/.test(name)) {
    // Prase the URI into all its little bits
    var uri = parseUri(name);
    
    // Store the fact that it is a remote URI
    uri.remote = true;
    
    // Store the user and password as a separate auth object
    uri.auth = {username: uri.user, password: uri.password};
    
    // Split the path part of the URI into parts using '/' as the delimiter
    // after removing any leading '/' and any trailing '/'
    var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');
    
    // Store the first part as the database name and remove it from the parts
    // array
    uri.db = parts.pop();
    
    // Restore the path by joining all the remaining parts (all the parts
    // except for the database name) with '/'s
    uri.path = parts.join('/');
    
    return uri;
  }
  
  // If the given name does not contain 'http:' then return a very basic object
  // with no host, the current path, the given name as the database name and no
  // username/password
  return {host: '', path: '/', db: name, auth: false};
}

// Generate a URL with the host data given by opts and the given path
function genUrl(opts, path) {
  // If the host is remote
  if (opts.remote) {
    // If the host already has a path, then we need to have a path delimiter
    // Otherwise, the path delimiter is the empty string
    var pathDel = !opts.path ? '' : '/';
    
    // Return the URL made up of all the host's information and the given path
    return opts.protocol + '://' + opts.host + ':' + opts.port + '/' + opts.path
      + pathDel + opts.db + '/' + path;
  }
  
  // If the host is not remote, then return the URL made up of just the
  // database name and the given path
  return '/' + opts.db + '/' + path;
};

function ajax(options, callback) {
  var defaults = {
    success: function (obj, _, xhr) {
      call(callback, null, obj, xhr);
    },
    error: function (err) {
      if (err) {
        var errObj = {status: err.status};
        try {
          errObj = $.extend({}, errObj, JSON.parse(err.responseText));
        } catch (e) {}
        call(callback, errObj);
      } else {
        call(callback, true);
      }
    },
    headers: {
      Accept: 'application/json'
    },
    dataType: 'json',
    contentType: 'application/json'
  };
  options = $.extend({}, defaults, options);

  if (options.data && typeof options.data !== 'string') {
    options.data = JSON.stringify(options.data);
  }
  if (options.auth) {
    options.beforeSend = function(xhr) {
      var token = btoa(options.auth.username + ":" + options.auth.password);
      xhr.setRequestHeader("Authorization", "Basic " + token);
    }
  }
  return $.ajax(options);
};

// Implements the PouchDB API for dealing with CouchDB instances over HTTP
var HttpPouch = function(opts, callback) {

  // Parse the URI given by opts.name into an easy-to-use object
  var host = getHost(opts.name);
  
  // Generate the database URL based on the host
  var db_url = genUrl(host, '');
  
  // The functions that will be publically available for HttpPouch
  var api = {};

  // Create a new CouchDB database based on the given opts
  ajax({auth: host.auth, type: 'PUT', url: db_url}, function(err, ret) {
    // If we get an "Unauthorized" error
    if (err && err.status === 401) {
      // Test if the database already exists
      ajax({auth: host.auth, type: 'HEAD', url: db_url}, function (err, ret) {
        // If there is still an error
        if (err) {
          // Give the error to the callback to deal with
          call(callback, err);
        } else {
          // Continue as if there had been no errors
          call(callback, null, api);
        }
      });
    // If there were no errros or if the only error is "Precondition Failed"
    // (note: "Precondition Failed" occurs when we try to create a database
    // that already exists)
    } else if (!err || err.status === 412) {
      // Continue as if there had been no errors
      call(callback, null, api);
    } else {
      call(callback, Pouch.Errors.UNKNOWN_ERROR);
    }
  });

  // The HttpPouch's ID is its URL
  api.id = function() {
    return genUrl(host, '');
  };

  // Calls GET on the host, which gets back a JSON string containing
  //    couchdb: A welcome string
  //    version: The version of CouchDB it is running
  api.info = function(callback) {
    ajax({
      auth: host.auth,
      type:'GET',
      url: genUrl(host, ''),
    }, callback);
  };

  // Get the document with the given id from the database given by host.
  // The id could be solely the _id in the database, or it may be a 
  // _design/ID or _local/ID path
  api.get = function(id, opts, callback) {
    // If no options were given, set the callback to the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
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

    // Set the options for the ajax call
    var options = {
      auth: host.auth,
      type: 'GET',
      url: genUrl(host, id + params)
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
      // Nothing is expected back from the server
      options.dataType = false;
    }

    // Get the document
    ajax(options, function(err, doc, xhr) {
      // If the document does not exist, send an error to the callback
      if (err) {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }
      
      // Send the document to the callback
      call(callback, null, doc, xhr);
    });
  };

  // Get the view given by fun of the database given by host.
  // fun is formatted in two parts separated by a '/'; the first
  // part is the design and the second is the view.
  api.query = function(fun, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    
    // List of parameters to add to the PUT request
    var params = [];
    
    // If opts.reduce exists and is defined, then add it to the list
    // of parameters.
    // If reduce=false then the results are that of only the map function
    // not the final result of map and reduce.
    if (typeof opts.reduce !== 'undefined') {
      params.push('reduce=' + opts.reduce);
    }
    
    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    var parts = fun.split('/');
    ajax({
      auth: host.auth,
      type:'GET',
      url: genUrl(host, '_design/' + parts[0] + '/_view/' + parts[1] + params),
    }, callback);
  };

  // Delete the document given by doc from the database given by host.
  api.remove = function(doc, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    
    // Delete the document
    ajax({
      auth: host.auth,
      type:'DELETE',
      url: genUrl(host, doc._id) + '?rev=' + doc._rev
    }, callback);
  };

  // Add the attachment given by doc and the content type given by type
  // to the document with the given id, the revision given by rev, and
  // add it to the database given by host.
  api.putAttachment = function(id, rev, doc, type, callback) {
    // Add the attachment
    ajax({
      auth: host.auth,
      type:'PUT',
      url: genUrl(host, id) + '?rev=' + rev,
      headers: {'Content-Type': type},
      data: doc
    }, callback);
  };

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This assumes that doc has a _id field.
  api.put = function(doc, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
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
      auth: host.auth,
      type: 'PUT',
      url: genUrl(host, doc._id) + params,
      data: doc
    }, callback);
  };

  // Add the document given by doc (in JSON string format) to the database
  // given by host. This assumes that doc is a new document (i.e. does not
  // have a _id or a _rev field.
  api.post = function(doc, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    
    // Add the document
    ajax({
      auth: host.auth,
      type: 'POST',
      url: genUrl(host, ''),
      data: doc
    }, callback);
  };

  // Update/create multiple documents given by req in the database
  // given by host.
  api.bulkDocs = function(req, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
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
      auth: host.auth,
      type:'POST',
      url: genUrl(host, '_bulk_docs'),
      data: req
    }, callback);
  };

  // Get a listing of the documents in the database given
  // by host and ordered by increasing id.
  api.allDocs = function(opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    
    // List of parameters to add to the GET request
    var params = [];
    
    // TODO I don't see conflicts as a valid parameter for a
    // _all_docs request (see http://wiki.apache.org/couchdb/HTTP_Document_API#all_docs)
    if (opts.conflicts) {
      params.push('conflicts=true');
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

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    // Get the document listing
    ajax({
      auth: host.auth,
      type:'GET',
      url: genUrl(host, '_all_docs' + params)
    }, callback);
  };

  // Get a list of changes made to documents in the database given by host.
  // TODO According to the README, there should be two other methods here,
  // api.changes.addListener and api.changes.removeListener.
  api.changes = function(opts, callback) {
    // If no options were given, set the callback to the first parameter
    if (opts instanceof Function) {
      opts = {complete: opts};
    }
    
    // If a callback was provided outside of opts, then it is the one that
    // will be called upon completion
    if (callback) {
      opts.complete = callback;
    }

    console.info(db_url + ': Start Changes Feed: continuous=' + opts.continuous);

    // Query string of all the parameters to add to the GET request
    var params = '?style=all_docs'
    
    // If opts.include_docs exists, opts.filter exists, and opts.filter is a
    // function, add the include_docs value to the query string.
    // If include_docs=true then include the associated document with each
    // result.
    if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
      params += '&include_docs=true'
    }
    
    // If opts.continuous exists, add the feed value to the query string.
    // If feed=longpoll then it waits for either a timeout or a change to 
    // occur before returning.
    if (opts.continuous) {
      params += '&feed=longpoll';
    }
    
    // If opts.conflicts exists, add the conflicts value to the query string.
    // TODO I can't find documentation of what conflicts=true does. See
    // http://wiki.apache.org/couchdb/HTTP_database_API#Changes
    if (opts.conflicts) {
      params += '&conflicts=true';
    }
    
    // If opts.descending exists, add the descending value to the query string.
    // if descending=true then the change results are returned in 
    // descending order (most recent change first).
    if (opts.descending) {
      params += '&descending=true';
    }
    
    // If opts.filter exists and is a string then add the filter value
    // to the query string.
    // If filter is given a string containing the name of a filter in
    // the design, then only documents passing through the filter will
    // be returned.
    if (opts.filter && typeof opts.filter === 'string') {
      params += '&filter=' + opts.filter;
    }

    var xhr;

    // Get all the changes starting wtih the one immediately after the
    // sequence number given by since.
    var fetch = function(since, callback) {
      // Set the options for the ajax call
      var xhrOpts = {
        auth: host.auth, type:'GET',
        url: genUrl(host, '_changes' + params + '&since=' + since)
      };
      
      if (opts.aborted) {
        return;
      }

      // Get the changes
      xhr = ajax(xhrOpts, function(err, res) {
        callback(res);
      });
    }

    // If opts.since exists, get all the changes from the sequence
    // number given by opts.since. Otherwise, get all the changes
    // from the sequence number 0.
    var fetched = function(res) {
      // If the result of the ajax call (res) contains changes (res.results)
      if (res && res.results) {
        // For each change
        res.results.forEach(function(c) {
          var hasFilter = opts.filter && typeof opts.filter === 'function';
          if (opts.aborted || hasFilter && !opts.filter.apply(this, [c.doc])) {
            return;
          }
          
          // Process the change
          call(opts.onChange, c);
        });
      }
      if (res && opts.continuous) {
        // Call fetch again with the newest sequence number
        fetch(res.last_seq, fetched);
      } else {
        // We're done, call the callback
        call(opts.complete, null, res);
      }
    }

    fetch(opts.since || 0, fetched);

    // Return a method to cancel this method from processing any more
    return {
      cancel: function() {
        console.info(db_url + ': Cancel Changes Feed');
        opts.aborted = true;
        xhr.abort();
      }
    };
  };

  // Given a set of document/revision IDs (given by req), tets the subset of 
  // those that do NOT correspond to revisions stored in the database.
  // See http://wiki.apache.org/couchdb/HttpPostRevsDiff
  api.revsDiff = function(req, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    
    // Get the missing document/revision IDs
    ajax({
      auth: host.auth,
      type:'POST',
      url: genUrl(host, '_revs_diff'),
      data: req
    }, function(err, res) {
      call(callback, null, res);
    });
  };

  api.replicate = {};

  // Replicate from the database given by url to this HttpPouch
  api.replicate.from = function(url, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, api, opts, callback);
  };

  // Replicate to the database given by dbName from this HttpPouch
  api.replicate.to = function(dbName, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(api, dbName, opts, callback);
  };


  return api;
};

// Delete the HttpPouch specified by the given name.
HttpPouch.destroy = function(name, callback) {
  var host = getHost(name);
  ajax({auth: host.auth, type: 'DELETE', url: genUrl(host, '')}, callback);
};

// HttpPouch is a valid adapter.
HttpPouch.valid = function() {
  return true;
}

// Set HttpPouch to be the adapter used with the http scheme.
Pouch.adapter('http', HttpPouch);
