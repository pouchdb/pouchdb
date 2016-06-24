import debug from 'debug';
import inherits from 'inherits';
import Adapter from './adapter';
import TaskQueue from './taskqueue';
import { clone } from 'pouchdb-utils';

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
function prepareForDestruction(self) {
  var name = self._db_name;
  var ctor = self.constructor;
  var destructionListeners = ctor._destructionListeners;

  function onDestroyed() {
    ctor.emit('destroyed', name);
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
function PouchDB(name, opts) {

  /* istanbul ignore if */
  if (!(this instanceof PouchDB)) {
    return new PouchDB(name, opts);
  }

  var self = this;
  opts = opts || {};

  if (name && typeof name === 'object') {
    opts = name;
    name = opts.name;
    delete opts.name;
  }

  opts = clone(opts);
  this.__opts = opts;

  self.auto_compaction = opts.auto_compaction;
  self.prefix = PouchDB.prefix;

  if (typeof name !== 'string') {
    throw(new Error('Missing/invalid DB name'));
  }

  var prefixedName = (opts.prefix || '') + name;
  var backend = PouchDB.parseAdapter(prefixedName, opts);

  opts.name = backend.name;
  opts.adapter = opts.adapter || backend.adapter;

  self._db_name = name;
  self._adapter = opts.adapter;
  debug('pouchdb:adapter')('Picked adapter: ' + opts.adapter);

  if (!PouchDB.adapters[opts.adapter] ||
      !PouchDB.adapters[opts.adapter].valid()) {
    throw(new Error('Invalid Adapter: ' + opts.adapter));
  }

  Adapter.call(self);
  self.taskqueue = new TaskQueue();

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
      return;
    }
    prepareForDestruction(self);

    self.emit('created', self);
    PouchDB.emit('created', self._db_name);
    self.taskqueue.ready(self);
  });

}

PouchDB.debug = debug;

export default PouchDB;
