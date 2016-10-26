'use strict';

require('chai').should();

var default_opts = {
  /* This module can work in regular "test" mode, but it may also dump
   * heap so that you can analyze what is going wrong.
   * In the later case, simply set the following variable to `true`.
   */
  dump_snapshots: true,

  /* How much growth is too much growth?
   * In practice I can't get Node.js to not leak even with the simple
   * classes defined below (maybe they are just plain buggy, but most
   * of what heapdump reveals leads to nextTickQueue, so I suspect
   * this is inherent to the way the tests are ran).
   * Therefor we defined the following as the maximum size and maximum
   * percentage growth we will accept as "normal".
   */
  max_growth: 50000, // Up to 50ko lost in heap
  max_percent: 1, // Up to 1% lost in heap

  /* How many times should the test run? */
  runs: 10000
};

var strict_opts = {
  dump_snapshots: default_opts.dump_snapshots,
  max_growth: 0,
  max_percent: 0,
  runs: 10000
};

/* A dummy adapter for test purposes. */

function DummyPouchPlugin (PouchDB) {

  function DummyPouchAdapter (opts,callback) {
    var api = this;

    api.close = function DummyPouchAdapterClose(callback) {
      this.emit('closed');
      if(callback) {
        callback(null,null)
      } else {
        return Promise.resolve()
      }
    };
    api.info = function DummyPouchAdapterInfo(callback) {
      if(callback) {
        callback(null,{dummy:true})
      } else {
        return Promise.resolve({dummy:true})
      }
    };

    if(callback) {
      callback(null,api)
    } else {
      return Promise.resolve(api)
    }
  }

  DummyPouchAdapter.valid = function DummyPouchAdapterValid() { return true }

  PouchDB.adapter('dummy', DummyPouchAdapter, false)
}

/* A dummy adapter that extends the core AbstractPouchDB class. */

function SomewhatDummyPouchPlugin (PouchDB) {

  function SomewhatDummyPouchAdapter (opts,callback) {
    var api = this;

    api._close = function SomewhatDummyPouchAdapterClose(callback) {
      if(callback) {
        callback(null,null)
      } else {
        return Promise.resolve()
      }
    };
    api._info = function SomewhatDummyPouchAdapterInfo(callback) {
      if(callback) {
        callback(null,{dummy:true})
      } else {
        return Promise.resolve({dummy:true})
      }
    };

    if(callback) {
      callback(null,api)
    } else {
      return Promise.resolve(api)
    }
  }

  SomewhatDummyPouchAdapter.valid = function SomwehatDummyPouchAdapterValid() { return true }

  PouchDB.adapter('somewhatdummy', SomewhatDummyPouchAdapter, false)
}

/* A fake PouchDB, used to make sure the leak detection code works. */

var FakePouchDB;

FakePouchDB = (function() {
  var adapters = {};

  function FakePouchDBAPI() {
  }

  FakePouchDBAPI.prototype.emit = function() {}

  function FakePouchDB(location) {
    var type = location.split(':')[0];
    this.opts = {};
    this.adapter = adapters[type];
  }

  FakePouchDB.adapter = function (type,adapter) {
    if(adapter.valid()) {
      adapters[type] = adapter;
    }
  }

  FakePouchDB.plugin = function (plugin) {
    plugin(this);
  }

  FakePouchDB.prototype.api = function () {
    var self = this;
    return new Promise( function(resolve,reject) {
      var empty_api = new FakePouchDBAPI();
      self.adapter.call(empty_api, self.opts, function(err,api) {
        if(err) {
          console.log("Error: "+(err.stack || err))
          reject(err);
        } else {
          resolve(api);
        }
      })
    });
  }

  FakePouchDB.prototype.info = function () {
    return this.api().then(function(api) {return api.info()});
  }

  FakePouchDB.prototype.close = function () {
    return this.api().then(function(api) {return api.close()});
  }

  return FakePouchDB;
})();

