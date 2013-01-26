/*global Pouch: true */

"use strict";

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

var Spatial = function(db) {

  function viewQuery(fun, options) {
    if (!options.complete) {
      return;
    }

    var results = [];
    var current = null;
    var num_started= 0;
    var completed= false;

    var within = function(key, start_range, end_range) {
      var start;
      var end;
      for(var i=0; i<key.length; i++) {
        if(isArray(key[i])) {
          start = key[i][0];
          end = key[i][1];
        // If only a single point, not a range was emitted
        } else {
          start = key[i];
          end = key[i];
        }
        if ((start_range[i] == null || start <= end_range[i]) &&
          (end_range[i] == null || end >= start_range[i])) {
          continue;
        } else {
          return false;
        }
      }
      return true;
    };

    var emit = function(key, val) {
      var viewRow = {
        id: current._id,
        key: key,
        value: val
      };

      if (!within(key, options.start_range, options.end_range)) return;

      num_started++;
      if (options.include_docs) {
        //in this special case, join on _id (issue #106)
        if (val && typeof val === 'object' && val._id){
          db.get(val._id,
              function(_, joined_doc){
                if (joined_doc) {
                  viewRow.doc = joined_doc;
                }
                results.push(viewRow);
                checkComplete();
              });
          return;
        } else {
          viewRow.doc = current.doc;
        }
      }
      results.push(viewRow);
    };

    // ugly way to make sure references to 'emit' in map/reduce bind to the
    // above emit
    eval('fun = ' + fun.toString() + ';');

    // exclude  _conflicts key by default
    // or to use options.conflicts if it's set when called by db.query
    var conflicts = ('conflicts' in options ? options.conflicts : false);

    // only proceed once all documents are mapped and joined
    var checkComplete= function() {
      if (completed && results.length == num_started){
        return options.complete(null, {rows: results});
      }
    }

    db.changes({
      conflicts: conflicts,
      include_docs: true,
      onChange: function(doc) {
        if (!('deleted' in doc)) {
          current = {doc: doc.doc};
          fun.call(this, doc.doc);
        }
      },
      complete: function() {
        completed= true;
        checkComplete();
      }
    });
  }

  function httpQuery(location, opts, callback) {

    // List of parameters to add to the PUT request
    var params = [];

    if (typeof opts.limit !== 'undefined') {
      params.push('limit=' + opts.limit);
    }
    if (typeof opts.limit !== 'undefined') {
      params.push('skip=' + opts.skip);
    }
    if (typeof opts.descending !== 'undefined') {
      params.push('descending=' + opts.descending);
    }
    if (typeof opts.start_range !== 'undefined') {
      params.push('start_range=' + encodeURIComponent(JSON.stringify(
        opts.start_range)));
    }
    if (typeof opts.end_range !== 'undefined') {
      params.push('end_range=' + encodeURIComponent(JSON.stringify(
        opts.end_range)));
    }
    if (typeof opts.key !== 'undefined') {
      params.push('key=' + encodeURIComponent(JSON.stringify(opts.key)));
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    // We are referencing a query defined in the design doc
    var parts = location.split('/');
    db.request({
      type:'GET',
      url: '_design/' + parts[0] + '/_spatial/' + parts[1] + params
    }, callback);
  }

  function query(fun, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (callback) {
      opts.complete = callback;
    }

    if (typeof fun !== 'string') {
        var error = extend({reason: 'Querying with a function is not ' +
         'supported for Spatial Views'}, Pouch.Errors.INVALID_REQUEST);
      return call(callback, error);
    }

    if (db.type() === 'http') {
      return httpQuery(fun, opts, callback);
    }

    var parts = fun.split('/');
    db.get('_design/' + parts[0], function(err, doc) {
      if (err) {
        if (callback) callback(err);
        return;
      }
      viewQuery(doc.spatial[parts[1]], opts);
    });
  }

  return {spatial: query};
};

// Deletion is a noop since we dont store the results of the view
Spatial._delete = function() { };

Pouch.plugin('spatial', Spatial);
