'use strict';

// Create a multipart/related stream out of a document,
// so we can upload documents in that format when
// attachments are large. This is shamefully stolen from
// https://github.com/sballesteros/couch-multipart-stream/
// and https://github.com/npm/npm-fullfat-registry

var base64 = require('./binary/base64');
var atob = base64.atob;
var uuid = require('./uuid');
var createBlob = require('./binary/blob');
var binaryStringToArrayBuffer = require('./binary/binaryStringToArrayBuffer');
var utils = require('../utils');
var clone = utils.clone;
var isBrowser = typeof process === 'undefined' || process.browser;
var buffer = require('./buffer');

function createBlobOrBuffer(parts, type) {
  if (isBrowser) {
    return createBlob(parts, {type: type});
  }
  return buffer.concat(parts.map(function (part) {
    return new buffer(part, 'binary');
  }));
}

function createMultipart(doc) {
  doc = clone(doc);

  var boundary = uuid();

  var nonStubAttachments = {};

  Object.keys(doc._attachments).forEach(function (filename) {
    var att = doc._attachments[filename];
    if (att.stub) {
      return;
    }
    var binData = atob(att.data);
    nonStubAttachments[filename] = {type: att.content_type, data: binData};
    att.length = binData.length;
    att.follows = true;
    delete att.digest;
    delete att.data;
  });

  var preamble = '--' + boundary +
    '\r\nContent-Type: application/json\r\n\r\n';

  var parts = [preamble, JSON.stringify(doc)];

  Object.keys(nonStubAttachments).forEach(function (filename) {
    var att = nonStubAttachments[filename];
    var preamble = '\r\n--' + boundary +
      '\r\nContent-Disposition: attachment; filename=' +
        JSON.stringify(filename) +
      '\r\nContent-Type: ' + att.type +
      '\r\nContent-Length: ' + att.data.length +
      '\r\n\r\n';
    parts.push(preamble);
    parts.push(isBrowser ? binaryStringToArrayBuffer(att.data) : att.data);
  });

  parts.push('\r\n--' + boundary + '--');

  var type = 'multipart/related; boundary=' + boundary;
  var body = createBlobOrBuffer(parts, type);

  return {
    headers: {
      'Content-Type': type
    },
    body: body
  };
}

module.exports = createMultipart;
