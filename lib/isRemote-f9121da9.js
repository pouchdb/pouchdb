import { g as guardedConsole } from './guardedConsole-f54e5a40.js';

// Checks if a PouchDB object is "remote" or not. This is
// designed to opt-in to certain optimizations, such as
// avoiding checks for "dependentDbs" and other things that
// we know only apply to local databases. In general, "remote"
// should be true for the http adapter, and for third-party
// adapters with similar expensive boundaries to cross for
// every API call, such as socket-pouch and worker-pouch.
// Previously, this was handled via db.type() === 'http'
// which is now deprecated.


function isRemote(db) {
  if (typeof db._remote === 'boolean') {
    return db._remote;
  }
  /* istanbul ignore next */
  if (typeof db.type === 'function') {
    guardedConsole('warn',
      'db.type() is deprecated and will be removed in ' +
      'a future version of PouchDB');
    return db.type() === 'http';
  }
  /* istanbul ignore next */
  return false;
}

export { isRemote as i };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaXNSZW1vdGUtZjkxMjFkYTkuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItdXRpbHMvc3JjL2lzUmVtb3RlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENoZWNrcyBpZiBhIFBvdWNoREIgb2JqZWN0IGlzIFwicmVtb3RlXCIgb3Igbm90LiBUaGlzIGlzXG4vLyBkZXNpZ25lZCB0byBvcHQtaW4gdG8gY2VydGFpbiBvcHRpbWl6YXRpb25zLCBzdWNoIGFzXG4vLyBhdm9pZGluZyBjaGVja3MgZm9yIFwiZGVwZW5kZW50RGJzXCIgYW5kIG90aGVyIHRoaW5ncyB0aGF0XG4vLyB3ZSBrbm93IG9ubHkgYXBwbHkgdG8gbG9jYWwgZGF0YWJhc2VzLiBJbiBnZW5lcmFsLCBcInJlbW90ZVwiXG4vLyBzaG91bGQgYmUgdHJ1ZSBmb3IgdGhlIGh0dHAgYWRhcHRlciwgYW5kIGZvciB0aGlyZC1wYXJ0eVxuLy8gYWRhcHRlcnMgd2l0aCBzaW1pbGFyIGV4cGVuc2l2ZSBib3VuZGFyaWVzIHRvIGNyb3NzIGZvclxuLy8gZXZlcnkgQVBJIGNhbGwsIHN1Y2ggYXMgc29ja2V0LXBvdWNoIGFuZCB3b3JrZXItcG91Y2guXG4vLyBQcmV2aW91c2x5LCB0aGlzIHdhcyBoYW5kbGVkIHZpYSBkYi50eXBlKCkgPT09ICdodHRwJ1xuLy8gd2hpY2ggaXMgbm93IGRlcHJlY2F0ZWQuXG5cbmltcG9ydCBndWFyZGVkQ29uc29sZSBmcm9tICcuL2d1YXJkZWRDb25zb2xlJztcblxuZnVuY3Rpb24gaXNSZW1vdGUoZGIpIHtcbiAgaWYgKHR5cGVvZiBkYi5fcmVtb3RlID09PSAnYm9vbGVhbicpIHtcbiAgICByZXR1cm4gZGIuX3JlbW90ZTtcbiAgfVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICBpZiAodHlwZW9mIGRiLnR5cGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICBndWFyZGVkQ29uc29sZSgnd2FybicsXG4gICAgICAnZGIudHlwZSgpIGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiAnICtcbiAgICAgICdhIGZ1dHVyZSB2ZXJzaW9uIG9mIFBvdWNoREInKTtcbiAgICByZXR1cm4gZGIudHlwZSgpID09PSAnaHR0cCc7XG4gIH1cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZGVmYXVsdCBpc1JlbW90ZTsiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0EsU0FBUyxRQUFRLENBQUMsRUFBRSxFQUFFO0FBQ3RCLEVBQUUsSUFBSSxPQUFPLEVBQUUsQ0FBQyxPQUFPLEtBQUssU0FBUyxFQUFFO0FBQ3ZDLElBQUksT0FBTyxFQUFFLENBQUMsT0FBTyxDQUFDO0FBQ3RCLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxPQUFPLEVBQUUsQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3JDLElBQUksY0FBYyxDQUFDLE1BQU07QUFDekIsTUFBTSxpREFBaUQ7QUFDdkQsTUFBTSw2QkFBNkIsQ0FBQyxDQUFDO0FBQ3JDLElBQUksT0FBTyxFQUFFLENBQUMsSUFBSSxFQUFFLEtBQUssTUFBTSxDQUFDO0FBQ2hDLEdBQUc7QUFDSDtBQUNBLEVBQUUsT0FBTyxLQUFLLENBQUM7QUFDZjs7OzsifQ==
