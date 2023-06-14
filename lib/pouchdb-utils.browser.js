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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi11dGlscy5icm93c2VyLmpzIiwic291cmNlcyI6WyIuLi9wYWNrYWdlcy9wb3VjaGRiLXV0aWxzL3NyYy9jaGFuZ2VzSGFuZGxlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItdXRpbHMvc3JjL2RlZmF1bHRCYWNrT2ZmLmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi11dGlscy9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEV2ZW50RW1pdHRlciBmcm9tICdub2RlOmV2ZW50cyc7XG5pbXBvcnQgaGFzTG9jYWxTdG9yYWdlIGZyb20gJy4vZW52L2hhc0xvY2FsU3RvcmFnZSc7XG5pbXBvcnQgcGljayBmcm9tICcuL3BpY2snO1xuaW1wb3J0IG5leHRUaWNrIGZyb20gJy4vbmV4dFRpY2snO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDaGFuZ2VzIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoKTtcbiAgICBcbiAgICB0aGlzLl9saXN0ZW5lcnMgPSB7fTtcbiAgICBcbiAgICBpZiAoaGFzTG9jYWxTdG9yYWdlKCkpIHtcbiAgICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJzdG9yYWdlXCIsIChlKSA9PiB7XG4gICAgICAgIHRoaXMuZW1pdChlLmtleSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBhZGRMaXN0ZW5lcihkYk5hbWUsIGlkLCBkYiwgb3B0cykge1xuICAgIGlmICh0aGlzLl9saXN0ZW5lcnNbaWRdKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBpbnByb2dyZXNzID0gZmFsc2U7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGZ1bmN0aW9uIGV2ZW50RnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXNlbGYuX2xpc3RlbmVyc1tpZF0pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGlucHJvZ3Jlc3MpIHtcbiAgICAgICAgaW5wcm9ncmVzcyA9ICd3YWl0aW5nJztcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaW5wcm9ncmVzcyA9IHRydWU7XG4gICAgICB2YXIgY2hhbmdlc09wdHMgPSBwaWNrKG9wdHMsIFtcbiAgICAgICAgJ3N0eWxlJywgJ2luY2x1ZGVfZG9jcycsICdhdHRhY2htZW50cycsICdjb25mbGljdHMnLCAnZmlsdGVyJyxcbiAgICAgICAgJ2RvY19pZHMnLCAndmlldycsICdzaW5jZScsICdxdWVyeV9wYXJhbXMnLCAnYmluYXJ5JywgJ3JldHVybl9kb2NzJ1xuICAgICAgXSk7XG4gIFxuICAgICAgZnVuY3Rpb24gb25FcnJvcigpIHtcbiAgICAgICAgaW5wcm9ncmVzcyA9IGZhbHNlO1xuICAgICAgfVxuICBcbiAgICAgIGRiLmNoYW5nZXMoY2hhbmdlc09wdHMpLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbiAoYykge1xuICAgICAgICBpZiAoYy5zZXEgPiBvcHRzLnNpbmNlICYmICFvcHRzLmNhbmNlbGxlZCkge1xuICAgICAgICAgIG9wdHMuc2luY2UgPSBjLnNlcTtcbiAgICAgICAgICBvcHRzLm9uQ2hhbmdlKGMpO1xuICAgICAgICB9XG4gICAgICB9KS5vbignY29tcGxldGUnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChpbnByb2dyZXNzID09PSAnd2FpdGluZycpIHtcbiAgICAgICAgICBuZXh0VGljayhldmVudEZ1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBpbnByb2dyZXNzID0gZmFsc2U7XG4gICAgICB9KS5vbignZXJyb3InLCBvbkVycm9yKTtcbiAgICB9XG4gICAgdGhpcy5fbGlzdGVuZXJzW2lkXSA9IGV2ZW50RnVuY3Rpb247XG4gICAgdGhpcy5vbihkYk5hbWUsIGV2ZW50RnVuY3Rpb24pO1xuICB9XG4gIFxuICByZW1vdmVMaXN0ZW5lcihkYk5hbWUsIGlkKSB7XG4gICAgaWYgKCEoaWQgaW4gdGhpcy5fbGlzdGVuZXJzKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzdXBlci5yZW1vdmVMaXN0ZW5lcihkYk5hbWUsIHRoaXMuX2xpc3RlbmVyc1tpZF0pO1xuICAgIGRlbGV0ZSB0aGlzLl9saXN0ZW5lcnNbaWRdO1xuICB9XG4gIFxuICBub3RpZnlMb2NhbFdpbmRvd3MoZGJOYW1lKSB7XG4gICAgLy9kbyBhIHVzZWxlc3MgY2hhbmdlIG9uIGEgc3RvcmFnZSB0aGluZ1xuICAgIC8vaW4gb3JkZXIgdG8gZ2V0IG90aGVyIHdpbmRvd3MncyBsaXN0ZW5lcnMgdG8gYWN0aXZhdGVcbiAgICBpZiAoaGFzTG9jYWxTdG9yYWdlKCkpIHtcbiAgICAgIGxvY2FsU3RvcmFnZVtkYk5hbWVdID0gKGxvY2FsU3RvcmFnZVtkYk5hbWVdID09PSBcImFcIikgPyBcImJcIiA6IFwiYVwiO1xuICAgIH1cbiAgfVxuICBcbiAgbm90aWZ5KGRiTmFtZSkge1xuICAgIHRoaXMuZW1pdChkYk5hbWUpO1xuICAgIHRoaXMubm90aWZ5TG9jYWxXaW5kb3dzKGRiTmFtZSk7XG4gIH1cbn1cbiIsImZ1bmN0aW9uIHJhbmRvbU51bWJlcihtaW4sIG1heCkge1xuICB2YXIgbWF4VGltZW91dCA9IDYwMDAwMDsgLy8gSGFyZC1jb2RlZCBkZWZhdWx0IG9mIDEwIG1pbnV0ZXNcbiAgbWluID0gcGFyc2VJbnQobWluLCAxMCkgfHwgMDtcbiAgbWF4ID0gcGFyc2VJbnQobWF4LCAxMCk7XG4gIGlmIChtYXggIT09IG1heCB8fCBtYXggPD0gbWluKSB7XG4gICAgbWF4ID0gKG1pbiB8fCAxKSA8PCAxOyAvL2RvdWJsaW5nXG4gIH0gZWxzZSB7XG4gICAgbWF4ID0gbWF4ICsgMTtcbiAgfVxuICAvLyBJbiBvcmRlciB0byBub3QgZXhjZWVkIG1heFRpbWVvdXQsIHBpY2sgYSByYW5kb20gdmFsdWUgYmV0d2VlbiBoYWxmIG9mIG1heFRpbWVvdXQgYW5kIG1heFRpbWVvdXRcbiAgaWYgKG1heCA+IG1heFRpbWVvdXQpIHtcbiAgICBtaW4gPSBtYXhUaW1lb3V0ID4+IDE7IC8vIGRpdmlkZSBieSB0d29cbiAgICBtYXggPSBtYXhUaW1lb3V0O1xuICB9XG4gIHZhciByYXRpbyA9IE1hdGgucmFuZG9tKCk7XG4gIHZhciByYW5nZSA9IG1heCAtIG1pbjtcblxuICByZXR1cm4gfn4ocmFuZ2UgKiByYXRpbyArIG1pbik7IC8vIH5+IGNvZXJjZXMgdG8gYW4gaW50LCBidXQgZmFzdC5cbn1cblxuZnVuY3Rpb24gZGVmYXVsdEJhY2tPZmYobWluKSB7XG4gIHZhciBtYXggPSAwO1xuICBpZiAoIW1pbikge1xuICAgIG1heCA9IDIwMDA7XG4gIH1cbiAgcmV0dXJuIHJhbmRvbU51bWJlcihtaW4sIG1heCk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmF1bHRCYWNrT2ZmO1xuIiwiaW1wb3J0IHsgdjQgfSBmcm9tICd1dWlkJztcblxuaW1wb3J0IGFkYXB0ZXJGdW4gZnJvbSAnLi9hZGFwdGVyRnVuJztcbmltcG9ydCBidWxrR2V0U2hpbSBmcm9tICcuL2J1bGtHZXRTaGltJztcbmltcG9ydCBjaGFuZ2VzSGFuZGxlciBmcm9tICcuL2NoYW5nZXNIYW5kbGVyJztcbmltcG9ydCBjbG9uZSBmcm9tICcuL2Nsb25lJztcbmltcG9ydCBndWFyZGVkQ29uc29sZSBmcm9tICcuL2d1YXJkZWRDb25zb2xlJztcbmltcG9ydCBkZWZhdWx0QmFja09mZiBmcm9tICcuL2RlZmF1bHRCYWNrT2ZmJztcbmltcG9ydCBleHBsYWluRXJyb3IgZnJvbSAnLi9leHBsYWluRXJyb3InO1xuaW1wb3J0IGFzc2lnbiBmcm9tICcuL2Fzc2lnbic7XG5pbXBvcnQgZmlsdGVyQ2hhbmdlIGZyb20gJy4vZmlsdGVyQ2hhbmdlJztcbmltcG9ydCBmbGF0dGVuIGZyb20gJy4vZmxhdHRlbic7XG5pbXBvcnQgZnVuY3Rpb25OYW1lIGZyb20gJy4vZnVuY3Rpb25OYW1lJztcbmltcG9ydCBoYXNMb2NhbFN0b3JhZ2UgZnJvbSAnLi9lbnYvaGFzTG9jYWxTdG9yYWdlJztcbmltcG9ydCBpbnZhbGlkSWRFcnJvciBmcm9tICcuL2ludmFsaWRJZEVycm9yJztcbmltcG9ydCBpc1JlbW90ZSBmcm9tICcuL2lzUmVtb3RlJztcbmltcG9ydCBsaXN0ZW5lckNvdW50IGZyb20gJy4vbGlzdGVuZXJDb3VudCc7XG5pbXBvcnQgbmV4dFRpY2sgZnJvbSAnLi9uZXh0VGljayc7XG5pbXBvcnQgbm9ybWFsaXplRGRvY0Z1bmN0aW9uTmFtZSBmcm9tICcuL25vcm1hbGl6ZURkb2NGdW5jdGlvbk5hbWUnO1xuaW1wb3J0IG9uY2UgZnJvbSAnLi9vbmNlJztcbmltcG9ydCBwYXJzZURkb2NGdW5jdGlvbk5hbWUgZnJvbSAnLi9wYXJzZURkb2NGdW5jdGlvbk5hbWUnO1xuaW1wb3J0IHBhcnNlVXJpIGZyb20gJy4vcGFyc2VVcmknO1xuaW1wb3J0IHBpY2sgZnJvbSAnLi9waWNrJztcbmltcG9ydCBzY29wZUV2YWwgZnJvbSAnLi9zY29wZUV2YWwnO1xuaW1wb3J0IHRvUHJvbWlzZSBmcm9tICcuL3RvUHJvbWlzZSc7XG5pbXBvcnQgdXBzZXJ0IGZyb20gJy4vdXBzZXJ0JztcbmltcG9ydCByZXYgZnJvbSAnLi9yZXYnO1xuXG52YXIgdXVpZCA9IHY0OyAvLyBtaW1pYyBvbGQgaW1wb3J0LCBvbmx5IHY0IGlzIGV2ZXIgdXNlZCBlbHNld2hlcmVcblxuZXhwb3J0IHtcbiAgYWRhcHRlckZ1bixcbiAgYXNzaWduLFxuICBidWxrR2V0U2hpbSxcbiAgY2hhbmdlc0hhbmRsZXIsXG4gIGNsb25lLFxuICBkZWZhdWx0QmFja09mZixcbiAgZXhwbGFpbkVycm9yLFxuICBmaWx0ZXJDaGFuZ2UsXG4gIGZsYXR0ZW4sXG4gIGZ1bmN0aW9uTmFtZSxcbiAgZ3VhcmRlZENvbnNvbGUsXG4gIGhhc0xvY2FsU3RvcmFnZSxcbiAgaW52YWxpZElkRXJyb3IsXG4gIGlzUmVtb3RlLFxuICBsaXN0ZW5lckNvdW50LFxuICBuZXh0VGljayxcbiAgbm9ybWFsaXplRGRvY0Z1bmN0aW9uTmFtZSxcbiAgb25jZSxcbiAgcGFyc2VEZG9jRnVuY3Rpb25OYW1lLFxuICBwYXJzZVVyaSxcbiAgcGljayxcbiAgcmV2LFxuICBzY29wZUV2YWwsXG4gIHRvUHJvbWlzZSxcbiAgdXBzZXJ0LFxuICB1dWlkXG59O1xuIl0sIm5hbWVzIjpbIkV2ZW50RW1pdHRlciIsIm5leHRUaWNrIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtlLE1BQU0sT0FBTyxTQUFTQSxFQUFZLENBQUM7QUFDbEQsRUFBRSxXQUFXLEdBQUc7QUFDaEIsSUFBSSxLQUFLLEVBQUUsQ0FBQztBQUNaO0FBQ0EsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUN6QjtBQUNBLElBQUksSUFBSSxlQUFlLEVBQUUsRUFBRTtBQUMzQixNQUFNLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsS0FBSztBQUN6QyxRQUFRLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3pCLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSztBQUNMLEdBQUc7QUFDSDtBQUNBLEVBQUUsV0FBVyxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRTtBQUNwQyxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsRUFBRTtBQUM3QixNQUFNLE9BQU87QUFDYixLQUFLO0FBQ0wsSUFBSSxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDM0IsSUFBSSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEIsSUFBSSxTQUFTLGFBQWEsR0FBRztBQUM3QixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFO0FBQ2hDLFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUCxNQUFNLElBQUksVUFBVSxFQUFFO0FBQ3RCLFFBQVEsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUMvQixRQUFRLE9BQU87QUFDZixPQUFPO0FBQ1AsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQ3hCLE1BQU0s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
