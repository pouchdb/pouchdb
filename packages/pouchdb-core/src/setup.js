import EE from 'node:events';
import { fetch } from 'pouchdb-fetch';
import ActiveTasks from './active-tasks.js';
import { createClass } from './utils';
import Adapter from './adapter.js';
import TaskQueue from './taskqueue.js';
import { clone } from 'pouchdb-utils.js';
import getParseAdapter from './parseAdapter.js';

class PouchInternal extends Adapter {
  constructor(name, opts) {
    super();
    this._setup(name, opts);
  }

  _setup(name, opts) {
    super._setup();
    opts = opts || {};

    if (name && typeof name === 'object') {
      opts = name;
      name = opts.name;
      delete opts.name;
    }

    if (opts.deterministic_revs === undefined) {
      opts.deterministic_revs = true;
    }

    this.__opts = opts = clone(opts);

    this.auto_compaction = opts.auto_compaction;
    this.purged_infos_limit = opts.purged_infos_limit || 1000;
    this.prefix = PouchDB.prefix;

    if (typeof name !== 'string') {
      throw new Error('Missing/invalid DB name');
    }

    var prefixedName = (opts.prefix || '') + name;
    var backend = parseAdapter(prefixedName, opts);

    opts.name = backend.name;
    opts.adapter = opts.adapter || backend.adapter;

    this.name = name;
    this._adapter = opts.adapter;
    PouchDB.emit('debug', ['adapter', 'Picked adapter: ', opts.adapter]);

    if (!PouchDB.adapters[opts.adapter] ||
        !PouchDB.adapters[opts.adapter].valid()) {
      throw new Error('Invalid Adapter: ' + opts.adapter);
    }

    if (opts.view_adapter) {
      if (!PouchDB.adapters[opts.view_adapter] ||
          !PouchDB.adapters[opts.view_adapter].valid()) {
        throw new Error('Invalid View Adapter: ' + opts.view_adapter);
      }
    }

    this.taskqueue = new TaskQueue();

    this.adapter = opts.adapter;

    PouchDB.adapters[opts.adapter].call(this, opts, (err) => {
      if (err) {
        return this.taskqueue.fail(err);
      }
      

      this.emit('created', this);
      PouchDB.emit('created', this.name);
      this.taskqueue.ready(this);
    });
  }
}

const PouchDB = createClass(PouchInternal, function (name, opts) {
  PouchInternal.prototype._setup.call(this, name, opts);
});

const parseAdapter = getParseAdapter(PouchDB);



PouchDB.adapters = {};
PouchDB.preferredAdapters = [];

PouchDB.prefix = '_pouch_';

var eventEmitter = new EE();


  Object.keys(EE.prototype).forEach(function (key) {
    if (typeof EE.prototype[key] === 'function') {
      PouchDB[key] = eventEmitter[key].bind(eventEmitter);
    }
  });

  // these are created in constructor.js, and allow us to notify each DB with
  // the same name that it was destroyed, via the constructor object
  var destructListeners = PouchDB._destructionListeners = new Map();

  PouchDB.on('ref', function onConstructorRef(db) {
    if (!destructListeners.has(db.name)) {
      destructListeners.set(db.name, []);
    }
    destructListeners.get(db.name).push(db);
  });

  PouchDB.on('unref', function onConstructorUnref(db) {
    if (!destructListeners.has(db.name)) {
      return;
    }
    var dbList = destructListeners.get(db.name);
    var pos = dbList.indexOf(db);
    if (pos < 0) {
      /* istanbul ignore next */
      return;
    }
    dbList.splice(pos, 1);
    if (dbList.length > 1) {
      /* istanbul ignore next */
      destructListeners.set(db.name, dbList);
    } else {
      destructListeners.delete(db.name);
    }
  });

  PouchDB.on('destroyed', function onConstructorDestroyed(name) {
    if (!destructListeners.has(name)) {
      return;
    }
    var dbList = destructListeners.get(name);
    destructListeners.delete(name);
    dbList.forEach(function (db) {
      db.emit('destroyed',true);
    });
  });


PouchDB.adapter = function (id, obj, addToPreferredAdapters) {
  /* istanbul ignore else */
  if (obj.valid()) {
    PouchDB.adapters[id] = obj;
    if (addToPreferredAdapters) {
      PouchDB.preferredAdapters.push(id);
    }
  }
};

PouchDB.plugin = function (obj) {
  if (typeof obj === 'function') { // function style for plugins
    obj(PouchDB);
  } else if (typeof obj !== 'object' || Object.keys(obj).length === 0) {
    throw new Error('Invalid plugin: got "' + obj + '", expected an object or a function');
  } else {
    Object.keys(obj).forEach(function (id) { // object style for plugins
      PouchDB.prototype[id] = obj[id];
    });
  }
  if (this.__defaults) {
    PouchDB.__defaults = Object.assign({}, this.__defaults);
  }
  return PouchDB;
};

PouchDB.defaults = function (defaultOpts) {
  let PouchWithDefaults = createClass(PouchDB, function (name, opts) {
    opts = opts || {};

    if (name && typeof name === 'object') {
      opts = name;
      name = opts.name;
      delete opts.name;
    }

    opts = Object.assign({}, PouchWithDefaults.__defaults, opts);
    PouchDB.call(this, name, opts);
  });

  PouchWithDefaults.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function (key) {
    if (!(key in PouchWithDefaults)) {
      PouchWithDefaults[key] = PouchDB[key];
    }
  });

  // make default options transitive
  // https://github.com/pouchdb/pouchdb/issues/5922
  PouchWithDefaults.__defaults = Object.assign({}, this.__defaults, defaultOpts);

  return PouchWithDefaults;
};

PouchDB.fetch = function (url, opts) {
  return fetch(url, opts);
};

PouchDB.prototype.activeTasks = PouchDB.activeTasks = new ActiveTasks();

export default PouchDB;
