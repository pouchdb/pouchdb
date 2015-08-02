'use strict';

var utils = require('./utils');
var replication = require('./replicate');
var replicate = replication.replicate;
var EE = require('events').EventEmitter;

utils.inherits(Sync, EE);
module.exports = sync;
function sync(src, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  opts = utils.clone(opts);
  /*jshint validthis:true */
  opts.PouchConstructor = opts.PouchConstructor || this;
  src = replication.toPouch(src, opts);
  target = replication.toPouch(target, opts);
  return new Sync(src, target, opts, callback);
}

function Sync(src, target, opts, callback) {
  var self = this;
  this.canceled = false;

  var onChange, complete;
  if ('onChange' in opts) {
    onChange = opts.onChange;
    delete opts.onChange;
  }
  if (typeof callback === 'function' && !opts.complete) {
    complete = callback;
  } else if ('complete' in opts) {
    complete = opts.complete;
    delete opts.complete;
  }

  this.push = replicate(src, target, opts);
  this.pull = replicate(target, src, opts);

  function pullChange(change) {
    self.emit('change', {
      direction: 'pull',
      change: change
    });
  }
  function pushChange(change) {
    self.emit('change', {
      direction: 'push',
      change: change
    });
  }
  function pushDenied(doc) {
    self.emit('denied', {
      direction: 'push',
      doc: doc
    });
  }
  function pullDenied(doc) {
    self.emit('denied', {
      direction: 'pull',
      doc: doc
    });
  }

  var listeners = {};
  var removed = {};

  function removeAll(type) { // type is 'push' or 'pull'
    return function (event, func) {
      var isChange = event === 'change' &&
        (func === pullChange || func === pushChange);
      var isOtherEvent = event in listeners && func === listeners[event];

      if (isChange || isOtherEvent) {
        if (!(event in removed)) {
          removed[event] = {};
        }
        removed[event][type] = true;
        if (Object.keys(removed[event]).length === 2) {
          // both push and pull have asked to be removed
          self.removeAllListeners(event);
        }
      }
    };
  }

  if (opts.live) {
    this.push.on('complete', self.pull.cancel.bind(self.pull));
    this.pull.on('complete', self.push.cancel.bind(self.push));
  }

  this.on('newListener', function (event) {
    if (event === 'change') {
      self.pull.on('change', pullChange);
      self.push.on('change', pushChange);
    } else if (event === 'denied') {
      self.pull.on('denied', pullDenied);
      self.push.on('denied', pushDenied);
    } else if (event !== 'error' &&
      event !== 'removeListener' &&
      event !== 'complete' && !(event in listeners)) {
      listeners[event] = function (e) {
        self.emit(event, e);
      };
      self.pull.on(event, listeners[event]);
      self.push.on(event, listeners[event]);
    }
  });

  this.on('removeListener', function (event) {
    if (event === 'change') {
      self.pull.removeListener('change', pullChange);
      self.push.removeListener('change', pushChange);
    }
  });

  this.pull.on('removeListener', removeAll('pull'));
  this.push.on('removeListener', removeAll('push'));

  var promise = utils.Promise.all([
    this.push,
    this.pull
  ]).then(function (resp) {
    var out = {
      push: resp[0],
      pull: resp[1]
    };
    self.emit('complete', out);
    if (complete) {
      complete(null, out);
    }
    self.removeAllListeners();
    return out;
  }, function (err) {
    self.cancel();
    if (complete) {
      // if there's a callback, then the callback can receive
      // the error event
      complete(err);
    } else {
      // if there's no callback, then we're safe to emit an error
      // event, which would otherwise throw an unhandled error
      // due to 'error' being a special event in EventEmitters
      self.emit('error', err);
    }
    self.removeAllListeners();
    throw err;
  });

  this.then = function (success, err) {
    return promise.then(success, err);
  };

  this.catch = function (err) {
    return promise.catch(err);
  };
}

Sync.prototype.cancel = function () {
  if (!this.canceled) {
    this.canceled = true;
    this.push.cancel();
    this.pull.cancel();
  }
};
