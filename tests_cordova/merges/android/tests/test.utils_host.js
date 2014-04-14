'use strict';

testUtils.couchHost = function() {
  var host = window.location.search.match(/[?&]host=([^&]+)/);
  return host && host[1] || 'http://10.0.2.2:5984';
}

