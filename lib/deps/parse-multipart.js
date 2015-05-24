'use strict';

var btoaShim = require('./base64').btoa;

// parse a multipart/mixed response from CouchDB, expected
// as a binary string
function parseMultipart(binString) {
  var parts = binString.split('\r\n');
  var boundary = parts[1].match(/boundary="([^"]+)"/)[1];

  var doc = JSON.parse(parts[6]);
  if (doc._attachments) {
    Object.keys(doc._attachments).forEach(function (filename) {
      var att = doc._attachments[filename];
      // we don't need these
      var keys = ['revpos', 'follows', 'encoding', 'encoded_length'];
      keys.forEach(function (key) {
        delete att[key];
      });
    });
  }

  var i = 7;
  while (true) {
    var part = parts[i++];

    if (part === ('--' + boundary + '--')) {
      break;
    }
    var filename;

    while (true) {
      part = parts[i++];
      if (part === '') {
        break;
      }
      var filenameMatcher = part.match(
        /Content-Disposition: attachment; filename="([^"]+)"/i);
      if (filenameMatcher) {
        filename = filenameMatcher[1];
      }
    }

    part = parts[i++];
    var base64 = btoaShim(part);

    doc._attachments[filename].content = base64;
  }
  return doc;
}

module.exports = parseMultipart;