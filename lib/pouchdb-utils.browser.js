import { p as pick } from './bulkGetShim-d4877145.js';
export { a as adapterFun, b as bulkGetShim } from './bulkGetShim-d4877145.js';
import { e as events } from './__node-resolve_empty-5ffda92e.js';
import { h as hasLocalStorage, i as immediate } from './functionName-9335a350.js';
export { b as assign, f as functionName } from './functionName-9335a350.js';
export { c as clone } from './clone-abfcddc8.js';
export { g as guardedConsole } from './guardedConsole-f54e5a40.js';
export { e as explainError } from './explainError-browser-c025e6c9.js';
export { f as filterChange, p as parseUri } from './parseUri-b061a2c5.js';
export { f as flatten } from './flatten-994f45c6.js';
import { v as v4 } from './rev-5645662a.js';
export { i as invalidIdError, l as listenerCount, r as rev } from './rev-5645662a.js';
export { i as isRemote } from './isRemote-f9121da9.js';
export { n as normalizeDdocFunctionName, p as parseDdocFunctionName } from './normalizeDdocFunctionName-ea3481cf.js';
export { o as once, t as toPromise } from './toPromise-9dada06a.js';
export { s as scopeEval } from './scopeEval-ff3a416d.js';
export { u as upsert } from './upsert-331b6913.js';
import './_commonjsHelpers-24198af3.js';
import './pouchdb-errors.browser.js';
import './spark-md5-2c57e5fc.js';
import './stringMd5-browser-5aecd2bd.js';

