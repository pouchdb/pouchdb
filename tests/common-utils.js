'use strict';

var commonUtils = {};

commonUtils.isBrowser = function () {
  return !commonUtils.isNode();
};

commonUtils.isNode = function () {
  return typeof process !== 'undefined' && !process.browser;
};

commonUtils.params = function () {
  if (commonUtils.isNode()) {
    return process.env;
  }
  var paramStr = document.location.search.slice(1);
  return paramStr.split('&').reduce(function (acc, val) {
    if (!val) {
      return acc;
    }
    var tmp = val.split('=');
    acc[tmp[0]] = decodeURIComponent(tmp[1]) || true;
    return acc;
  }, {});
};

commonUtils.adapters = function () {
  var adapters = commonUtils.isNode() ? process.env.ADAPTERS : commonUtils.params().adapters;
  return adapters ? adapters.split(',') : [];
};

commonUtils.plugins = function () {
  var plugins = commonUtils.isNode() ? process.env.PLUGINS : commonUtils.params().plugins;
  return plugins ? plugins.split(',') : [];
};

commonUtils.loadPouchDB = function () {
  var scriptPath = '../../packages/node_modules/pouchdb/dist';
  var pluginAdapters = ['indexeddb', 'localstorage', 'memory'];

  var params = commonUtils.params();
  var pouchdbSrc = params.src || `${scriptPath}/pouchdb.js`;
  var adapters = commonUtils.adapters();
  var plugins = commonUtils.plugins();
  var scripts = [pouchdbSrc];

  for (let adapter of adapters) {
    if (pluginAdapters.includes(adapter)) {
      plugins.push(adapter);
    }
  }
  for (let plugin of plugins) {
    plugin = plugin.replace(/^pouchdb-/, '');
    scripts.push(`${scriptPath}/pouchdb.${plugin}.js`);
  }

  var loadScripts = scripts.reduce((prevScriptLoaded, script) => {
    return prevScriptLoaded.then(() => commonUtils.asyncLoadScript(script));
  }, Promise.resolve());

  return loadScripts.then(() => {
    if (adapters.length > 0) {
      window.PouchDB.preferredAdapters = adapters;
    }
    if ('autoCompaction' in params) {
      window.PouchDB = window.PouchDB.defaults({ auto_compaction: true });
    }
    return window.PouchDB;
  });
};

// Thanks to http://engineeredweb.com/blog/simple-async-javascript-loader/
commonUtils.asyncLoadScript = function (url) {
  return new commonUtils.Promise(function (resolve) {
    // Create a new script and setup the basics.
    var script = document.createElement("script");
    var firstScript = document.getElementsByTagName('script')[0];

    script.async = true;
    script.src = url;

    script.onload = function () {
      resolve();

      // Clear it out to avoid getting called more than once or any
      // memory leaks.
      script.onload = script.onreadystatechange = undefined;
    };
    script.onreadystatechange = function () {
      if ("loaded" === script.readyState || "complete" === script.readyState) {
        script.onload();
      }
    };

    // Attach the script tag to the page (before the first script) so the
    //magic can happen.
    firstScript.parentNode.insertBefore(script, firstScript);
  });
};

commonUtils.couchHost = function () {
  if (typeof window !== 'undefined' && window.cordova) {
    // magic route to localhost on android emulator
    return 'http://10.0.2.2:5984';
  }

  if (typeof window !== 'undefined' && window.COUCH_HOST) {
    return window.COUCH_HOST;
  }

  if (typeof process !== 'undefined' && process.env.COUCH_HOST) {
    return process.env.COUCH_HOST;
  }

  if ('couchHost' in commonUtils.params()) {
    // Remove trailing slash from url if the user defines one
    return commonUtils.params().couchHost.replace(/\/$/, '');
  }

  return 'http://localhost:5984';
};

commonUtils.safeRandomDBName = function () {
  return "test" + Math.random().toString().replace('.', '_');
};

commonUtils.createDocId = function (i) {
  var intString = i.toString();
  while (intString.length < 10) {
    intString = '0' + intString;
  }
  return 'doc_' + intString;
};

var PouchForCoverage = require('../packages/node_modules/pouchdb-for-coverage');
var pouchUtils = PouchForCoverage.utils;
commonUtils.Promise = pouchUtils.Promise;

module.exports = commonUtils;
