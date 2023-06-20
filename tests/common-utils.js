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

commonUtils.viewAdapters = function () {
  var viewAdapters = commonUtils.isNode() ? 
    process.env.VIEW_ADAPTERS : commonUtils.params().viewAdapters;
  return viewAdapters ? viewAdapters.split(',') : [];
};

commonUtils.plugins = function () {
  var plugins = commonUtils.isNode() ? process.env.PLUGINS : commonUtils.params().plugins;
  return plugins ? plugins.split(',') : [];
};

var PLUGIN_ADAPTERS = ['indexeddb', 'localstorage', 'memory', 'node-websql'];

commonUtils.loadPouchDB = function (opts) {
  opts = opts || {};

  var params = commonUtils.params();
  var adapters = commonUtils.adapters().concat(opts.adapters || []);
  var viewAdapters = commonUtils.viewAdapters().concat(opts.viewAdapters || []);
  var plugins = commonUtils.plugins().concat(opts.plugins || []);

  const allAdapters = [...adapters, ...viewAdapters];
  for (let adapter of allAdapters) {
    if (adapter === 'websql') {
      adapter = 'node-websql';
    }
    if (PLUGIN_ADAPTERS.includes(adapter)) {
      plugins.push(`pouchdb-adapter-${adapter}`);
    }
  }

  function configurePouch(PouchDB) {
    if (adapters.length > 0) {
      PouchDB.preferredAdapters = adapters;
    }
    if ('AUTO_COMPACTION' in params || 'autoCompaction' in params) {
      PouchDB = PouchDB.defaults({ auto_compaction: true });
    }
    if (commonUtils.isNode()) {
      PouchDB = PouchDB.defaults({ prefix: './tmp/_pouch_' });
    }
    return PouchDB;
  }

  if (commonUtils.isNode()) {
    return configurePouch(commonUtils.loadPouchDBForNode(plugins));
  } else {
    return commonUtils.loadPouchDBForBrowser(plugins).then(configurePouch);
  }
};

commonUtils.loadPouchDBForNode = function (plugins) {
  var params = commonUtils.params();
  var scriptPath = '../packages/node_modules';

  var pouchdbSrc = params.COVERAGE
    ? `${scriptPath}/pouchdb-for-coverage`
    : `${scriptPath}/pouchdb`;

  var PouchDB = require(pouchdbSrc);

  if (!process.env.COVERAGE) {
    for (let plugin of plugins) {
      PouchDB.plugin(require(`${scriptPath}/${plugin}`));
    }
  }
  return PouchDB;
};

commonUtils.loadPouchDBForBrowser = function (plugins) {
  var params = commonUtils.params();
  var scriptPath = '../../packages/pouchdb/dist';
  var pouchdbSrc = params.src || `${scriptPath}/pouchdb.js`;

  plugins = plugins.map((plugin) => {
    plugin = plugin.replace(/^pouchdb-(adapter-)?/, '');
    return `${scriptPath}/pouchdb.${plugin}.js`;
  });

  var scripts = [pouchdbSrc].concat(plugins);

  var loadScripts = scripts.reduce((prevScriptLoaded, script) => {
    return prevScriptLoaded.then(() => commonUtils.asyncLoadScript(script));
  }, Promise.resolve());

  return loadScripts.then(() => window.PouchDB);
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

var PouchForCoverage = require('../packages/pouchdb-for-coverage');
var pouchUtils = PouchForCoverage.utils;
commonUtils.Promise = pouchUtils.Promise;

module.exports = commonUtils;
