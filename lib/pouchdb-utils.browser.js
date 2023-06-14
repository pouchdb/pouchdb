import { p as pick } from './bulkGetShim-75479c95.js';
export { a as adapterFun, b as bulkGetShim } from './bulkGetShim-75479c95.js';
import EE from 'node:events';
import { h as hasLocalStorage, i as immediate } from './functionName-4d6db487.js';
export { b as assign, f as functionName } from './functionName-4d6db487.js';
export { c as clone } from './clone-f35bcc51.js';
export { g as guardedConsole } from './guardedConsole-f54e5a40.js';
export { e as explainError } from './explainError-browser-c025e6c9.js';
export { f as filterChange, p as parseUri } from './parseUri-b061a2c5.js';
export { f as flatten } from './flatten-994f45c6.js';
import { v as v4 } from './rev-d51344b8.js';
export { i as invalidIdError, l as listenerCount, r as rev } from './rev-d51344b8.js';
export { i as isRemote } from './isRemote-f9121da9.js';
export { n as normalizeDdocFunctionName, p as parseDdocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
export { o as once, t as toPromise } from './toPromise-06b5d6a8.js';
export { s as scopeEval } from './scopeEval-ff3a416d.js';
export { u as upsert } from './upsert-331b6913.js';
import './_commonjsHelpers-24198af3.js';
import './__node-resolve_empty-b1d43ca8.js';
import './pouchdb-errors.browser.js';
import './spark-md5-2c57e5fc.js';
import './stringMd5-browser-5aecd2bd.js';

class Changes extends EE {
  constructor() {
    super();
    
    this._listeners = {};
    
    if (hasLocalStorage()) {
      addEventListener("storage", (e) => {
        this.emit(e.key);
      });
    }
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
          immediate(eventFunction);
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
    //do a useless change on a storage thing
    //in order to get other windows's listeners to activate
    if (hasLocalStorage()) {
      localStorage[dbName] = (localStorage[dbName] === "a") ? "b" : "a";
    }
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

export { Changes as changesHandler, defaultBackOff, hasLocalStorage, immediate as nextTick, pick, uuid };
