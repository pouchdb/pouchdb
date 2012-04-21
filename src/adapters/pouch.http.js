Pouch.adapter('http', (function() {

  var api = {};

  api.destroy = function(name, callback) {
    var host = getHost(name);
    ajax({auth: host.auth, type: 'DELETE', url: genUrl(host, '')}, callback);
  };

  api.valid = function() { return true; };

  api.init = function(opts, callback) {
    var self = this;
    this.host = getHost(opts.name);
    ajax({
      auth: this.host.auth,
      type: 'PUT',
      url: genUrl(this.host, '')
    }, function(err, ret) {
      if (!err || err.status === 412) {
        call(callback, null, self);
      }
    });
  };

  api.id = function() {
    return genUrl(this.host, '');
  };

  api.info = function(callback) {
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
    if (opts.rev) {
      params.push('rev=' + opts.rev);
    }
    if (opts.conflicts) {
      params.push('conflicts=' + opts.conflicts);
    }
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    var options = {
      auth: this.host.auth,
      type: 'GET',
      url: genUrl(this.host, id + params)
    };

    if (/\//.test(id) && !/^_local/.test(id)) {
      options.dataType = false;
    }

    ajax(options, function(err, doc, xhr) {
      if (err) {
        return call(callback, Pouch.Errors.MISSING_DOC);
      }
      call(callback, null, doc, xhr);
    });
  };

  api.remove = function(doc, opts, callback) {
  };

  api.putAttachment = function(id, rev, doc, type, callback) {
    ajax({
      auth: this.host.auth,
      type:'PUT',
      url: genUrl(this.host, id) + '?rev=' + rev,
      headers: {'Content-Type': type},
      data: doc
    }, callback);
  };

  api.put = api.post = function(doc, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    ajax({
      auth: this.host.auth,
      type:'PUT',
      url: genUrl(this.host, doc._id),
      data: doc
    }, callback);
  };

  api.bulkDocs = function(req, opts, callback) {
    if (typeof opts.new_edits !== 'undefined') {
      req.new_edits = opts.new_edits;
    }
    ajax({
      auth: this.host.auth,
      type:'POST',
      url: genUrl(this.host, '_bulk_docs'),
      data: req
    }, callback);
  };
  api.allDocs = function(opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    ajax({auth: this.host.auth, type:'GET', url: genUrl(this.host, '_all_docs')}, callback);
  };

  api.changes = function(opts, callback) {
    if (opts instanceof Function) {
      opts = {complete: opts};
    }
    if (callback) {
      opts.complete = callback;
    }

    var params = '?style=all_docs'
    if (opts.include_docs) {
      params += '&include_docs=true'
    }
    if (opts.since) {
      params += '&since=' + opts.since;
    }
    ajax({auth: this.host.auth, type:'GET', url: genUrl(this.host, '_changes' + params)}, function(err, res) {
      res.results.forEach(function(c) {
        call(opts.onChange, c);
      });
      call(opts.complete, null, res);
    });
  };

  api.revsDiff = function(req, opts, callback) {
    if (opts instanceof Function) {
      callback = opts;
      opts = {};
    }
    ajax({auth: this.host.auth, type:'POST', url: genUrl(this.host, '_revs_diff'), data: req}, function(err, res) {
      call(callback, null, res);
    });
  };

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
        callback(null, obj, xhr);
      },
      error: function (err) {
        if (err) callback(err);
        else callback(true);
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
    $.ajax(options);
  };

  return api;

})());