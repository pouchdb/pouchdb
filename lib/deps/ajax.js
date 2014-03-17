"use strict";

var request = require('request');
var extend = require('./extend.js');
var createBlob = require('./blob.js');
var errors = require('./errors');
var uuid = require('../deps/uuid');
var utils = require("../utils");

function ajax(options, adapterCallback) {

  var requestCompleted = false;
  var callback = utils.getArguments(function (args) {
    if (requestCompleted) {
      return;
    }
    adapterCallback.apply(this, args);
    requestCompleted = true;
  });

  if (typeof options === "function") {
    callback = options;
    options = {};
  }

  options = extend(true, {}, options);

  var defaultOptions = {
    method : "GET",
    headers: {},
    json: true,
    processData: true,
    timeout: 10000,
    cache: false
  };

  options = extend(true, defaultOptions, options);

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  if (options.method === 'GET' && !options.cache) {
    var hasArgs = options.url.indexOf('?') !== -1;
    options.url += (hasArgs ? '&' : '?') + '_nonce=' + uuid(16);
  }

  function onSuccess(obj, resp, cb) {
    if (!options.binary && !options.json && options.processData &&
      typeof obj !== 'string') {
      obj = JSON.stringify(obj);
    } else if (!options.binary && options.json && typeof obj === 'string') {
      try {
        obj = JSON.parse(obj);
      } catch (e) {
        // Probably a malformed JSON from server
        return cb(e);
      }
    }
    if (Array.isArray(obj)) {
      obj = obj.map(function (v) {
        var obj;
        if (v.ok) {
          return v;
        } else if (v.error && v.error === 'conflict') {
          obj = errors.REV_CONFLICT;
          obj.id = v.id;
          return obj;
        } else if (v.error && v.error === 'forbidden') {
          obj = errors.FORBIDDEN;
          obj.id = v.id;
          obj.reason = v.reason;
          return obj;
        } else if (v.missing) {
          obj = errors.MISSING_DOC;
          obj.missing = v.missing;
          return obj;
        } else {
          return v;
        }
      });
    }
    cb(null, obj, resp);
  }

  function onError(err, cb) {
    var errParsed, errObj, errType, key;
    try {
      errParsed = JSON.parse(err.responseText);
      //would prefer not to have a try/catch clause
      for (key in errors) {
        if (errors.hasOwnProperty(key) &&
            errors[key].name === errParsed.error) {
          errType = errors[key];
          break;
        }
      }
      if (!errType) {
        errType = errors.UNKNOWN_ERROR;
        if (err.status) {
          errType.status = err.status;
        }
        if (err.statusText) {
          err.name = err.statusText;
        }
      }
      errObj = errors.error(errType, errParsed.reason);
    } catch (e) {
      for (var key in errors) {
        if (errors.hasOwnProperty(key) && errors[key].status === err.status) {
          errType = errors[key];
          break;
        }
      }
      if (!errType) {
        errType = errors.UNKNOWN_ERROR;
        if (err.status) {
          errType.status = err.status;
        }
        if (err.statusText) {
          err.name = err.statusText;
        }
      }
      errObj = errors.error(errType);
    }
    cb(errObj);
  }

  if (process.browser) {
    var timer;
    var xhr;
    if (options.xhr) {
      xhr = new options.xhr();
    } else {
      xhr = new XMLHttpRequest();
    }
    xhr.open(options.method, options.url);
    xhr.withCredentials = true;

    if (options.json) {
      options.headers.Accept = 'application/json';
      options.headers['Content-Type'] = options.headers['Content-Type'] ||
        'application/json';
      if (options.body &&
          options.processData &&
          typeof options.body !== "string") {
        options.body = JSON.stringify(options.body);
      }
    }

    if (options.binary) {
      xhr.responseType = 'arraybuffer';
    }

    var createCookie = function (name, value, days) {
      var expires = "";
      if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
      }
      document.cookie = name + "=" + value + expires + "; path=/";
    };

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

    var abortReq = function () {
      if (requestCompleted) {
        return;
      }
      xhr.abort();
      onError(xhr, callback);
    };

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || requestCompleted) {
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
        onSuccess(data, xhr, callback);
      } else {
        onError(xhr, callback);
      }
    };

    if (options.timeout > 0) {
      timer = setTimeout(abortReq, options.timeout);
      xhr.onprogress = function () {
        clearTimeout(timer);
        timer = setTimeout(abortReq, options.timeout);
      };
      if (xhr.upload) { // does not exist in ie9
        xhr.upload.onprogress = xhr.onprogress;
      }
    }
    xhr.send(options.body);
    return {abort: abortReq};

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
        return onError(err, callback);
      }
      var error;
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
        onSuccess(data, response, callback);
      }
      else {
        if (options.binary) {
          data = JSON.parse(data.toString());
        }
        if (data.reason === 'missing') {
          error = errors.MISSING_DOC;
        } else if (data.reason === 'no_db_file') {
          error = errors.error(errors.DB_MISSING, data.reason);
        } else if (data.error === 'conflict') {
          error = errors.REV_CONFLICT;
        } else {
          error = errors.error(errors.UNKNOWN_ERROR, data.reason, data.error);
        }
        error.status = response.statusCode;
        callback(error);
      }
    });
  }
}

module.exports = ajax;