/* Basic sleep functionality for Promises */

function sleep(timeout) {
  return new Promise ( function (resolve,reject) {
    setTimeout(resolve,timeout);
  });
};

/* A class to measure and test heap variations over time. */

var MeasureHeap = (function() {

  function MeasureHeap(done,opts,dump) {
    this.stable_heap = null;
    this.done = done;

    this.remaining = opts.runs;
    this.runs = opts.runs;
    this.max_growth = opts.max_growth;
    this.max_percent = opts.max_percent;

    if (opts.dump_snapshots) {
      var heapdump = require('heapdump');
      this.dump = function (name) {
        return new Promise( function (resolve,reject) {
          console.log('Snapshotting to '+dump+name);
          heapdump.writeSnapshot( dump+name, function(err,filename) {
            if(err) {
              console.log("Error in snapshot: "+(err.stack || err))
              reject(err);
            } else {
              resolve(filename);
            }
          })
        });
      }
    } else {
      this.dump = function (name) {
        return Promise.resolve(dump+name);
      }
    }
  }

  MeasureHeap.prototype.init = function () {
    var self = this;
    var memory = null;

    global.gc();
    return sleep(6*1000)
    .then( function () {
      global.gc();
      memory = process.memoryUsage();
      return self.dump('-start.heapsnapshot');
    }).then( function () {
      self.stable_heap = memory.heapUsed;
      return false;
    });
  }

  MeasureHeap.prototype.update = function () {
    var self = this;
    var memory = null;

    self.remaining -= 1;
    if (self.remaining > 0) {
      return Promise.resolve(false);
    }

    global.gc();
    // Keep this part async so that we don't have to account for
    // data accumulated in the `done()` callback, etc.
    // (If we `return sleep(..).then(..)` then the heap size does
    // not match at all the values recorded in the heap dump.)
    sleep(6*1000)
    .then( function () {
      global.gc();
      memory = process.memoryUsage();
      return self.dump('-final.heapsnapshot');
    }).then( function () {
      var measured_heap = memory.heapUsed;
      var heap_growth = measured_heap - self.stable_heap;
      var percent = Math.ceil(100*heap_growth/self.stable_heap);
      if (heap_growth <= self.max_growth && percent <= self.max_percent) {
        console.log('Difference is '+ heap_growth+' (vs '+self.max_growth+')'+' (+'+percent+'%)'+' (vs '+self.max_percent+'%) ('+Math.ceil(heap_growth/self.runs)+' per iteration).');
        self.done();
      } else {
        self.done(new Error('Difference is '+ heap_growth+' (vs '+self.max_growth+')'+' (+'+percent+'%)'+' (vs '+self.max_percent+'%) ('+Math.ceil(heap_growth/self.runs)+' per iteration).'));
      }
    });

    return sleep(0).then( function() {
      return true;
    });
  }

  return MeasureHeap;
})();

var Catcher = function(err) {
  console.log(err.stack || err.toString());
};

describe('test.memleak.js: self-test', function () {

  before(function () {
    this.timeout(2*1000);
    if (!global.gc) {
      throw new Error('Please try with `mocha --expose-gc tests/component/test.memleak.js`');
    }
    FakePouchDB.plugin(DummyPouchPlugin);
    return sleep(1*1000);
  });

  it('Test absence of memory leak in empty', function (next) {

    this.timeout(25*1000);

    var measure = new MeasureHeap(next,strict_opts,'empty');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( Test );
    };

    measure.init()
    .then( Test );
  });

  it('Test absence of memory leak in reference code', function (next) {

    this.timeout(40*1000);

    var measure = new MeasureHeap(next,strict_opts,'reference');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( function(done) {
        var db = new FakePouchDB('dummy://');
        return db.info()
        .then(function () {
          return db.close();
        })
        .then(function () {
          return done;
        })
      })
      .then( Test, Catcher );
    };

    measure.init()
    .then( Test, Catcher );

  });
});

