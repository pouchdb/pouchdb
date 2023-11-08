
import {
  replicate,
  toPouch
} from './replicateWrapper';
import EE from 'events';
import { clone } from 'pouchdb-utils';

export default sync;
function sync(src, target, opts, callback) {
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  if (typeof opts === 'undefined') {
    opts = {};
  }
  opts = clone(opts);
  opts.PouchConstructor = opts.PouchConstructor || this;
  src = toPouch(src, opts);
  target = toPouch(target, opts);
  return new Sync(src, target, opts, callback);
}

class Sync extends EE {
  constructor(src, target, opts, callback) {
    super();
    this.canceled = false;

    const optsPush = opts.push ? Object.assign({}, opts, opts.push) : opts;
    const optsPull = opts.pull ? Object.assign({}, opts, opts.pull) : opts;

    this.push = replicate(src, target, optsPush);
    this.pull = replicate(target, src, optsPull);

    this.pushPaused = true;
    this.pullPaused = true;

    const pullChange = (change) => {
      this.emit('change', {
        direction: 'pull',
        change
      });
    };
    const pushChange = (change) => {
      this.emit('change', {
        direction: 'push',
        change
      });
    };
    const pushDenied = (doc) => {
      this.emit('denied', {
        direction: 'push',
        doc
      });
    };
    const pullDenied = (doc) => {
      this.emit('denied', {
        direction: 'pull',
        doc
      });
    };
    const pushPaused = () => {
      this.pushPaused = true;
      /* istanbul ignore if */
      if (this.pullPaused) {
        this.emit('paused');
      }
    };
    const pullPaused = () => {
      this.pullPaused = true;
      /* istanbul ignore if */
      if (this.pushPaused) {
        this.emit('paused');
      }
    };
    const pushActive = () => {
      this.pushPaused = false;
      /* istanbul ignore if */
      if (this.pullPaused) {
        this.emit('active', {
          direction: 'push'
        });
      }
    };
    const pullActive = () => {
      this.pullPaused = false;
      /* istanbul ignore if */
      if (this.pushPaused) {
        this.emit('active', {
          direction: 'pull'
        });
      }
    };

    let removed = {};

    const removeAll = (type) => { // type is 'push' or 'pull'
      return (event, func) => {
        const isChange = event === 'change' &&
          (func === pullChange || func === pushChange);
        const isDenied = event === 'denied' &&
          (func === pullDenied || func === pushDenied);
        const isPaused = event === 'paused' &&
          (func === pullPaused || func === pushPaused);
        const isActive = event === 'active' &&
          (func === pullActive || func === pushActive);

        if (isChange || isDenied || isPaused || isActive) {
          if (!(event in removed)) {
            removed[event] = {};
          }
          removed[event][type] = true;
          if (Object.keys(removed[event]).length === 2) {
            // both push and pull have asked to be removed
            this.removeAllListeners(event);
          }
        }
      };
    };

    if (opts.live) {
      this.push.on('complete', this.pull.cancel.bind(this.pull));
      this.pull.on('complete', this.push.cancel.bind(this.push));
    }

    function addOneListener(ee, event, listener) {
      if (ee.listeners(event).indexOf(listener) == -1) {
        ee.on(event, listener);
      }
    }

    this.on('newListener', function (event) {
      if (event === 'change') {
        addOneListener(this.pull, 'change', pullChange);
        addOneListener(this.push, 'change', pushChange);
      } else if (event === 'denied') {
        addOneListener(this.pull, 'denied', pullDenied);
        addOneListener(this.push, 'denied', pushDenied);
      } else if (event === 'active') {
        addOneListener(this.pull, 'active', pullActive);
        addOneListener(this.push, 'active', pushActive);
      } else if (event === 'paused') {
        addOneListener(this.pull, 'paused', pullPaused);
        addOneListener(this.push, 'paused', pushPaused);
      }
    });

    this.on('removeListener', function (event) {
      if (event === 'change') {
        this.pull.removeListener('change', pullChange);
        this.push.removeListener('change', pushChange);
      } else if (event === 'denied') {
        this.pull.removeListener('denied', pullDenied);
        this.push.removeListener('denied', pushDenied);
      } else if (event === 'active') {
        this.pull.removeListener('active', pullActive);
        this.push.removeListener('active', pushActive);
      } else if (event === 'paused') {
        this.pull.removeListener('paused', pullPaused);
        this.push.removeListener('paused', pushPaused);
      }
    });

    this.pull.on('removeListener', removeAll('pull'));
    this.push.on('removeListener', removeAll('push'));

    const promise = Promise.all([
      this.push,
      this.pull
    ]).then((resp) => {
      const out = {
        push: resp[0],
        pull: resp[1]
      };
      this.emit('complete', out);
      if (callback) {
        callback(null, out);
      }
      this.removeAllListeners();
      return out;
    }, (err) => {
      this.cancel();
      if (callback) {
        // if there's a callback, then the callback can receive
        // the error event
        callback(err);
      } else {
        // if there's no callback, then we're safe to emit an error
        // event, which would otherwise throw an unhandled error
        // due to 'error' being a special event in EventEmitters
        this.emit('error', err);
      }
      this.removeAllListeners();
      if (callback) {
        // no sense throwing if we're already emitting an 'error' event
        throw err;
      }
    });

    this.then = function (success, err) {
      return promise.then(success, err);
    };

    this.catch = function (err) {
      return promise.catch(err);
    };
  }

  cancel() {
    if (!this.canceled) {
      this.canceled = true;
      this.push.cancel();
      this.pull.cancel();
    }
  }
}
