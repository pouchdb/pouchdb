"use strict";

var createBlob = require('./blob.js');
var errors = require('./errors');
var utils = require("../utils");
var hasUpload;

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

  options = utils.clone(options);

  var defaultOptions = {
    method : "GET",
    headers: {},
    json: true,
    processData: true,
    timeout: 10000,
    cache: false
  };

  options = utils.extend(true, defaultOptions, options);

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  if (options.method === 'GET' && !options.cache) {
    var hasArgs = options.url.indexOf('?') !== -1;
    options.url += (hasArgs ? '&' : '?') + '_nonce=' + utils.uuid(16);
  }

  function parseMultipart(contentType, arrayBuffer, resultArray) {
    var boundary = contentType.match(/boundary=\"?([^\s\"]+)/)[1];
    var data = '\r\n' + arrayBuffer; // use ascii data here
    var parts = data.split('\r\n--' + boundary.trim() +
      '--', 1)[0].split('\r\n--' + boundary.trim() + '\r\n');

    resultArray = resultArray || [];

    parts.forEach(function (part, index) {
      // skip data in front of first boundary
      if (index === 0) {
        return;
      }

      var dataPos = part.indexOf('\r\n\r\n');

      var result = {
        headers: {},
        content: part.substr(dataPos + 4)
      };

      part.substr(0, dataPos).split('\r\n').forEach(function (header) {
        var h = header.split(/\:\s?/);
        result.headers[h[0]] = h[1];
      });

      if (result.headers['Content-Type'].match(/^multipart\//)) {
        // recurse into the next multipart item
        parseMultipart(result.headers['Content-Type'],
          result.content, resultArray);
      } else {
        resultArray.push(result);
      }
    });

    return resultArray;
  }

  function parseMultipartResponse(contentType, arrayBuffer, resp, cb) {
    var multipart = parseMultipart(contentType, arrayBuffer);

    var jsonParts = multipart.filter(function (part) {
      return part.headers['Content-Type'] === 'application/json';
    });

    var obj = [];

    jsonParts.forEach(function (part) {
      part = JSON.parse(part.content);

      Object.keys(part._attachments || {}).forEach(function (filename) {
        var file = part._attachments[filename];
        if (!file.follows) {
          return;
        }
        // the file should be in the multipart

        var files = multipart.filter(function (part) {
          return part.headers['Content-Disposition'] ===
            ('attachment; filename="' + filename + '"');
        });
        if (files.length !== 1) {
          throw new Error("File " + filename +
            " not found or more than one found");
        }

        delete file.follows;
        file.data = utils.createBlob([files[0].content]);
      });

      // this should be the answer for a revs request at least
      obj.push({ok: part});
    });
    cb(null, obj, resp);
  }

  function onSuccess(obj, resp, cb) {
    var contentType = resp.getResponseHeader('Content-Type');
    if (contentType && contentType.match(/^multipart\//)) {
      return parseMultipartResponse(contentType, obj, resp, cb);
    }

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
      errParsed = JSON.parse(err.response);
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
    if (err.withCredentials && err.status === 0) {
      // apparently this is what we get when the method
      // is reported as not allowed by CORS. so fudge it
      errObj.status = 405;
      errObj.statusText = "Method Not Allowed";
    }
    cb(errObj);
  }

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
    options.headers.Accept = 'application/json, multipart/mixed';
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
      var contentType = xhr.getResponseHeader('Content-Type');
      if (options.binary) {
        data = createBlob([xhr.response || ''], {
          type: contentType
        });
      } else {
        data = xhr.response;
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
    if (typeof hasUpload === 'undefined') {
      // IE throws an error if you try to access it directly
      hasUpload = Object.keys(xhr).indexOf('upload') !== -1;
    }
    if (hasUpload) { // does not exist in ie9
      xhr.upload.onprogress = xhr.onprogress;
    }
  }
  if (options.body && (options.body instanceof Blob)) {
    utils.readAsBinaryString(options.body, function (binary) {
      xhr.send(utils.fixBinary(binary));
    });
  } else {
    xhr.send(options.body);
  }
  return {abort: abortReq};
}

module.exports = ajax;