var PouchDB = require('../../packages/node_modules/pouchdb-for-coverage');
describe('test.memleak.js -- PouchDB core', function () {

  before(function () {
    this.timeout(5*1000);
    if (!global.gc) {
      throw new Error('Please try with `mocha --expose-gc tests/component/test.memleak.js`');
    }
    PouchDB.plugin(DummyPouchPlugin);
    PouchDB.plugin(SomewhatDummyPouchPlugin);

    return sleep(4*1000);
  });

  it('Test limited memory leak in PouchDB core (using dummy)', function (next) {

    this.timeout(40*1000);

    var measure = new MeasureHeap(next,default_opts,'core');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( function(done) {
        var db = new PouchDB('dummy://');
        return db.info()
        .then(function () {
          return db.close();
        })
        .then(function () {
          return done;
        })
      })
      .then( Test, Catcher );
    };

    measure.init()
    .then( Test, Catcher );

  });

  it('Test limited memory leak in PouchDB core', function (next) {

    this.timeout(40*1000);

    var measure = new MeasureHeap(next,default_opts,'core2');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( function(done) {
        var db = new PouchDB('somewhatdummy://');
        return db.info()
        .then(function () {
          return db.close();
        })
        .then(function () {
          return done;
        })
      })
      .then( Test, Catcher );
    };

    measure.init()
    .then( Test, Catcher );

  });

  it('Test limited memory leak in PouchDB core (many names)', function (next) {

    this.timeout(40*1000);

    var measure = new MeasureHeap(next,default_opts,'core2');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( function(done) {
        var db = new PouchDB('somewhatdummy://'+Math.random());
        return db.info()
        .then(function () {
          return db.close();
        })
        .then(function () {
          return done;
        })
      })
      .then( Test, Catcher );
    };

    measure.init()
    .then( Test, Catcher );

  });
});

describe('test.memleak.js -- misc adapters', function () {

  var server = null;

  before(function (done) {
    // A fake CouchDB for test purposes.
    var express = require('express');
    var app = express();
    app.get('/',function(req,res){
      res.json({ok:true});
    });
    app.get('/goodluck',function(req,res){
      res.json({ok:true});
    });

    server = app.listen(0,'127.0.0.1',done);
  });

  after(function (done) {
    this.timeout(4*1000);
    sleep(3*1000).then( function() {
      server.close(done);
    });
  });

  it('Test basic memory leak in PouchDB http adapter', function (next) {
    this.timeout(180*1000);

    /* I set lower limits because the server times out with the original values
     * (it might run out of descriptors or whatever).
     */
    var opts = {
      dump_snapshots: true,
      max_growth: 33000,
      max_percent: 1,
      runs: 3000
    }
    var host = 'http://127.0.0.1:' + server.address().port + '/';

    var measure = new MeasureHeap(next,opts,'http');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( function(done) {
        var db = new PouchDB(host+'goodluck');
        return db.info()
        .then(function () {
          return db.close();
        })
        .then(function () {
          return sleep(30)
        })
        .then(function () {
          return done;
        })
      })
      .then( Test, Catcher );
    };

    measure.init()
    .then( Test, Catcher );
  });
});

describe('test.memleak.js', function () {

  it.skip('Test basic memory leak in PouchDB leveldown adapter', function (next) {
    this.timeout(40*1000);

    var measure = new MeasureHeap(next,default_opts,'level');

    function Test(done) {
      if (done) {
        return;
      }
      return measure.update()
      .then( function(done) {
        var db = new PouchDB('goodluck');
        return db.info()
        .then(function () {
          return db.close();
        })
        .then(function () {
          return done;
        })
      })
      .then(function () {
        return sleep(20)
      })
      .then( Test, Catcher );
    };

    measure.init()
    .then( Test, Catcher );
  });
});
