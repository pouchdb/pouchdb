
"use strict";

var downloadRoot = 'http://cloud.github.com/downloads/daleharvey/pouchdb/';
var qs = function(selector) {
  return document.querySelector(selector);
};

qs('#download-button').addEventListener('click', function() {
  var selected = document.querySelector('[name=download]:checked').value;
  var prefix = (selected === 'min') ? 'min.' : '';
  var url = downloadRoot + 'pouch.alpha.' + prefix + 'js';
  document.location.href = url;
});