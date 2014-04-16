'use strict';
var utils = require('./utils');
var replicate = require('./replicate').replicate;

module.exports = sync;
function sync(db1, db2, opts, callback) {

  if (opts instanceof Function) {
    callback = opts;
    opts = {};
  }
  if (opts === undefined) {
    opts = {};
  }
  if (callback instanceof Function && !opts.complete) {
    opts.complete = callback;
  }


  var pushReplication =
      replicate(db1, db2, makeOpts(db1, opts, 'push', cancel), callback);

  var pullReplication =
      replicate(db2, db1, makeOpts(db2, opts, 'pull', cancel), callback);

  function cancel() {
    if (pushReplication) {
      pushReplication.cancel();
    }
    if (pullReplication) {
      pullReplication.cancel();
    }
  }

  return {
    push: pushReplication,
    pull: pullReplication,
    cancel: cancel
  };
}

function complete(callback, direction, cancel) {
  return function (err, res) {
    if (err) {
      // cancel both replications if either experiences problems
      cancel();
    }
    if (res) {
      res.direction = direction;
    }
    callback(err, res);
  };
}
function onChange(src, callback) {
  callback = callback || function () {};
  return function (change) {
    return {
      source: src,
      change: callback(change)
    };
  };
}

function makeOpts(src, opts, direction, cancel) {
  opts = utils.clone(opts);
  opts.complete = complete(opts.complete, direction, cancel);
  opts.onChange = onChange(src, opts.onChange);
  opts.continuous = opts.continuous || opts.live;
  return opts;
}
