'use strict';

// This is my idea of something between a property test and chaos monkey
// We are testing the one basic property of PouchDB which is whatever we
// do to databases, locally or remotely after they have synced they should
// end up with the same data.

// To do this we define a set of 'actions' that represent what an end user
// could do to a database, create / update / delete documents, perform
// replications or queries etc. We pick a number (actionCount) and randomly
// perform those actions on a random database. Once we have run enough actions
// we sync the 2 databases together and assert that they have the same contents

// We can take an optional seed from the url (?seed=hello) otherwise we just
// generate an arbitrary one. With any given seed the 'random' generations
// are deteministic so if we find a seed that fails the test we can provide
// that seed again to rerun the same actions and generate the same failure
var seed = testUtils.params().seed || Date.now();
if (Math.seedrandom) {
  Math.seedrandom(seed);
}

// This is the amount of random actions we do
var actionCount = 100;

// We pick an action from this list at random, it gets given a
// db to operate on if it only uses one database
var actions = {

  // Create a random document
  'create': function (a) {
    return a.post({'a': 'newdoc'});
  },

  // Pick from an existing document and updated it
  'update': function (a) {
    return randomDoc(a).then(function (doc) {
      if (doc) {
        doc.updated = Date.now();
        return a.put(doc);
      }
    });
  },

  // Remove a random document
  'remove': function (a) {
    return randomDoc(a).then(function (doc) {
      if (doc) {
        return a.remove(doc);
      }
    });
  },

  // Generate a conflict by writing a document with the same id to
  // both databases
  'conflict': function (a, b) {
    var doc = {
      _id: 'random-' + Date.now(),
      foo: 'bar'
    };
    return a.put(doc).then(function () {
      doc.baz = 'fubar';
      return b.put(doc);
    });
  },

  // Perform a one off replication
  'replicate': function (a, b) {
    return a.replicate.to(b);
  }
};

// Utilities

function randomDoc(db) {
  return db.allDocs({include_docs: true}).then(function (res) {
    var row = arrayRandom(res.rows);
    if (row) {
      return row.doc;
    }
  });
}

function randomNumber(min, max) {
  min = parseInt(min, 10);
  max = parseInt(max, 10);
  if (min !== min) {
    min = 0;
  }
  if (max !== max || max <= min) {
    max = (min || 1) << 1; //doubling
  } else {
    max = max + 1;
  }
  var ratio = Math.random();
  var range = max - min;

  return ~~(range * ratio + min); // ~~ coerces to an int, but fast.
}

function arrayRandom(arr) {
  var keys = Object.keys(arr);
  var i = randomNumber(0, keys.length - 1);
  return arr[i];
}

describe('chaos-monkey', function () {

  var Promise;
  var a, b;

  beforeEach(function (done) {
    Promise = testUtils.Promise;
    var aname = testUtils.adapterUrl('local', 'testdb');
    var bname = testUtils.adapterUrl('http', 'test_repl_remote');
    testUtils.cleanup([aname, bname], function () {
      a = new PouchDB(aname);
      b = new PouchDB(bname);
      done();
    });
  });

  after(function () {
    return a.destroy().then(function () {
      return b.destroy();
    });
  });

  function dbActions() {
    return new Promise(function doit(resolve) {
      if (!actionCount) {
        return resolve();
      }
      var action = arrayRandom(Object.keys(actions));
      actionCount--;
      // Give the databases in random order
      var dbs = Math.round(Math.random()) ? [a, b] : [b, a];
      var called = actions[action].apply(null, dbs);
      // This is probably making a big stack, should fix
      called.then(function () {
        doit(resolve);
      });
    });
  }

  // Sync the databases up
  function finish() {
    return a.sync(b);
  }

  function compare() {
    return Promise.all([
      a.allDocs({include_docs: true}),
      b.allDocs({include_docs: true})
    ]).then(function (res) {
      res[0].should.deep.equal(res[1]);
    });
  }

  it('Do a fuzzy replication run', function () {
    // This gives us 100ms for each action, should hopefully be enough
    this.timeout(actionCount * 1000);
    return dbActions()
      .then(finish)
      .then(compare);
  });
});
