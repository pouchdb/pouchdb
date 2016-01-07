import debug from 'debug';
import inherits from 'inherits';
import Adapter from './adapter';
import TaskQueue from './taskqueue';
import Promise from './deps/promise';
import clone from './deps/clone';

function defaultCallback(err) {
  /* istanbul ignore next */
  if (err && global.debug) {
    console.error(err);
  }
}

// OK, so here's the deal. Consider this code:
//     var db1 = new PouchDB('foo');
//     var db2 = new PouchDB('foo');
//     db1.destroy();
// ^ these two both need to emit 'destroyed' events,
// as well as the PouchDB constructor itself.
// So we have one db object (whichever one got destroy() called on it)
// responsible for emitting the initial event, which then gets emitted
// by the constructor, which then broadcasts it to any other dbs
// that may have been created with the same name.
function prepareForDestruction(self, opts) {
  var name = opts.originalName;
  var ctor = self.constructor;
  var destructionListeners = ctor._destructionListeners;

  function onDestroyed() {
    ctor.emit('destroyed', name);
    //so we don't have to sift through all dbnames
    ctor.emit(name, 'destroyed');
  }

  function onConstructorDestroyed() {
    self.removeListener('destroyed', onDestroyed);
    self.emit('destroyed', self);
  }

  self.once('destroyed', onDestroyed);

  // in setup.js, the constructor is primed to listen for destroy events
  if (!destructionListeners.has(name)) {
    destructionListeners.set(name, []);
  }
  destructionListeners.get(name).push(onConstructorDestroyed);
}

inherits(PouchDB, Adapter);
function PouchDB(name, opts, callback) {

  if (!(this instanceof PouchDB)) {
    return new PouchDB(name, opts, callback);
  }
  var self = this;
  if (typeof opts === 'function' || typeof opts === 'undefined') {
    callback = opts;
    opts = {};
  }

  if (name && typeof name === 'object') {
    opts = name;
    name = undefined;
  }
  if (typeof callback === 'undefined') {
    callback = defaultCallback;
  }
  name = name || opts.name;
  opts = clone(opts);
  // if name was specified via opts, ignore for the sake of dependentDbs
  delete opts.name;
  this.__opts = opts;
  var oldCB = callback;
  self.auto_compaction = opts.auto_compaction;
  self.prefix = PouchDB.prefix;
  Adapter.call(self);
  self.taskqueue = new TaskQueue();
  var promise = new Promise(function (fulfill, reject) {
    callback = function (err, resp) {
      /* istanbul ignore if */
      if (err) {
        return reject(err);
      }
      delete resp.then;
      fulfill(resp);
    };
  
    opts = clone(opts);
    var originalName = opts.name || name;
    var backend, error;
    (function () {
      try {

        if (typeof originalName !== 'string') {
          error = new Error('Missing/invalid DB name');
          error.code = 400;
          throw error;
        }

        backend = PouchDB.parseAdapter(originalName, opts);
        
        opts.originalName = originalName;
        opts.name = backend.name;
        if (opts.prefix && backend.adapter !== 'http' &&
            backend.adapter !== 'https') {
          opts.name = opts.prefix + opts.name;
        }
        opts.adapter = opts.adapter || backend.adapter;
        self._adapter = opts.adapter;
        debug('pouchdb:adapter')('Picked adapter: ' + opts.adapter);

        self._db_name = originalName;
        if (!PouchDB.adapters[opts.adapter]) {
          error = new Error('Adapter is missing');
          error.code = 404;
          throw error;
        }

        /* istanbul ignore if */
        if (!PouchDB.adapters[opts.adapter].valid()) {
          error = new Error('Invalid Adapter');
          error.code = 404;
          throw error;
        }
      } catch (err) {
        self.taskqueue.fail(err);
      }
    }());
    if (error) {
      return reject(error); // constructor error, see above
    }
    self.adapter = opts.adapter;

    // needs access to PouchDB;
    self.replicate = {};

    self.replicate.from = function (url, opts, callback) {
      return self.constructor.replicate(url, self, opts, callback);
    };

    self.replicate.to = function (url, opts, callback) {
      return self.constructor.replicate(self, url, opts, callback);
    };

    self.sync = function (dbName, opts, callback) {
      return self.constructor.sync(self, dbName, opts, callback);
    };

    self.replicate.sync = self.sync;

    PouchDB.adapters[opts.adapter].call(self, opts, function (err) {
      /* istanbul ignore if */
      if (err) {
        self.taskqueue.fail(err);
        callback(err);
        return;
      }
      prepareForDestruction(self, opts);

      self.emit('created', self);
      PouchDB.emit('created', opts.originalName);
      self.taskqueue.ready(self);
      callback(null, self);
    });

  });
  promise.then(function (resp) {
    oldCB(null, resp);
  }, oldCB);
  self.then = promise.then.bind(promise);
  self.catch = promise.catch.bind(promise);
}

PouchDB.debug = debug;

export default PouchDB;
