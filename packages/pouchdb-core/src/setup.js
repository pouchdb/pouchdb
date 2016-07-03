import { extend } from 'js-extend';

import PouchDB from './constructor';
import inherits from 'inherits';
import { Map } from 'pouchdb-collections';
import { EventEmitter as EE } from 'events';

PouchDB.adapters = {};
PouchDB.preferredAdapters = [];

PouchDB.prefix = '_pouch_';

var eventEmitter = new EE();

function setUpEventEmitter(Pouch) {
  Object.keys(EE.prototype).forEach(function (key) {
    if (typeof EE.prototype[key] === 'function') {
      Pouch[key] = eventEmitter[key].bind(eventEmitter);
    }
  });

  // these are created in constructor.js, and allow us to notify each DB with
  // the same name that it was destroyed, via the constructor object
  var destructListeners = Pouch._destructionListeners = new Map();
  Pouch.on('destroyed', function onConstructorDestroyed(name) {
    destructListeners.get(name).forEach(function (callback) {
      callback();
    });
    destructListeners.delete(name);
  });
}

setUpEventEmitter(PouchDB);

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
  } else {
    Object.keys(obj).forEach(function (id) { // object style for plugins
      PouchDB.prototype[id] = obj[id];
    });
  }
  return PouchDB;
};

PouchDB.defaults = function (defaultOpts) {
  function PouchAlt(name, opts) {
    if (!(this instanceof PouchAlt)) {
      return new PouchAlt(name, opts);
    }

    opts = opts || {};

    if (name && typeof name === 'object') {
      opts = name;
      name = opts.name;
      delete opts.name;
    }

    opts = extend({}, defaultOpts, opts);
    PouchDB.call(this, name, opts);
  }

  inherits(PouchAlt, PouchDB);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function (key) {
    if (!(key in PouchAlt)) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  return PouchAlt;
};

export default PouchDB;
