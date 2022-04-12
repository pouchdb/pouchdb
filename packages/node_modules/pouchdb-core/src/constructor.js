import Adapter from './adapter';
import TaskQueue from './taskqueue';
import { clone } from 'pouchdb-utils';
import parseAdapter from './parseAdapter';
import { createClass } from './utils';

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

  function onDestroyed(from_constructor) {
    self.removeListener('closed', onClosed);
    if (!from_constructor) {
      self.constructor.emit('destroyed', self.name);
    }
  }

  function onClosed() {
    self.removeListener('destroyed', onDestroyed);
    self.constructor.emit('unref', self);
  }

  self.once('destroyed', onDestroyed);
  self.once('closed', onClosed);
  self.constructor.emit('ref', self);
}

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
      prepareForDestruction(this);

      this.emit('created', this);
      PouchDB.emit('created', this.name);
      this.taskqueue.ready(this);
    });
  }
}

const PouchDB = createClass(PouchInternal, function (name, opts) {
  PouchInternal.prototype._setup.call(this, name, opts);
});

export default PouchDB;
