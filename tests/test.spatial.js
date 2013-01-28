"use strict";

var adapters = ['local-1', 'http-1'];
var qunit = module;

// if we are running under node.js, set things up
// a little differently, and only test the leveldb adapter
if (typeof module !== undefined && module.exports) {
  var Pouch = require('../src/pouch.js')
    , LevelPouch = require('../src/adapters/pouch.leveldb.js')
    , utils = require('./test.utils.js');

  for (var k in utils) {
    global[k] = global[k] || utils[k];
  }
  adapters = ['leveldb-1', 'http-1'];
  qunit = QUnit.module;
}

adapters.map(function(adapter) {

  qunit('spatial: ' + adapter, {
    setup : function () {
      this.name = generateAdapterUrl(adapter);
    },
    teardown: function() {
      if (!PERSIST_DATABASES) {
        Pouch.destroy(this.name);
      }
    }
  });


  asyncTest("Test basic spatial view", function() {
    var designDoc = {
      _id: '_design/foo',
      spatial: {
        test: 'function(doc) {if (doc.key) {emit(doc.key, doc); }}'
      }
    };

    var docs = [
      designDoc,
      {foo: 'bar', key: [1]},
      {_id: 'volatile', foo: 'baz', key: [2]}
    ];

    initTestDB(this.name, function(err, db) {
    db.bulkDocs({docs: docs}, {}, function() {
        db.get('volatile', function(_, doc) {
          db.remove(doc, function(_, resp) {
            db.spatial('foo/test', {start_range: [null], end_range: [null]}, function(_, res) {
              equal(res.rows.length, 1, 'Dont include deleted documents');
              res.rows.forEach(function(x, i) {
                ok(x.key, 'view row has a key');
                ok(x.value._rev, 'emitted doc has rev');
                ok(x.value._id, 'emitted doc has id');
              });
              start();
            });
          });
        });
      });
    });
  });

  asyncTest("Test opts.start_range/opts.end_range", function() {
    var designDoc = {
      _id: '_design/foo',
      spatial: {
        test: 'function(doc) {if (doc.key) {emit(doc.key, doc);}}'
      }
    };

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: [designDoc, {key: [10, 100]},{key: [20, 200]},{key: [30, 300]},{key: [40, 400]},{key: [50, 500]}]}, {}, function() {
        db.spatial('foo/test', {start_range: [21, 301], end_range: [49, 1000]}, function(_, res) {
          equal(res.rows.length, 1, 'start_range/end_range query 1');
          db.spatial('foo/test', {start_range: [1, 201], end_range: [49, 401]}, function(_, res) {
            equal(res.rows.length, 2, 'start_range/end_range query 2');
            start();
          });
        });
      });
    });
  });

  asyncTest("Basic tests from GeoCouch test suite", 9, function() {
    // some geometries are based on the GeoJSON specification
    // http://geojson.org/geojson-spec.html (2010-08-17)
    var values = [
      { "type": "Point", "coordinates": [100.0, 0.0] },
      { "type": "LineString", "coordinates":[
        [100.0, 0.0], [101.0, 1.0]
        ]},
      { "type": "Polygon", "coordinates": [
        [ [100.0, 0.0], [101.0, 0.0], [100.0, 1.0], [100.0, 0.0] ]
        ]},
      { "type": "Polygon", "coordinates": [
        [ [100.0, 0.0], [101.0, 0.0], [100.0, 1.0], [100.0, 0.0] ],
        [ [100.2, 0.2], [100.6, 0.2], [100.2, 0.6], [100.2, 0.2] ]
      ]},
      { "type": "MultiPoint", "coordinates": [
        [100.0, 0.0], [101.0, 1.0]
      ]},
      { "type": "MultiLineString", "coordinates": [
        [ [100.0, 0.0], [101.0, 1.0] ],
        [ [102.0, 2.0], [103.0, 3.0] ]
      ]},
      { "type": "MultiPolygon", "coordinates": [
        [[[102.0, 2.0], [103.0, 2.0], [103.0, 3.0], [102.0, 3.0], [102.0, 2.0]]],
        [
          [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0], [100.0, 1.0], [100.0, 0.0]],
          [[100.2, 0.2], [100.8, 0.2], [100.8, 0.8], [100.2, 0.8], [100.2, 0.2]]
        ]
      ]},
      { "type": "GeometryCollection", "geometries": [
        { "type": "Point", "coordinates": [100.0, 0.0] },
        { "type": "LineString", "coordinates": [ [101.0, 0.0], [102.0, 1.0] ]}
      ]}
    ];

    var designDoc = {
      _id: '_design/geojson',
      spatial: {
        test: 'function(doc) {if (doc.geom) {emit(doc.geom, doc.geom.type);}}'
      }
    };

    initTestDB(this.name, function(err, db) {
      var docs = values.map(function(x, i) {
        return {_id: (i).toString(), geom: x};
      });
      docs.push(designDoc);

      db.bulkDocs({docs: docs}, {}, function() {
        db.spatial('geojson/test', function(_, res) {
          equal(res.rows.length, values.length,
                "The same number of returned geometries is correct");

          res.rows.forEach(function(x, i) {
            var found = values.filter(function(value) {
              if (JSON.stringify(x.geometry) === JSON.stringify(value)) {
                return true;
              }
            });
            equal(found.length, 1, "Geometry was found in the values");
          });
          start();
        });
      });
    });
  });

  asyncTest("Range tests from GeoCouch test suite", function() {
    var designDoc = {
      _id:"_design/spatial",
      language: "javascript",
      spatial: {
        withGeometry: (function(doc) {
          emit([{
            type: "Point",
            coordinates: doc.loc
          }, [doc.integer, doc.integer+5]], doc.string);
        }).toString(),
        noGeometry: (function(doc) {
          emit([[doc.integer, doc.integer+1], doc.integer*3,
            [doc.integer-14, doc.integer+100], doc.integer],
            doc.string);
        }).toString()
      }
    };

    function makeSpatialDocs(start, end) {
      var docs = [];
      for (var i=start; i<end; i++) {
        var doc = {};
        doc._id = (i).toString();
        doc.integer = i;
        doc.string = (i).toString();
        doc.loc = [i-20+doc.integer, i+15+doc.integer];
        docs.push(doc);
      }
      return docs;
    }

    function extract_ids(response) {
      if (response.length === 0) {
        return [];
      }
      var result = response.rows.map(function(row) {
        return row.id;
      });
      return result.sort();
    }

    var docs = makeSpatialDocs(0, 10);
    docs.push(designDoc);
    docs.push({_id: '10', string: '10', integer: 10, loc: [1,1]});

    initTestDB(this.name, function(err, db) {
      db.bulkDocs({docs: docs}, {}, function() {
        tests_with_geometry(db);
      });
    });

    var tests_with_geometry = function(db) {
      db.spatial('spatial/withGeometry', {start_range: [-20, 0, 6.4], end_range: [16, 25, 8.7]}, function(_, res) {
        deepEqual(extract_ids(res), ['2','3','4','5'],
                  'should return a subset of the geometries');
        db.spatial('spatial/withGeometry', {start_range: [-17, 0, 8.8], end_range: [16, 25, 8.8]}, function(_, res) {
          deepEqual(extract_ids(res), ['4','5'],
                    "should return a subset of the geometries " +
                    "(3rd dimension is single point)");
          db.spatial('spatial/withGeometry', {start_range: [-17, 0, null], end_range: [16, 25, null]}, function(_, res) {
            deepEqual(extract_ids(res), ['10','2','3','4','5'],
                      "should return a subset of the geometries " +
                      "(3rd dimension is a wildcard)");
            db.spatial('spatial/withGeometry', {start_range: [-17, 0, null], end_range: [16, 25, 8.8]}, function(_, res) {
              deepEqual(extract_ids(res), ['2','3','4','5'],
                        "should return a subset of the geometries " +
                        "(3rd dimension is open at the start)");
              db.spatial('spatial/withGeometry', {start_range: [-17, 0, 8.8], end_range: [16, 25, null]}, function(_, res) {
                deepEqual(extract_ids(res), ['10','4','5'],
                          "should return a subset of the geometries " +
                          "(3rd dimension is open at the end)");
                tests_without_geometry(db);
              });
            });
          });
        });
      });
    };

    var tests_without_geometry = function(db) {
      db.spatial('spatial/noGeometry', {start_range: [3, 0, -10, 2], end_range: [10, 21, -9, 20]}, function(_, res) {
        deepEqual(extract_ids(res), ['2','3','4','5'],
                  "should return a subset of the geometries");
        db.spatial('spatial/noGeometry', {start_range: [3, 0, -7, 5], end_range: [10, 21, -7, 20]}, function(_, res) {
          deepEqual(extract_ids(res), ['5','6','7'],
                    "should return a subset of the geometries" +
                    "(3rd dimension is a point)");
          db.spatial('spatial/noGeometry', {start_range: [3, null, -2, 4], end_range: [10, null, -2, 20]}, function(_, res) {
            deepEqual(extract_ids(res), ['10','4','5','6','7','8','9'],
                      "should return a subset of the geometries" +
                      "(2nd dimension is a wildcard)");
            db.spatial('spatial/noGeometry', {start_range: [3, null, -2, 4], end_range: [10, 15, -2, 20]}, function(_, res) {
              deepEqual(extract_ids(res), ['4','5'],
                        "should return a subset of the geometries" +
                        "(2nd dimension is open at the start)");
              db.spatial('spatial/noGeometry', {start_range: [3, 20, -2, 4], end_range: [10, null, -2, 20]}, function(_, res) {
                deepEqual(extract_ids(res), ['10','7','8','9'],
                          "should return a subset of the geometries" +
                          "(2nd dimension is open at the end)");
                start();
              });
            });
          });
        });
      });
    };
  });

});
