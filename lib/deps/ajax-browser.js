"use strict";

var createBlob = require('./blob.js');
var errors = require('./errors');
var utils = require("../utils");
var hasUpload;

// http://updates.html5rocks.com/2012/06/
// How-to-convert-ArrayBuffer-to-and-from-String
function arrayBufferToUtf8(arrayBuffer) {
  var result = "";
  var i = 0;
  var c = 0;
  var c2 = 0;
  var c3 = 0;

  var data = new Uint8Array(arrayBuffer);

  // If we have a BOM skip it
  if (data.length >= 3 && data[0] === 0xef &&
      data[1] === 0xbb && data[2] === 0xbf) {
    i = 3;
  }

  while (i < data.length) {
    c = data[i];

    if (c < 128) {
      result += String.fromCharCode(c);
      i++;
    } else if (c > 191 && c < 224) {
      if (i + 1 >= data.length) {
        throw "UTF-8 Decode failed. Two byte character was truncated.";
      }
      c2 = data[i + 1];
      result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
      i += 2;
    } else {
      if (i + 2 >= data.length) {
        throw "UTF-8 Decode failed. Multi byte character was truncated.";
      }
      c2 = data[i + 1];
      c3 = data[i + 2];
      result += String.fromCharCode(
        ((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      i += 3;
    }
  }
  return result;
}

// from http://stackoverflow.com/questions/
// 16363419/how-to-get-binary-string-from-arraybuffer
function arrayBufferToString(buffer) {
  // loop instead of apply, otherwise maximum call stack size exceeded
  // see http://stackoverflow.com/questions/9267899/
  // arraybuffer-to-base64-encoded-string
  // FIXME possibly this runs faster with chunks instead of loop
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

function stringToArrayBuffer(string) {
  return stringToUint8Array(string).buffer;
}

function stringToBinary(string) {
  var chars, code, i, isUCS2, len, _i;

  len = string.length;
  chars = [];
  isUCS2 = false;
  for (i = _i = 0; 0 <= len ? _i < len : _i > len; i = 0 <= len ? ++_i : --_i) {
    code = String.prototype.charCodeAt.call(string, i);
    if (code > 255) {
      isUCS2 = true;
      chars = null;
      break;
    } else {
      chars.push(code);
    }
  }
  if (isUCS2 === true) {
    return global.unescape(encodeURIComponent(string));
  } else {
    // FIXME possibly this runs faster with chunks instead of loop
    var binary = '';
    len = chars.length;
    for (i = 0; i < len; i++) {
      binary += String.fromCharCode(chars[i]);
    }
    return binary;
  }
}

function stringToUint8Array(string) {
  var binary, binLen, buffer, chars, i, _i;
  binary = stringToBinary(string);
  binLen = binary.length;
  buffer = new ArrayBuffer(binLen);
  chars = new Uint8Array(buffer);
  for (i = _i = 0; 0 <= binLen ? _i < binLen : _i > binLen;
       i = 0 <= binLen ? ++_i : --_i) {
    chars[i] = String.prototype.charCodeAt.call(binary, i);
  }
  return chars;
}

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
    method: "GET",
    headers: {},
    json: true,
    processData: true,
    timeout: 0,
    cache: false
  };

  options = utils.extend(true, defaultOptions, options);

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  // if (options.method === 'GET' && !options.cache) {
  //   var hasArgs = options.url.indexOf('?') !== -1;
  //   options.url += (hasArgs ? '&' : '?') + '_nonce=' + utils.uuid(16);
  // }

  function parseMultipart(contentType, arrayBuffer, resultArray) {
    if (!contentType.match("multipart/")) {
      throw new Error("No multipart content type: " + contentType);
    }
    var boundary = contentType.match(/boundary=\"?([^\s\"]+)/)[1];
    var data = '\r\n' + arrayBufferToString(arrayBuffer); // use ascii data here
    var parts = data.split('\r\n--' + boundary.trim() +
      '--', 1)[0].split('\r\n--' + boundary.trim() + '\r\n');

    resultArray = resultArray || [];

    parts.forEach(function (part, index, array) {
      // skip data in front of first boundary
      if (index === 0) {
        return;
      }

      var dataPos = part.indexOf('\r\n\r\n');

      var result = {
        headers: {},
        content: stringToArrayBuffer(part.substr(dataPos + 4))
      };

      part.substr(0, dataPos).split('\r\n').forEach(function (header) {
        var h = header.split(/\:\s?/);
        result.headers[h[0]] = h[1];
      });

      if (result.headers['Content-Type'].match("multipart/")) {
        // recurse into the next multipart item
        parseMultipart(result.headers['Content-Type'],
          result.content, resultArray);
      } else {
        resultArray.push(result);
      }
    });

    return resultArray;
  }

  function tryParseMultipart(contentType, arrayBuffer, cb) {
    try {
      var multipart = parseMultipart(contentType, arrayBuffer);

      var jsonParts = multipart.filter(function (part) {
        return part.headers['Content-Type'] === 'application/json';
      });

      var obj = [];

      jsonParts.forEach(function (part) {
        part = JSON.parse(arrayBufferToUtf8(part.content));

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
          file.data = new Blob([files[0].content]);
        });

        // this should be the answer for a revs request at least
        obj.push({ok: part});
      });
    } catch (e) {
      cb(e);
    }
  }

  function onSuccess(arrayBuffer, resp, cb) {
    var obj, contentType = resp.getResponseHeader('Content-Type');
    if (contentType && contentType.match("multipart/")) {
      return tryParseMultipart(contentType, arrayBuffer, cb);
    } else if (!options.binary) {
      // TODO always assumes utf8 here
      obj = arrayBufferToUtf8(arrayBuffer);
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
      errParsed = JSON.parse(arrayBufferToUtf8(err.response));
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

  if (true || options.binary) {
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
    var reader = new FileReader();
    reader.onloadend = function (e) {

      var binary = "";
      var bytes = new Uint8Array(this.result);
      var length = bytes.byteLength;

      for (var i = 0; i < length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }

      binary = utils.fixBinary(binary);
      xhr.send(binary);
    };
    reader.readAsArrayBuffer(options.body);
  } else {
    xhr.send(options.body);
  }
  return {abort: abortReq};
}

module.exports = ajax;
