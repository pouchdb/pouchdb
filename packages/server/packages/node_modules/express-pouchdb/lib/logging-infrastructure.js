"use strict";

var fs = require('fs');
var utils = require('./utils');

// sorted from a lot of output to no output
var LOG_LEVELS = ['debug', 'info', 'warning', 'error', 'none'];

function CouchLogger(file, level) {
  // set start values
  this.setFile(file);
  this.setLevel(level);
}

CouchLogger.prototype.setFile = function (file) {
  if (this._stream) {
    this._stream.end();
  }
  this._file = file;
  this._stream = fs.createWriteStream(file, {
    flags: 'a',
    encoding: 'UTF-8'
  });
};

CouchLogger.prototype.setLevel = function (level) {
  var newLevel = LOG_LEVELS.indexOf(level);
  if (newLevel === -1) {
    newLevel = LOG_LEVELS.indexOf("info"); // the default
  }
  this._level = newLevel;
};

CouchLogger.prototype._write = function (level, message) {
  if (LOG_LEVELS.indexOf(level) < this._level) {
    //don't log
    return;
  }
  var date = new Date().toUTCString();
  var pid = '0.000.0';

  var str = '[{0}] [{1}] [<{2}>] {3}\n'
    .replace('{0}', date)
    .replace('{1}', level)
    .replace('{2}', pid)
    .replace('{3}', message);

  this._stream.write(str);
};

// defines CouchLogger.debug(); CouchLogger.info(),
// CouchLogger.warning() & CouchLogger.error()

// slice so the 'none' level doesn't get a function.
LOG_LEVELS.slice(0, -1).forEach(function (logLevel) {
  CouchLogger.prototype[logLevel] = function (message) {
    this._write(logLevel, message);
  };
});

CouchLogger.prototype.getLog = function (bytes, offset, callback) {
  var self = this;
  fs.stat(self._file, function (err, info) {
    if (err) {
      return callback(err);
    }
    var opts = {
      start: Math.max(info.size - bytes - offset - 1, 0),
      end: Math.max(info.size - offset - 1, 0),
      encoding: 'UTF-8'
    };
    callback(null, {
      stream: fs.createReadStream(self._file, opts),
      length: opts.end - opts.start
    });
  });
};

module.exports = function (app) {
  utils.requires(app, 'config-infrastructure');

  // set up log file
  var logPath = app.opts.logPath || './log.txt';
  app.couchConfig.registerDefault('log', 'file', logPath);
  app.couchConfig.registerDefault('log', 'level', 'info');
  var getFile = app.couchConfig.get.bind(app.couchConfig, 'log', 'file');
  var getLevel = app.couchConfig.get.bind(app.couchConfig, 'log', 'level');
  app.couchLogger = new CouchLogger(getFile(), getLevel());
  app.couchConfig.on('log.file', function () {
    app.couchLogger.setFile(getFile());
  });
  app.couchConfig.on('log.level', function () {
    app.couchLogger.setLevel(getLevel());
  });
};
