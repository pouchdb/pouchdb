import { p as pick } from './bulkGetShim-df36314d.js';
export { a as adapterFun, b as bulkGetShim } from './bulkGetShim-df36314d.js';
import EE from 'node:events';
import { n as nextTick } from './nextTick-ea093886.js';
export { c as clone } from './clone-7eeb6295.js';
export { g as guardedConsole } from './guardedConsole-f54e5a40.js';
export { r as explainError, f as filterChange, p as parseUri } from './parseUri-6d6043cb.js';
export { a as assign, f as functionName } from './functionName-706c6c65.js';
export { f as flatten } from './flatten-994f45c6.js';
import { v as v4 } from './rev-fc9bde4f.js';
export { h as hasLocalStorage, i as invalidIdError, l as listenerCount, r as rev } from './rev-fc9bde4f.js';
export { i as isRemote } from './isRemote-f9121da9.js';
export { n as normalizeDdocFunctionName, p as parseDdocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
export { o as once, t as toPromise } from './toPromise-1031f2f4.js';
export { s as scopeEval } from './scopeEval-ff3a416d.js';
export { u as upsert } from './upsert-331b6913.js';
import './pouchdb-errors.js';
import './_commonjsHelpers-24198af3.js';
import 'buffer';
import 'crypto';
import './stringMd5-15f53eba.js';

class Changes extends EE {
  constructor() {
    super();
    
    this._listeners = {};
  }

  addListener(dbName, id, db, opts) {
    if (this._listeners[id]) {
      return;
    }
    var inprogress = false;
    var self = this;
    function eventFunction() {
      if (!self._listeners[id]) {
        return;
      }
      if (inprogress) {
        inprogress = 'waiting';
        return;
      }
      inprogress = true;
      var changesOpts = pick(opts, [
        'style', 'include_docs', 'attachments', 'conflicts', 'filter',
        'doc_ids', 'view', 'since', 'query_params', 'binary', 'return_docs'
      ]);
  
      function onError() {
        inprogress = false;
      }
  
      db.changes(changesOpts).on('change', function (c) {
        if (c.seq > opts.since && !opts.cancelled) {
          opts.since = c.seq;
          opts.onChange(c);
        }
      }).on('complete', function () {
        if (inprogress === 'waiting') {
          nextTick(eventFunction);
        }
        inprogress = false;
      }).on('error', onError);
    }
    this._listeners[id] = eventFunction;
    this.on(dbName, eventFunction);
  }
  
  removeListener(dbName, id) {
    if (!(id in this._listeners)) {
      return;
    }
    super.removeListener(dbName, this._listeners[id]);
    delete this._listeners[id];
  }
  
  notifyLocalWindows(dbName) {
  }
  
  notify(dbName) {
    this.emit(dbName);
    this.notifyLocalWindows(dbName);
  }
}

function randomNumber(min, max) {
  var maxTimeout = 600000; // Hard-coded default of 10 minutes
  min = parseInt(min, 10) || 0;
  max = parseInt(max, 10);
  if (max !== max || max <= min) {
    max = (min || 1) << 1; //doubling
  } else {
    max = max + 1;
  }
  // In order to not exceed maxTimeout, pick a random value between half of maxTimeout and maxTimeout
  if (max > maxTimeout) {
    min = maxTimeout >> 1; // divide by two
    max = maxTimeout;
  }
  var ratio = Math.random();
  var range = max - min;

  return ~~(range * ratio + min); // ~~ coerces to an int, but fast.
}

function defaultBackOff(min) {
  var max = 0;
  if (!min) {
    max = 2000;
  }
  return randomNumber(min, max);
}

var uuid = v4; // mimic old import, only v4 is ever used elsewhere

export { Changes as changesHandler, defaultBackOff, nextTick, pick, uuid };
