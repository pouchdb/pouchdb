"use strict";

var fs       = require('fs'),
    path     = require('path'),
    util     = require('util'),
    events   = require('events'),
    extend   = require('extend'),
    Auth     = require('pouchdb-auth');

function CouchConfig(file) {
  events.EventEmitter.call(this);

  this._file = file;
  this._tempFile = this._file != null ?
    path.dirname(this._file) + '/.' + path.basename(this._file) :
    null;
  this._config = readConfig(this._file);
  this._defaults = {};

  // Do not create an empty config file
  if (this._file != null && fs.existsSync(this._file)) {
    // Hashes admin passwords in 'file' (if necessary)
    this._save();
  }
}

util.inherits(CouchConfig, events.EventEmitter);

function readConfig(file) {
  if (file != null && fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file));
  }
  return {};
}

CouchConfig.prototype._save = function (callback) {
  var self = this;

  if (typeof callback !== "function") {
    callback = function () {};
  }

  function write() {
    if (self._file == null) {
      callback();
      return;
    }

    // Pretty print
    var json = JSON.stringify(self._config, null, 2) + '\n';
    fs.writeFile(self._tempFile, json, function () {
      fs.rename(self._tempFile, self._file, callback);
    });
  }
  if (self._config.admins) {
    Auth.hashAdminPasswords(self._config.admins).then(function (admins) {
      self._config.admins = admins;

      write();
    });
  } else {
    write();
  }
};

CouchConfig.prototype.get = function (section, key) {
  if (exists(this._config[section]) && exists(this._config[section][key])) {
    return this._config[section][key];
  } else {
    // fall back on defaults
    var sectionExists = exists(this._defaults[section]);
    if (sectionExists && exists(this._defaults[section][key])) {
      return this._defaults[section][key];
    } else {
      return undefined;
    }
  }
};

function exists(val) {
  return typeof val !== 'undefined';
}

CouchConfig.prototype.getAll = function () {
  return stringify(extend(true, {}, this._defaults, this._config));
};

function stringify(config) {
  for (var sectionName in config) {
    if (config.hasOwnProperty(sectionName)) {
      stringifySection(config[sectionName]);
    }
  }
  return config;
}

function stringifySection(section) {
  for (var key in section) {
    if (section.hasOwnProperty(key)) {
      var value = section[key];
      if (typeof value !== 'string') {
        section[key] = JSON.stringify(value);
      }
    }
  }
  return section;
}

CouchConfig.prototype.getSection = function (section) {
  var data = extend(true, {}, this._defaults[section], this._config[section]);
  return stringifySection(data);
};

CouchConfig.prototype.set = function (section, key, value, callback) {
  var previousValue;
  if (!this._config[section]) {
    this._config[section] = {};
  } else {
    previousValue = this._config[section][key];
  }
  this._config[section][key] = value;

  this._changed(section, key, previousValue, callback);
};

CouchConfig.prototype._changed = function (section, key, prevVal, callback) {
  var self = this;

  self._save(function (err) {
    if (err) {
      return callback(err);
    }

    // run event handlers
    self.emit(section + "." + key);
    self.emit(section);

    callback(null, prevVal);
  });
};

CouchConfig.prototype.delete = function (section, key, callback) {
  var previousValue = (this._config[section] || {})[key];
  if (exists(previousValue)) {
    delete this._config[section][key];
    if (!Object.keys(this._config[section]).length) {
      delete this._config[section];
    }
  }

  this._changed(section, key, previousValue, callback);
};

CouchConfig.prototype.registerDefault = function (section, key, value) {
  this._defaults[section] = this._defaults[section] || {};
  this._defaults[section][key] = value;
};

module.exports = function (app) {
  var path = app.opts.configPath || './config.json';
  var inMemory = app.opts.inMemoryConfig || false;
  app.couchConfig = new CouchConfig(inMemory ? null : path);
};
