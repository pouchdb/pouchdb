
"use strict";

var downloadRoot = 'http://download.pouchdb.com/';
var qs = function(selector) {
  return document.querySelector(selector);
};

qs('#download-button').addEventListener('click', function() {
  var selected = document.querySelector('[name=download]:checked').value;
  var prefix = (selected === 'min') ? 'min.' : '';
  var url = downloadRoot + 'pouchdb-nightly.' + prefix + 'js';
  document.location.href = url;
});