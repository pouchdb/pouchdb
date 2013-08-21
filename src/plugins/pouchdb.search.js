/*global Pouch: true */

"use strict";



var Search = function(db) {

  /*function viewQuery(fun, options) {
    if (!options.complete) {
      return;
    }

    if (!fun.reduce) {
      options.reduce = false;
    }

    function sum(values) {
      return values.reduce(function(a, b) { return a + b; }, 0);
    }

    var builtInReduce = {
      "_sum": function(keys, values){
        return sum(values);
      },

      "_count": function(keys, values, rereduce){
        if (rereduce){
          return sum(values);
        } else {
          return values.length;
        }
      },

      "_stats": function(keys, values, rereduce) {
        return {
          'sum': sum(values),
          'min': Math.min.apply(null, values),
          'max': Math.max.apply(null, values),
          'count': values.length,
          'sumsqr': (function(){
            var _sumsqr = 0;
            for(var idx in values) {
              if (typeof values[idx] === 'number') {
              _sumsqr += values[idx] * values[idx];
              }
            }
            return _sumsqr;
          })()
        };
      }
    };

    var results = [];
    var current = null;
    var num_started= 0;
    var completed= false;

    var emit = function(key, val) {
      var viewRow = {
        id: current.doc._id,
        key: key,
        value: val
      };

      if (options.startkey && pouchCollate(key, options.startkey) < 0) return;
      if (options.endkey && pouchCollate(key, options.endkey) > 0) return;
      if (options.key && pouchCollate(key, options.key) !== 0) return;

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

    
    eval('fun.map = ' + fun.map.toString() + ';');
    if (fun.reduce) {
      if (builtInReduce[fun.reduce]) {
        fun.reduce = builtInReduce[fun.reduce];
      }

      eval('fun.reduce = ' + fun.reduce.toString() + ';');
    }

    var checkComplete= function(){
      if (completed && results.length == num_started){
        results.sort(function(a, b) {
          return pouchCollate(a.key, b.key);
        });
        if (options.descending) {
          results.reverse();
        }
        if (options.reduce === false) {
          return options.complete(null, {
            rows: ('limit' in options)
              ? results.slice(0, options.limit)
              : results,
            total_rows: results.length
          });
        }

        var groups = [];
        results.forEach(function(e) {
          var last = groups[groups.length-1] || null;
          if (last && pouchCollate(last.key[0][0], e.key) === 0) {
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

        options.complete(null, {
          rows: ('limit' in options)
            ? groups.slice(0, options.limit)
            : groups,
          total_rows: groups.length
        });
      }
    };

    db.changes({
      conflicts: true,
      include_docs: true,
      onChange: function(doc) {
        if (!('deleted' in doc)) {
          current = {doc: doc.doc};
          fun.map.call(this, doc.doc);
        }
      },
      complete: function() {
        completed= true;
        checkComplete();
      }
    });
  }*/

  function httpQuery(fun, opts, callback) {

    // List of parameters to add to the PUT request
    var params = [];
    var body = undefined;
    var method = 'GET';

    // If opts.reduce exists and is defined, then add it to the list
    // of parameters.
    // If reduce=false then the results are that of only the map function
    // not the final result of map and reduce.
    for(var key in opts){
      params.push(key+'='+opts[key]);
    }

    // If keys are supplied, issue a POST request to circumvent GET query string limits
    // see http://wiki.apache.org/couchdb/HTTP_view_API#Querying_Options
    if (typeof opts.keys !== 'undefined') {
      method = 'POST';
      body = JSON.stringify({keys:opts.keys});
    }

    // Format the list of parameters into a valid URI query string
    params = params.join('&');
    params = params === '' ? '' : '?' + params;

    // We are referencing a query defined in the design doc
    if (typeof fun === 'string') {
      var parts = fun.split('/');
      db.request({
        method: method,
        url: '_design/' + parts[0] + '/_search/' + parts[1] + params,
        body: body
      }, callback);
      return;
    }

}

  function search(fun, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    if (callback) {
      opts.complete = callback;
    }

    if (db.type() === 'http') {
      return httpQuery(fun, opts, callback);
    }


    /*var parts = fun.split('/');
    db.get('_design/' + parts[0], function(err, doc) {
      if (err) {
        if (callback) callback(err);
        return;
      }

      if (!doc.views[parts[1]]) {
        if (callback) callback({ error: 'not_found', reason: 'missing_named_view' });
        return;
      }

      viewQuery({
        map: doc.views[parts[1]].map,
        reduce: doc.views[parts[1]].reduce
      }, opts);
    });*/
  }

  return {'search': search};
}

// Deletion is a noop since we dont store the results of the view
Search._delete = function() { };

Pouch.plugin('Search', Search);
