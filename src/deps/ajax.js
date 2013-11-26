var request = require('request');
var extend = require('./extend.js');
var createBlob = require('./blob.js');

function ajax(options, callback) {

  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  function call(fun) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (typeof fun === typeof Function) {
      fun.apply(this, args);
    }
  };

  var defaultOptions = {
    method : "GET",
    headers: {},
    json: true,
    processData: true,
    timeout: 10000
  };

  options = extend(true, defaultOptions, options);


  function onSuccess(obj, resp, cb){
    if (!options.binary && !options.json && options.processData &&
        typeof obj !== 'string') {
      obj = JSON.stringify(obj);
    } else if (!options.binary && options.json && typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (e) {
        // Probably a malformed JSON from server
        call(cb, e);
        return;
      }
    }
    call(cb, null, obj, resp);
  };

  function onError(err, cb){
    var errParsed;
    var errObj = {status: err.status};
    try {
      errParsed = JSON.parse(err.responseText);
      //would prefer not to have a try/catch clause
      errObj = extend(true, {}, errObj, errParsed);
    } catch(e) {}
    call(cb, errObj);
  };

  if (typeof window !== 'undefined' && window.XMLHttpRequest) {
    var timer, timedout = false;
    var xhr = new XMLHttpRequest();

    xhr.open(options.method, options.url);
    xhr.withCredentials = true;

    if (options.json) {
      options.headers.Accept = 'application/json';
      options.headers['Content-Type'] = options.headers['Content-Type'] ||
        'application/json';
      if (options.body && options.processData && typeof options.body !== "string") {
        options.body = JSON.stringify(options.body);
      }
    }

    if (options.binary) {
      xhr.responseType = 'arraybuffer';
    }

    function createCookie(name,value,days) {
      if (days) {
	var date = new Date();
	date.setTime(date.getTime()+(days*24*60*60*1000));
	var expires = "; expires="+date.toGMTString();
      } else {
        var expires = "";
      }
      document.cookie = name+"="+value+expires+"; path=/";
    }

    for (var key in options.headers) {
      if (key === 'Cookie') {
        var cookie = options.headers[key].split('=');
        createCookie(cookie[0], cookie[1], 10);
      } else {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }

    if (!("body" in options)) {
      options.body = null;
    }

    function abortReq() {
      timedout=true;
      xhr.abort();
      call(onError, xhr, callback);
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || timedout) {
        return;
      }
      clearTimeout(timer);
      if (xhr.status >= 200 && xhr.status < 300) {
        var data;
        if (options.binary) {
          data = createBlob([xhr.response || ''], {
            type: xhr.getResponseHeader('Content-Type')
          });
        } else {
          data = xhr.responseText;
        }
        call(onSuccess, data, xhr, callback);
      } else {
         call(onError, xhr, callback);
      }
    };

    if (options.timeout > 0) {
      timer = setTimeout(abortReq, options.timeout);
    }
    xhr.send(options.body);
    return {abort:abortReq};

  } else {

    if (options.json) {
      if (!options.binary) {
        options.headers.Accept = 'application/json';
      }
      options.headers['Content-Type'] = options.headers['Content-Type'] ||
        'application/json';
    }

    if (options.binary) {
      options.encoding = null;
      options.json = false;
    }

    if (!options.processData) {
      options.json = false;
    }

    return request(options, function (err, response, body) {
      if (err) {
        err.status = response ? response.statusCode : 400;
        return call(onError, err, callback);
      }

      var content_type = response.headers['content-type'];
      var data = (body || '');

      // CouchDB doesn't always return the right content-type for JSON data, so
      // we check for ^{ and }$ (ignoring leading/trailing whitespace)
      if (!options.binary && (options.json || !options.processData) &&
          typeof data !== 'object' &&
          (/json/.test(content_type) ||
           (/^[\s]*\{/.test(data) && /\}[\s]*$/.test(data)))) {
        data = JSON.parse(data);
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        call(onSuccess, data, response, callback);
      }
      else {
        if (options.binary) {
          data = JSON.parse(data.toString());
        }
        data.status = response.statusCode;
        call(callback, data);
      }
    });
  }
};

module.exports = ajax;
