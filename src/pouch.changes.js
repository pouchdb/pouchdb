// TODO: use an EventEmitter in node when possible?
(function() {
  var Changes = function() {

    var api = {};
    var listeners = {};

    api.addListener = function(db, id, opts) {
      if (!listeners[db]) {
        listeners[db] = {};
      }
      listeners[db][id] = opts;
    }

    api.removeListener = function(db, id) {
      delete listeners[db][id];
    }

    api.clearListeners = function(db) {
      delete listeners[db];
    }

    api.emitChange = function(db, change) {
      if (!listeners[db]) {
        return;
      }
      for (var i in listeners[db]) {
        var opts = listeners[db][i];
        if (opts.filter && !opts.filter.apply(this, [change.doc])) {
          return;
        }
        if (!opts.include_docs) {
          delete change.doc;
        }
        opts.onChange.apply(opts.onChange, [change]);
      }
    }

    return api;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Changes();
  }
  else {
    Pouch.changes = Changes();
  }
})();

