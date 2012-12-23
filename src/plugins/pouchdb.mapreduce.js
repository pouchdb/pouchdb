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

var MapReduce = function(db) {

  function viewQuery(fun, options) {
    if (!options.complete) {
      return;
    }

    function sum(values) {
      return values.reduce(function(a, b) { return a + b; }, 0);
    }

    var results = [];
    var current = null;

    var emit = function(key, val) {
      var viewRow = {
        id: current._id,
        key: key,
        value: val
      };
      if (options.include_docs) {
        viewRow.doc = current.doc;
      }
      results.push(viewRow);
    };

    // ugly way to make sure references to 'emit' in map/reduce bind to the
    // above emit
    eval('fun.map = ' + fun.map.toString() + ';');
    if (fun.reduce) {
      eval('fun.reduce = ' + fun.reduce.toString() + ';');
    }

    db.changes({
      include_docs: true,
      onChange: function(doc) {
        if (!('deleted' in doc)) {
          current = {doc: doc.doc};
          fun.map.call(this, doc.doc);
        }
      },
      complete: function() {
        results.sort(function(a, b) {
          return Pouch.collate(a.key, b.key);
        });
        if (options.descending) {
          results.reverse();
        }
        if (options.reduce === false) {
          return options.complete(null, {rows: results});
        }

        var groups = [];
        results.forEach(function(e) {
          var last = groups[groups.length-1] || null;
          if (last && Pouch.collate(last.key[0][0], e.key) === 0) {
            last.key.push([e.key, e.id]);
            last.value.push(e.value);
            return;
          }
          groups.push({key: [[e.key, e.id]], value: [e.value]});
        });
        groups.forEach(function(e) {
          e.value = fun.reduce(e.key, e.value) || null;
          e.key = e.key[0][0];
        });
        options.complete(null, {rows: groups});
      }
    });
  };

  function query(fun, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (callback) {
      opts.complete = callback;
    }

    if (typeof fun === 'object') {
      return viewQuery(fun, opts);
    }

    var parts = fun.split('/');
    db.get('_design/' + parts[0], function(err, doc) {
      if (err) {
        if (callback) callback(err);
        return;
      }
      viewQuery({
        map: doc.views[parts[1]].map,
        reduce: doc.views[parts[1]].reduce
      }, opts);
    });
  }

  return {'query': query};
};

// Deletion is a noop since we dont store the results of the view
MapReduce._delete = function() { }

Pouch.plugin('mapreduce', MapReduce);
