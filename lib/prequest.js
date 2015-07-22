'use strict';

var ajax = require('./deps/ajax');

var ua = (typeof window !== 'undefined') &&
  window.navigator && window.navigator.userAgent;
var isSafari = ua && (ua.indexOf('Safari') !== -1 &&
                      ua.indexOf('Chrome') === -1);
var isIE = ua && ua.indexOf('MSIE') > -1;

module.exports = function(opts, callback) {

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  // Also Safari caches POSTs, so we need to cache-bust those too.
  if (process.browser && !opts.cache &&
      ((isSafari && opts.method === 'POST') ||
       (isIE && opts.method === 'GET'))) {
    var hasArgs = opts.url.indexOf('?') !== -1;
    opts.url += (hasArgs ? '&' : '?') + '_nonce=' + Date.now();
  }

  return ajax(opts, callback);
};
