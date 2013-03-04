/*global Pouch: true */

"use strict";

// If we wanted to store incremental views we can do it here by listening
// to the changes feed (keeping track of our last update_seq between page loads)
// and storing the result of the map function (possibly using the upcoming
// extracted adapter functions)

var Spatial = function(db) {

  var isArray = Array.isArray || function(obj) {
    return type(obj) === "array";
  };
  
  function viewQuery(fun, options) {
    if (!options.complete) {
      return;
    }

    var results = [];
    var current = null;
    var num_started= 0;
    var completed= false;

    // Make the key a proper one. If a value is a single point, transform it
    // to a range. If the first element (or the whole key) is a geometry,
    // calculate its bounding box.
    // The geometry is also returned (`null` if there is none).
    var normalizeKey = function(key) {
      var newKey = [];
      var geometry = null;

      // Whole key is one geometry
      if (!isArray(key) && typeof key === "object") {
        return {
          key: Spatial.calculateBbox(key),
          geometry: key
        };
      }

      if (!isArray(key[0]) && typeof key[0] === "object") {
        newKey = Spatial.calculateBbox(key[0]);
        geometry = key[0];
        key = key.slice(1);
      }

      for(var i=0; i<key.length; i++) {
        if(isArray(key[i])) {
          newKey.push(key[i]);
        // If only a single point, not a range was emitted
        } else {
          newKey.push([key[i], key[i]]);
        }
      }
      return {
        key: newKey,
        geometry: geometry
      };
    };

    var within = function(key, start_range, end_range) {
      var start;
      var end;

      for(var i=0; i<key.length; i++) {
        start = key[i][0];
        end = key[i][1];
        if (
          // Wildcard at the start
          ((start_range[i] === null && (start <= end_range[i] || end_range[i] === null))
           // Start is set
           || (start <= end_range[i] || end_range[i] === null))
          &&
            // Wildcard at the end
            ((end_range[i] === null && (end >= start_range[i] || start_range[i] === null))
             // End is set
             || (end >= start_range[i] || start_range[i] === null))) {
          continue;
        } else {
          return false;
        }
      }
      return true;
    };

    var emit = function(key, val) {
      var keyGeom = normalizeKey(key);
      var viewRow = {
        id: current.doc._id,
        key: keyGeom.key,
        value: val,
        geometry: keyGeom.geometry
      };

      // If no range is given, return everything
      if (options.start_range !== undefined &&
          options.end_range !== undefined) {
        if (!within(keyGeom.key, options.start_range, options.end_range)) {
          return;
        }
      }

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
        // Don't index deleted or design documents
        if (!('deleted' in doc) && doc.id.indexOf('_design/') !== 0) {
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

    // TODO vmx 2013-01-27: Support skip and limit

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
      method: 'GET',
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
        var error = Pouch.error( Pouch.Errors.INVALID_REQUEST, 'Querying with a function is not supported for Spatial Views');
      return callback ? callback(error) : undefined;
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

// Store it in the Spatial object, so we can test it
Spatial.calculateBbox = function (geom) {
  var coords = geom.coordinates;
  if (geom.type === 'Point') {
    return [[coords[0], coords[0]], [coords[1], coords[1]]];
  }
  if (geom.type === 'GeometryCollection') {
    coords = geom.geometries.map(function(g) {
      return Spatial.calculateBbox(g);
    });

    // Merge all bounding boxes into one big one that encloses all
    return coords.reduce(function (acc, bbox) {
      var minX = Math.min(acc[0][0], bbox[0][0]);
      var minY = Math.min(acc[1][0], bbox[1][0]);
      var maxX = Math.max(acc[0][1], bbox[0][1]);
      var maxY = Math.max(acc[1][1], bbox[1][1]);
      return [[minX, maxX], [minY, maxY]];
    });
  }

  // Flatten coords as much as possible
  while (Array.isArray(coords[0][0])) {
    coords = coords.reduce(function(a, b) {
      return a.concat(b);
    });
  };

  // Calculate the enclosing bounding box of all coordinates
  return coords.reduce(function (acc, coord) {
    if (acc === null) {
      return [[coord[0], coord[0]], [coord[1], coord[1]]];
    }
    var minX = Math.min(acc[0][0], coord[0]);
    var minY = Math.min(acc[1][0], coord[1]);
    var maxX = Math.max(acc[0][1], coord[0]);
    var maxY = Math.max(acc[1][1], coord[1]);
    return [[minX, maxX], [minY, maxY]];
  }, null);
};

// Deletion is a noop since we dont store the results of the view
Spatial._delete = function() { };

Pouch.plugin('spatial', Spatial);
