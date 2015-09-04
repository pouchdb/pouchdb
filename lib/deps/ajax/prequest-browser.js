'use strict';

var ajax = require('./ajax-core');

function parseCookies (cookieString) {

}

function parseCookies (cookies) {
  if (!cookies) {
    return {};
  }

  return cookies.split(';').reduce(function (list, cookie) {
    var parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
    return list;
  }, {});
}

module.exports = function(opts, callback) {

  // cache-buster, specifically designed to work around IE's aggressive caching
  // see http://www.dashbay.com/2011/05/internet-explorer-caches-ajax/
  // Also Safari caches POSTs, so we need to cache-bust those too.
  if ((opts.method === 'POST' || opts.method === 'GET') && !opts.cache) {
    var hasArgs = opts.url.indexOf('?') !== -1;
    opts.url += (hasArgs ? '&' : '?') + '_nonce=' + Date.now();
  }

  if (!opts.headers) { opts.headers = {};}

  var cookies = parseCookies(document.cookie);
  var csrf = cookies['CouchDB-CSRF'] ? cookies['CouchDB-CSRF'] : 'true';
  opts.headers['X-CouchDB-CSRF'] = csrf;

  return ajax(opts, callback);
};
