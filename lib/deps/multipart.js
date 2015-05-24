'use strict';

// Create a multipart/related stream out of a document,
// so we can upload documents in that format when
// attachments are large. This is shamefully stolen from
// https://github.com/sballesteros/couch-multipart-stream/
// and https://github.com/npm/npm-fullfat-registry

var base64 = require('./base64');
var uuid = require('./uuid');
var utils = require('../utils');

function BinaryBuilder() {
  this.parts = [];
}
BinaryBuilder.prototype.append = function add(part) {
  this.parts.push(part);
  return this;
};
BinaryBuilder.prototype.build = function build(type) {
  return utils.createBlob(this.parts, {type: type});
};

module.exports = function createMultipart(doc) {
  doc = utils.clone(doc);

  var boundary = uuid();

  var attachments = {};

  // according to npm/npm-fullfat-registry, these need to be sorted
  // or else CouchDB has a fit
  var filenames = Object.keys(doc._attachments).sort();
  filenames.forEach(function (filename) {
    var att = doc._attachments[filename];
    if (att.stub) {
      return;
    }
    var binData = base64.atob(att.data);
    attachments[filename] = {type: att.content_type, data: binData};
    att.length = binData.length;
    att.follows = true;
    delete att.revpos;
    delete att.data;
  });

  var preamble = '--' + boundary +
    '\r\nContent-Type: application/json\r\n\r\n';

  var origAttachments = doc._attachments;
  doc._attachments = {};
  var origKeys = Object.keys(origAttachments).sort();
  origKeys.forEach(function (key) {
    doc._attachments[key] = origAttachments[key];
  });

  var docJson = JSON.stringify(doc);

  var body = new BinaryBuilder()
    .append(preamble)
    .append(docJson);

  var attsToEncode = Object.keys(attachments).sort();
  attsToEncode.forEach(function (filename) {
    var att = attachments[filename];
    var binString = att.data;
    var type = att.type;
    var preamble = '\r\n--' + boundary +
      '\r\nContent-Disposition: attachment; filename=' +
        JSON.stringify(filename) + '' +
      '\r\nContent-Type: ' + type +
      '\r\nContent-Length: ' + binString.length +
      '\r\n\r\n';
    body.append(preamble).append(utils.fixBinary(binString));
  });

  var ending = '\r\n--' + boundary + '--';
  body.append(ending);

  var type = 'multipart/related; boundary=' + boundary;
  return {
    headers: {
      'Content-Type': type
    },
    body: body.build(type)
  };
};