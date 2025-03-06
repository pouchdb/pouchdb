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
  const usp = new URLSearchParams(window.location.search);
  const params = {};
  for (const [k, v] of usp) {
    // This preserves previous behaviour: an empty value is re-mapped to
    // `true`.  This is surprising, and differs from the handling of env vars in
    // node (see above).
    params[k] = v || true;
  }
  return params;
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
  if (params.src || params.useMinified) {
    throw new Error('POUCHDB_SRC & USE_MINIFIED options cannot be used for node tests.');
  }

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

const srcExtension = () => {
  const params = commonUtils.params();
  return params.useMinified ? 'min.js' : 'js';
};

const srcRoot = () => {
  const params = commonUtils.params();
  return params.srcRoot || '../../packages/node_modules/pouchdb/dist';
};

commonUtils.pouchdbSrc = function () {
  const params = commonUtils.params();
  if (params.src && params.srcRoot) {
    throw new Error('Cannot use POUCHDB_SRC and SRC_ROOT options together.');
  }
  if (params.src && params.useMinified) {
    throw new Error('Cannot use POUCHDB_SRC and USE_MINIFIED options together.');
  }
  return params.src || `${srcRoot()}/pouchdb.${srcExtension()}`;
};

commonUtils.loadPouchDBForBrowser = function (plugins) {
  plugins = plugins.map((plugin) => {
    plugin = plugin.replace(/^pouchdb-(adapter-)?/, '');
    return `${srcRoot()}/pouchdb.${plugin}.${srcExtension()}`;
  });

  var scripts = [commonUtils.pouchdbSrc()].concat(plugins);

  var loadScripts = scripts.reduce((prevScriptLoaded, script) => {
    return prevScriptLoaded.then(() => commonUtils.asyncLoadScript(script));
  }, Promise.resolve());

  return loadScripts.then(() => window.PouchDB);
};

// Thanks to http://engineeredweb.com/blog/simple-async-javascript-loader/
commonUtils.asyncLoadScript = function (url) {
  return new Promise(function (resolve, reject) {
    // Create a new script and setup the basics.
    var script = document.createElement("script");

    script.async = true;
    script.src = url;

    script.onerror = reject;
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

    document.body.append(script);
  });
};

commonUtils.couchHost = function () {
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
  return 'doc_' + i.toString().padStart(10, '0');
};

module.exports = commonUtils;
