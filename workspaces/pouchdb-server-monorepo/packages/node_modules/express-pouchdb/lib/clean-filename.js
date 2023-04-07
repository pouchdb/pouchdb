'use strict';

var sanitize = require('sanitize-filename');

function cleanFilename(name) {
  // some windows reserved names like 'con' and 'prn'
  // return an empty string here, so just wrap them in
  // double underscores so it's at least something
  return sanitize(name) || sanitize('__' + name + '__');
}

module.exports = cleanFilename;