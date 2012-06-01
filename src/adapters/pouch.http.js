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
  key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
  q:   {
    name:   "queryKey",
    parser: /(?:^|&)([^&=]*)=?([^&]*)/g
  },
  parser: {
    strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
    loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
  }
};

function getHost(name) {
  if (/http:/.test(name)) {
    var uri = parseUri(name);
    uri.remote = true;
    uri.auth = {username: uri.user, password: uri.password};
    var parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');
    uri.db = parts.pop();
    uri.path = parts.join('/');
    return uri;
  }
  return {host: '', path: '/', db: name, auth: false};
}

function genUrl(opts, path) {
  if (opts.remote) {
    var pathDel = !opts.path ? '' : '/';
    return opts.protocol + '://' + opts.host + ':' + opts.port + '/' + opts.path
      + pathDel + opts.db + '/' + path;
  }
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

var HttpPouch = function(opts, callback) {

  var host = getHost(opts.name);
  var db_url = genUrl(host, '');
  var api = {};

  ajax({auth: host.auth, type: 'PUT', url: db_url}, function(err, ret) {
    // the user may not have permission to PUT to a db url
    if (err && err.status === 401) {
      // test if the db already exists
      ajax({auth: host.auth, type: 'HEAD', url: db_url}, function (err, ret) {
        if (err) {
          // still can't access db
          call(callback, err);
        } else {
          // continue
          call(callback, null, api);
        }
      });
    } else if (!err || err.status === 412) {
      call(callback, null, api);
    }
  });

  api.id = function() {
    return genUrl(host, '');
  };

  api.info = function(callback) {
    ajax({
      auth: host.auth,
      type:'GET',
      url: genUrl(host, ''),
    }, callback);
  };

  api.get = function(id, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    var params = [];
    if (opts.revs) {
      params.push('revs=true');
    }
    if (opts.revs_info) {
      params.push('revs_info=true');
    }
    if (opts.attachments) {
      params.push('attachments=true');
    }
    if (opts.rev) {
      params.push('rev=' + opts.rev);
    }
    if (opts.conflicts) {
      params.push('conflicts=' + opts.conflicts);
    }
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    var options = {
      auth: host.auth,
      type: 'GET',
      url: genUrl(host, id + params)
    };

    var parts = id.split('/');
    if ((parts.length > 1 && parts[0] !== '_design' && parts[0] !== '_local') ||
        (parts.length > 2 && parts[0] === '_design' && parts[0] !== '_local')) {
      options.dataType = false;
    }

    ajax(options, function(err, doc, xhr) {
      if (err) {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }
      call(callback, null, doc, xhr);
    });
  };


  api.query = function(fun, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    var params = [];
    if (typeof opts.reduce !== 'undefined') {
      params.push('reduce=' + opts.reduce);
    }
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    var parts = fun.split('/');
    ajax({
      auth: host.auth,
      type:'GET',
      url: genUrl(host, '_design/' + parts[0] + '/_view/' + parts[1] + params),
    }, callback);
  };

  api.remove = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    ajax({
      auth: host.auth,
      type:'DELETE',
      url: genUrl(host, doc._id) + '?rev=' + doc._rev
    }, callback);
  };

  api.putAttachment = function(id, rev, doc, type, callback) {
    ajax({
      auth: host.auth,
      type:'PUT',
      url: genUrl(host, id) + '?rev=' + rev,
      headers: {'Content-Type': type},
      data: doc
    }, callback);
  };

  api.put = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }

    var params = [];
    if (opts && typeof opts.new_edits !== 'undefined') {
      params.push('new_edits=' + opts.new_edits);
    }

    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    ajax({
      auth: host.auth,
      type: 'PUT',
      url: genUrl(host, doc._id) + params,
      data: doc
    }, callback);
  };


  api.post = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    ajax({
      auth: host.auth,
      type: 'POST',
      url: genUrl(host, ''),
      data: doc
    }, callback);
  };

  api.bulkDocs = function(req, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    if (typeof opts.new_edits !== 'undefined') {
      req.new_edits = opts.new_edits;
    }
    ajax({
      auth: host.auth,
      type:'POST',
      url: genUrl(host, '_bulk_docs'),
      data: req
    }, callback);
  };

  api.allDocs = function(opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    var params = [];
    if (opts.conflicts) {
      params.push('conflicts=true');
    }
    if (opts.include_docs) {
      params.push('include_docs=true');
    }
    if (opts.startkey) {
      params.push('startkey=' + encodeURIComponent(JSON.stringify(opts.startkey)));
    }
    if (opts.endkey) {
      params.push('endkey=' + encodeURIComponent(JSON.stringify(opts.endkey)));
    }

    params = params.join('&');
    if (params !== '') {
      params = '?' + params;
    }

    ajax({
      auth: host.auth,
      type:'GET',
      url: genUrl(host, '_all_docs' + params)
    }, callback);
  };

  api.changes = function(opts, callback) {

    if (opts instanceof Function) {
      opts = {complete: opts};
    }
    if (callback) {
      opts.complete = callback;
    }

    console.info('Start Changes Feed: continuous=' + opts.continuous);

    var params = '?style=all_docs'
    if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
      params += '&include_docs=true'
    }
    if (opts.continuous) {
      params += '&feed=longpoll';
    }
    if (opts.conflicts) {
      params += '&conflicts=true';
    }
    if (opts.descending) {
      params += '&descending=true';
    }
    if (opts.filter && typeof opts.filter === 'string') {
      params += '&filter=' + opts.filter;
    }

    var xhr;

    var fetch = function(since, callback) {
      var xhrOpts = {
        auth: host.auth, type:'GET',
        url: genUrl(host, '_changes' + params + '&since=' + since)
      };
      if (opts.aborted) {
        return;
      }
      xhr = ajax(xhrOpts, function(err, res) {
        callback(res);
      });
    }

    var fetched = function(res) {
      if (res && res.results) {
        res.results.forEach(function(c) {
          var hasFilter = opts.filter && typeof opts.filter === 'function';
          if (opts.aborted || hasFilter && !opts.filter.apply(this, [c.doc])) {
            return;
          }
          call(opts.onChange, c);
        });
      }
      if (res && opts.continuous) {
        fetch(res.last_seq, fetched);
      } else {
        call(opts.complete, null, res);
      }
    }

    fetch(opts.since || 0, fetched);

    return {
      cancel: function() {
        console.info('Cancel Changes Feed');
        opts.aborted = true;
        xhr.abort();
      }
    };
  };

  api.revsDiff = function(req, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
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

  api.replicate.from = function(url, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(url, api, opts, callback);
  };

  api.replicate.to = function(dbName, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    return Pouch.replicate(api, dbName, opts, callback);
  };


  return api;
};

HttpPouch.destroy = function(name, callback) {
  var host = getHost(name);
  ajax({auth: host.auth, type: 'DELETE', url: genUrl(host, '')}, callback);
};


HttpPouch.valid = function() {
  return true;
}

Pouch.adapter('http', HttpPouch);