class Changes extends events {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi11dGlscy5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLXV0aWxzL3NyYy9jaGFuZ2VzSGFuZGxlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItdXRpbHMvc3JjL2RlZmF1bHRCYWNrT2ZmLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi11dGlscy9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdldmVudHMnO1xuaW1wb3J0IGhhc0xvY2FsU3RvcmFnZSBmcm9tICcuL2Vudi9oYXNMb2NhbFN0b3JhZ2UnO1xuaW1wb3J0IHBpY2sgZnJvbSAnLi9waWNrJztcbmltcG9ydCBuZXh0VGljayBmcm9tICcuL25leHRUaWNrJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgQ2hhbmdlcyBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKCk7XG4gICAgXG4gICAgdGhpcy5fbGlzdGVuZXJzID0ge307XG4gICAgXG4gICAgaWYgKGhhc0xvY2FsU3RvcmFnZSgpKSB7XG4gICAgICBhZGRFdmVudExpc3RlbmVyKFwic3RvcmFnZVwiLCAoZSkgPT4ge1xuICAgICAgICB0aGlzLmVtaXQoZS5rZXkpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgYWRkTGlzdGVuZXIoZGJOYW1lLCBpZCwgZGIsIG9wdHMpIHtcbiAgICBpZiAodGhpcy5fbGlzdGVuZXJzW2lkXSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgaW5wcm9ncmVzcyA9IGZhbHNlO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiBldmVudEZ1bmN0aW9uKCkge1xuICAgICAgaWYgKCFzZWxmLl9saXN0ZW5lcnNbaWRdKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChpbnByb2dyZXNzKSB7XG4gICAgICAgIGlucHJvZ3Jlc3MgPSAnd2FpdGluZyc7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlucHJvZ3Jlc3MgPSB0cnVlO1xuICAgICAgdmFyIGNoYW5nZXNPcHRzID0gcGljayhvcHRzLCBbXG4gICAgICAgICdzdHlsZScsICdpbmNsdWRlX2RvY3MnLCAnYXR0YWNobWVudHMnLCAnY29uZmxpY3RzJywgJ2ZpbHRlcicsXG4gICAgICAgICdkb2NfaWRzJywgJ3ZpZXcnLCAnc2luY2UnLCAncXVlcnlfcGFyYW1zJywgJ2JpbmFyeScsICdyZXR1cm5fZG9jcydcbiAgICAgIF0pO1xuICBcbiAgICAgIGZ1bmN0aW9uIG9uRXJyb3IoKSB7XG4gICAgICAgIGlucHJvZ3Jlc3MgPSBmYWxzZTtcbiAgICAgIH1cbiAgXG4gICAgICBkYi5jaGFuZ2VzKGNoYW5nZXNPcHRzKS5vbignY2hhbmdlJywgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgaWYgKGMuc2VxID4gb3B0cy5zaW5jZSAmJiAhb3B0cy5jYW5jZWxsZWQpIHtcbiAgICAgICAgICBvcHRzLnNpbmNlID0gYy5zZXE7XG4gICAgICAgICAgb3B0cy5vbkNoYW5nZShjKTtcbiAgICAgICAgfVxuICAgICAgfSkub24oJ2NvbXBsZXRlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoaW5wcm9ncmVzcyA9PT0gJ3dhaXRpbmcnKSB7XG4gICAgICAgICAgbmV4dFRpY2soZXZlbnRGdW5jdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgaW5wcm9ncmVzcyA9IGZhbHNlO1xuICAgICAgfSkub24oJ2Vycm9yJywgb25FcnJvcik7XG4gICAgfVxuICAgIHRoaXMuX2xpc3RlbmVyc1tpZF0gPSBldmVudEZ1bmN0aW9uO1xuICAgIHRoaXMub24oZGJOYW1lLCBldmVudEZ1bmN0aW9uKTtcbiAgfVxuICBcbiAgcmVtb3ZlTGlzdGVuZXIoZGJOYW1lLCBpZCkge1xuICAgIGlmICghKGlkIGluIHRoaXMuX2xpc3RlbmVycykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc3VwZXIucmVtb3ZlTGlzdGVuZXIoZGJOYW1lLCB0aGlzLl9saXN0ZW5lcnNbaWRdKTtcbiAgICBkZWxldGUgdGhpcy5fbGlzdGVuZXJzW2lkXTtcbiAgfVxuICBcbiAgbm90aWZ5TG9jYWxXaW5kb3dzKGRiTmFtZSkge1xuICAgIC8vZG8gYSB1c2VsZXNzIGNoYW5nZSBvbiBhIHN0b3JhZ2UgdGhpbmdcbiAgICAvL2luIG9yZGVyIHRvIGdldCBvdGhlciB3aW5kb3dzJ3MgbGlzdGVuZXJzIHRvIGFjdGl2YXRlXG4gICAgaWYgKGhhc0xvY2FsU3RvcmFnZSgpKSB7XG4gICAgICBsb2NhbFN0b3JhZ2VbZGJOYW1lXSA9IChsb2NhbFN0b3JhZ2VbZGJOYW1lXSA9PT0gXCJhXCIpID8gXCJiXCIgOiBcImFcIjtcbiAgICB9XG4gIH1cbiAgXG4gIG5vdGlmeShkYk5hbWUpIHtcbiAgICB0aGlzLmVtaXQoZGJOYW1lKTtcbiAgICB0aGlzLm5vdGlmeUxvY2FsV2luZG93cyhkYk5hbWUpO1xuICB9XG59XG4iLCJmdW5jdGlvbiByYW5kb21OdW1iZXIobWluLCBtYXgpIHtcbiAgdmFyIG1heFRpbWVvdXQgPSA2MDAwMDA7IC8vIEhhcmQtY29kZWQgZGVmYXVsdCBvZiAxMCBtaW51dGVzXG4gIG1pbiA9IHBhcnNlSW50KG1pbiwgMTApIHx8IDA7XG4gIG1heCA9IHBhcnNlSW50KG1heCwgMTApO1xuICBpZiAobWF4ICE9PSBtYXggfHwgbWF4IDw9IG1pbikge1xuICAgIG1heCA9IChtaW4gfHwgMSkgPDwgMTsgLy9kb3VibGluZ1xuICB9IGVsc2Uge1xuICAgIG1heCA9IG1heCArIDE7XG4gIH1cbiAgLy8gSW4gb3JkZXIgdG8gbm90IGV4Y2VlZCBtYXhUaW1lb3V0LCBwaWNrIGEgcmFuZG9tIHZhbHVlIGJldHdlZW4gaGFsZiBvZiBtYXhUaW1lb3V0IGFuZCBtYXhUaW1lb3V0XG4gIGlmIChtYXggPiBtYXhUaW1lb3V0KSB7XG4gICAgbWluID0gbWF4VGltZW91dCA+PiAxOyAvLyBkaXZpZGUgYnkgdHdvXG4gICAgbWF4ID0gbWF4VGltZW91dDtcbiAgfVxuICB2YXIgcmF0aW8gPSBNYXRoLnJhbmRvbSgpO1xuICB2YXIgcmFuZ2UgPSBtYXggLSBtaW47XG5cbiAgcmV0dXJuIH5+KHJhbmdlICogcmF0aW8gKyBtaW4pOyAvLyB+fiBjb2VyY2VzIHRvIGFuIGludCwgYnV0IGZhc3QuXG59XG5cbmZ1bmN0aW9uIGRlZmF1bHRCYWNrT2ZmKG1pbikge1xuICB2YXIgbWF4ID0gMDtcbiAgaWYgKCFtaW4pIHtcbiAgICBtYXggPSAyMDAwO1xuICB9XG4gIHJldHVybiByYW5kb21OdW1iZXIobWluLCBtYXgpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZhdWx0QmFja09mZjtcbiIsImltcG9ydCB7IHY0IH0gZnJvbSAndXVpZCc7XG5cbmltcG9ydCBhZGFwdGVyRnVuIGZyb20gJy4vYWRhcHRlckZ1bic7XG5pbXBvcnQgYnVsa0dldFNoaW0gZnJvbSAnLi9idWxrR2V0U2hpbSc7XG5pbXBvcnQgY2hhbmdlc0hhbmRsZXIgZnJvbSAnLi9jaGFuZ2VzSGFuZGxlcic7XG5pbXBvcnQgY2xvbmUgZnJvbSAnLi9jbG9uZSc7XG5pbXBvcnQgZ3VhcmRlZENvbnNvbGUgZnJvbSAnLi9ndWFyZGVkQ29uc29sZSc7XG5pbXBvcnQgZGVmYXVsdEJhY2tPZmYgZnJvbSAnLi9kZWZhdWx0QmFja09mZic7XG5pbXBvcnQgZXhwbGFpbkVycm9yIGZyb20gJy4vZXhwbGFpbkVycm9yJztcbmltcG9ydCBhc3NpZ24gZnJvbSAnLi9hc3NpZ24nO1xuaW1wb3J0IGZpbHRlckNoYW5nZSBmcm9tICcuL2ZpbHRlckNoYW5nZSc7XG5pbXBvcnQgZmxhdHRlbiBmcm9tICcuL2ZsYXR0ZW4nO1xuaW1wb3J0IGZ1bmN0aW9uTmFtZSBmcm9tICcuL2Z1bmN0aW9uTmFtZSc7XG5pbXBvcnQgaGFzTG9jYWxTdG9yYWdlIGZyb20gJy4vZW52L2hhc0xvY2FsU3RvcmFnZSc7XG5pbXBvcnQgaW52YWxpZElkRXJyb3IgZnJvbSAnLi9pbnZhbGlkSWRFcnJvcic7XG5pbXBvcnQgaXNSZW1vdGUgZnJvbSAnLi9pc1JlbW90ZSc7XG5pbXBvcnQgbGlzdGVuZXJDb3VudCBmcm9tICcuL2xpc3RlbmVyQ291bnQnO1xuaW1wb3J0IG5leHRUaWNrIGZyb20gJy4vbmV4dFRpY2snO1xuaW1wb3J0IG5vcm1hbGl6ZURkb2NGdW5jdGlvbk5hbWUgZnJvbSAnLi9ub3JtYWxpemVEZG9jRnVuY3Rpb25OYW1lJztcbmltcG9ydCBvbmNlIGZyb20gJy4vb25jZSc7XG5pbXBvcnQgcGFyc2VEZG9jRnVuY3Rpb25OYW1lIGZyb20gJy4vcGFyc2VEZG9jRnVuY3Rpb25OYW1lJztcbmltcG9ydCBwYXJzZVVyaSBmcm9tICcuL3BhcnNlVXJpJztcbmltcG9ydCBwaWNrIGZyb20gJy4vcGljayc7XG5pbXBvcnQgc2NvcGVFdmFsIGZyb20gJy4vc2NvcGVFdmFsJztcbmltcG9ydCB0b1Byb21pc2UgZnJvbSAnLi90b1Byb21pc2UnO1xuaW1wb3J0IHVwc2VydCBmcm9tICcuL3Vwc2VydCc7XG5pbXBvcnQgcmV2IGZyb20gJy4vcmV2JztcblxudmFyIHV1aWQgPSB2NDsgLy8gbWltaWMgb2xkIGltcG9ydCwgb25seSB2NCBpcyBldmVyIHVzZWQgZWxzZXdoZXJlXG5cbmV4cG9ydCB7XG4gIGFkYXB0ZXJGdW4sXG4gIGFzc2lnbixcbiAgYnVsa0dldFNoaW0sXG4gIGNoYW5nZXNIYW5kbGVyLFxuICBjbG9uZSxcbiAgZGVmYXVsdEJhY2tPZmYsXG4gIGV4cGxhaW5FcnJvcixcbiAgZmlsdGVyQ2hhbmdlLFxuICBmbGF0dGVuLFxuICBmdW5jdGlvbk5hbWUsXG4gIGd1YXJkZWRDb25zb2xlLFxuICBoYXNMb2NhbFN0b3JhZ2UsXG4gIGludmFsaWRJZEVycm9yLFxuICBpc1JlbW90ZSxcbiAgbGlzdGVuZXJDb3VudCxcbiAgbmV4dFRpY2ssXG4gIG5vcm1hbGl6ZURkb2NGdW5jdGlvbk5hbWUsXG4gIG9uY2UsXG4gIHBhcnNlRGRvY0Z1bmN0aW9uTmFtZSxcbiAgcGFyc2VVcmksXG4gIHBpY2ssXG4gIHJldixcbiAgc2NvcGVFdmFsLFxuICB0b1Byb21pc2UsXG4gIHVwc2VydCxcbiAgdXVpZFxufTtcbiJdLCJuYW1lcyI6WyJFdmVudEVtaXR0ZXIiLCJuZXh0VGljayJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtlLE1BQU0sT0FBTyxTQUFTQSxNQUFZLENBQUM7QUFDbEQsRUFBRSxXQUFXLEdBQUc7QUFDaEIsSUFBSSxLQUFLLEVBQUUsQ0FBQztBQUNaO0FBQ0EsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUN6QjtBQUNBLElBQUksSUFBSSxlQUFlLEVBQUUsRUFBRTtBQUMzQixNQUFNLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSztBQUN6QyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRTtBQUNwQyxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUM3QixNQUFNLE9BQU87QUFDYixLQUFLO0FBQ0wsSUFBSSxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDM0IsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEIsSUFBSSxTQUFTLGFBQWEsR0FBRztBQUM3QixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQ2hDLFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUCxNQUFNLElBQUksVUFBVSxFQUFFO0FBQ3RCLFFBQVEsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUMvQixRQUFRLE9BQU87QUFDZixPQUFPO0FBQ1AsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLE1BQU0sSUFBSSxX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
