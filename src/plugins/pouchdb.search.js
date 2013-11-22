/*global Pouch: true, pouchCollate: true */

"use strict";

var pouchCollate;
if (typeof module !== 'undefined' && module.exports) {
  pouchCollate = require('../pouch.collate.js');
}

// This is the first implementation of a basic plugin, we register the
// plugin object with pouch and it is mixin'd to each database created
// (regardless of adapter), adapters can override plugins by providing
// their own implementation. functions on the plugin object that start
// with _ are reserved function that are called by pouchdb for special
// notifications.

// If we wanted to store incremental views we can do it here by listening
// to the changes feed (keeping track of our last update_seq between page loads)
// and storing the result of the map function (possibly using the upcoming
// extracted adapter functions)

var Search = function(db) {

  function httpQuery(name, opts, callback) {

    // List of parameters to add to the PUT request
    var params = [];
    if (typeof opts.q !== 'undefined') {
      params.push('q=' + opts.q);
    }
    if (typeof opts.include_docs !== 'undefined') {
      params.push('include_docs=' + opts.include_docs);
    }
    if (typeof opts.limit !== 'undefined') {
      params.push('limit=' + opts.limit);
    }
    if (typeof opts.sort !== 'undefined') {
      params.push('sort=' + opts.sort);
    }
    if (typeof opts.bookmark !== 'undefined') {
      params.push('bookmark=' + opts.bookmark);
    }
    if (typeof opts.stale !== 'undefined') {
      params.push('stale=' + stale);
    }

    // If keys are supplied, issue a POST request to circumvent GET query string limits
    // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

      var parts = name.split('/');
      db.request({
        method: 'GET',
        url: '_design/' + parts[0] + '/_search/' + parts[1] + params
      }, callback);
  }

  function query(name, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (db.type() === 'http') {
    return httpQuery(name, opts, callback);
  }
}
  return {'search': query};
};

// Deletion is a noop since we dont store the results of the view
Search._delete = function() { };

Pouch.plugin('search', Search);
