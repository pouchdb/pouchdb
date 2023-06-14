import { AbortController, Headers, fetch } from './pouchdb-fetch.browser.js';
import { generateErrorFromResponse, createError, BAD_ARG } from './pouchdb-errors.browser.js';
import { a as adapterFun, p as pick, b as bulkGet } from './bulkGetShim-75479c95.js';
import 'node:events';
import { i as immediate } from './functionName-4d6db487.js';
import { c as clone } from './clone-f35bcc51.js';
import { e as explainError } from './explainError-browser-c025e6c9.js';
import { p as parseUri, f as filterChange } from './parseUri-b061a2c5.js';
import { f as flatten } from './flatten-994f45c6.js';
import { b as b64ToBluffer } from './base64StringToBlobOrBuffer-browser-ee4c0b54.js';
import { b as binStringToBluffer } from './binaryStringToBlobOrBuffer-browser-2c8e268c.js';
import { a as blobToBase64 } from './blobOrBufferToBase64-browser-35d54d5e.js';
import './spark-md5-2c57e5fc.js';
import './toPromise-06b5d6a8.js';
import './_commonjsHelpers-24198af3.js';
import './__node-resolve_empty-b1d43ca8.js';
import './guardedConsole-f54e5a40.js';
import './readAsBinaryString-06e911ba.js';

// dead simple promise pool, inspired by https://github.com/timdp/es6-promise-pool
// but much smaller in code size. limits the number of concurrent promises that are executed


function pool(promiseFactories, limit) {
  return new Promise(function (resolve, reject) {
    var running = 0;
    var current = 0;
    var done = 0;
    var len = promiseFactories.length;
    var err;

    function runNext() {
      running++;
      promiseFactories[current++]().then(onSuccess, onError);
    }

    function doNext() {
      if (++done === len) {
        /* istanbul ignore if */
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      } else {
        runNextBatch();
      }
    }

    function onSuccess() {
      running--;
      doNext();
    }

    /* istanbul ignore next */
    function onError(thisErr) {
      running--;
      err = err || thisErr;
      doNext();
    }

    function runNextBatch() {
      while (running < limit && current < len) {
        runNext();
      }
    }

    runNextBatch();
  });
}

// 'use strict'; is default when ESM


const CHANGES_BATCH_SIZE = 25;
const MAX_SIMULTANEOUS_REVS = 50;
const CHANGES_TIMEOUT_BUFFER = 5000;
const DEFAULT_HEARTBEAT = 10000;

const supportsBulkGetMap = {};

function readAttachmentsAsBlobOrBuffer(row) {
  const doc = row.doc || row.ok;
  const atts = doc && doc._attachments;
  if (!atts) {
    return;
  }
  Object.keys(atts).forEach(function (filename) {
    const att = atts[filename];
    att.data = b64ToBluffer(att.data, att.content_type);
  });
}

function encodeDocId(id) {
  if (/^_design/.test(id)) {
    return '_design/' + encodeURIComponent(id.slice(8));
  }
  if (id.startsWith('_local/')) {
    return '_local/' + encodeURIComponent(id.slice(7));
  }
  return encodeURIComponent(id);
}

function preprocessAttachments(doc) {
  if (!doc._attachments || !Object.keys(doc._attachments)) {
    return Promise.resolve();
  }

  return Promise.all(Object.keys(doc._attachments).map(function (key) {
    const attachment = doc._attachments[key];
    if (attachment.data && typeof attachment.data !== 'string') {
      return new Promise(function (resolve) {
        blobToBase64(attachment.data, resolve);
      }).then(function (b64) {
        attachment.data = b64;
      });
    }
  }));
}

function hasUrlPrefix(opts) {
  if (!opts.prefix) {
    return false;
  }
  const protocol = parseUri(opts.prefix).protocol;
  return protocol === 'http' || protocol === 'https';
}

// Get all the information you possibly can about the URI given by name and
// return it as a suitable object.
function getHost(name, opts) {
  // encode db name if opts.prefix is a url (#5574)
  if (hasUrlPrefix(opts)) {
    const dbName = opts.name.substr(opts.prefix.length);
    // Ensure prefix has a trailing slash
    const prefix = opts.prefix.replace(/\/?$/, '/');
    name = prefix + encodeURIComponent(dbName);
  }

  const uri = parseUri(name);
  if (uri.user || uri.password) {
    uri.auth = {username: uri.user, password: uri.password};
  }

  // Split the path part of the URI into parts using '/' as the delimiter
  // after removing any leading '/' and any trailing '/'
  const parts = uri.path.replace(/(^\/|\/$)/g, '').split('/');

  uri.db = parts.pop();
  // Prevent double encoding of URI component
  if (uri.db.indexOf('%') === -1) {
    uri.db = encodeURIComponent(uri.db);
  }

  uri.path = parts.join('/');

  return uri;
}

// Generate a URL with the host data given by opts and the given path
function genDBUrl(opts, path) {
  return new URL({...opts, pathname: opts.db + '/' + path });
}

function paramsToStr(params) {
  const paramKeys = Object.keys(params);
  if (paramKeys.length === 0) {
    return '';
  }

  return '?' + paramKeys.map(key => key + '=' + encodeURIComponent(params[key])).join('&');
}

function shouldCacheBust(opts) {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ?
      navigator.userAgent.toLowerCase() : '';
  const isIE = ua.indexOf('msie') !== -1;
  const isTrident = ua.indexOf('trident') !== -1;
  const isEdge = ua.indexOf('edge') !== -1;
  const isGET = !('method' in opts) || opts.method === 'GET';
  return (isIE || isTrident || isEdge) && isGET;
}

// Implements the PouchDB API for dealing with CouchDB instances over HTTP
function HttpPouch(opts, callback) {

  // The functions that will be publicly available for HttpPouch
  const api = this;

  const host = getHost(opts.name, opts);
  const dbUrl = genDBUrl(host, '');

  opts = clone(opts);

  const ourFetch = async function (url, options) {

    options = options || {};
    options.headers = options.headers || new Headers();

    options.credentials = 'include';

    if (opts.auth || host.auth) {
      const nAuth = opts.auth || host.auth;
      const str = nAuth.username + ':' + nAuth.password;
      const token = btoa(unescape(encodeURIComponent(str)));
      options.headers.set('Authorization', 'Basic ' + token);
    }

    const headers = opts.headers || {};
    Object.keys(headers).forEach(function (key) {
      options.headers.append(key, headers[key]);
    });

    /* istanbul ignore if */
    if (shouldCacheBust(options)) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + '_nonce=' + Date.now();
    }

    const fetchFun = opts.fetch || fetch;
    return await fetchFun(url, options);
  };

  function adapterFun$1(name, fun) {
    return adapterFun(name, function (...args) {
      setup().then(function () {
        return fun.apply(this, args);
      }).catch(function (e) {
        const callback = args.pop();
        callback(e);
      });
    }).bind(api);
  }

  async function fetchJSON(url, options) {

    const result = {};

    options = options || {};
    options.headers = options.headers || new Headers();

    if (!options.headers.get('Content-Type')) {
      options.headers.set('Content-Type', 'application/json');
    }
    if (!options.headers.get('Accept')) {
      options.headers.set('Accept', 'application/json');
    }

    const response = await ourFetch(url, options);
    result.ok = response.ok;
    result.status = response.status;
    const json = await response.json();

    result.data = json;
    if (!result.ok) {
      result.data.status = result.status;
      const err = generateErrorFromResponse(result.data);
      throw err;
    }

    if (Array.isArray(result.data)) {
      result.data = result.data.map(function (v) {
        if (v.error || v.missing) {
          return generateErrorFromResponse(v);
        } else {
          return v;
        }
      });
    }

    return result;
  }

  let setupPromise;

  async function setup() {
    if (opts.skip_setup) {
      return Promise.resolve();
    }

    // If there is a setup in process or previous successful setup
    // done then we will use that
    // If previous setups have been rejected we will try again
    if (setupPromise) {
      return setupPromise;
    }

    setupPromise = fetchJSON(dbUrl).catch(function (err) {
      if (err && err.status && err.status === 404) {
        // Doesnt exist, create it
        explainError(404, 'PouchDB is just detecting if the remote exists.');
        return fetchJSON(dbUrl, {method: 'PUT'});
      } else {
        return Promise.reject(err);
      }
    }).catch(function (err) {
      // If we try to create a database that already exists, skipped in
      // istanbul since its catching a race condition.
      /* istanbul ignore if */
      if (err && err.status && err.status === 412) {
        return true;
      }
      return Promise.reject(err);
    });

    setupPromise.catch(function () {
      setupPromise = null;
    });

    return setupPromise;
  }

  immediate(function () {
    callback(null, api);
  });

  api._remote = true;

  /* istanbul ignore next */
  api.type = function () {
    return 'http';
  };

  api.id = adapterFun$1('id', async function (callback) {
    let result;
    try {
      const response = await ourFetch(new URL(host));
      result = await response.json();
    } catch (err) {
      result = {};
    }

    // Bad response or missing `uuid` should not prevent ID generation.
    const uuid = (result && result.uuid) ? (result.uuid + host.db) : genDBUrl(host, '');
    callback(null, uuid);
  });

  // Sends a POST request to the host calling the couchdb _compact function
  //    version: The version of CouchDB it is running
  api.compact = adapterFun$1('compact', async function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = clone(opts);

    await fetchJSON(genDBUrl(host, '_compact'), {method: 'POST'});

    function ping() {
      api.info(function (err, res) {
        // CouchDB may send a "compact_running:true" if it's
        // already compacting. PouchDB Server doesn't.
        /* istanbul ignore else */
        if (res && !res.compact_running) {
          callback(null, {ok: true});
        } else {
          setTimeout(ping, opts.interval || 200);
        }
      });
    }
    // Ping the http if it's finished compaction
    ping();
  });

  api.bulkGet = adapterFun('bulkGet', function (opts, callback) {
    const self = this;

    async function doBulkGet(cb) {
      const params = {};
      if (opts.revs) {
        params.revs = true;
      }
      if (opts.attachments) {
        /* istanbul ignore next */
        params.attachments = true;
      }
      if (opts.latest) {
        params.latest = true;
      }
      try {
        const result = await fetchJSON(genDBUrl(host, '_bulk_get' + paramsToStr(params)), {
          method: 'POST',
          body: JSON.stringify({ docs: opts.docs})
        });

        if (opts.attachments && opts.binary) {
          result.data.results.forEach(function (res) {
            res.docs.forEach(readAttachmentsAsBlobOrBuffer);
          });
        }
        cb(null, result.data);
      } catch (error) {
        cb(error);
      }
    }

    /* istanbul ignore next */
    function doBulkGetShim() {
      // avoid "url too long error" by splitting up into multiple requests
      const batchSize = MAX_SIMULTANEOUS_REVS;
      const numBatches = Math.ceil(opts.docs.length / batchSize);
      let numDone = 0;
      const results = new Array(numBatches);

      function onResult(batchNum) {
        return function (err, res) {
          // err is impossible because shim returns a list of errs in that case
          results[batchNum] = res.results;
          if (++numDone === numBatches) {
            callback(null, {results: flatten(results)});
          }
        };
      }

      for (let i = 0; i < numBatches; i++) {
        const subOpts = pick(opts, ['revs', 'attachments', 'binary', 'latest']);
        subOpts.docs = opts.docs.slice(i * batchSize,
          Math.min(opts.docs.length, (i + 1) * batchSize));
        bulkGet(self, subOpts, onResult(i));
      }
    }

    // mark the whole database as either supporting or not supporting _bulk_get
    const dbUrl = new URL(host);
    const supportsBulkGet = supportsBulkGetMap[dbUrl];

    /* istanbul ignore next */
    if (typeof supportsBulkGet !== 'boolean') {
      // check if this database supports _bulk_get
      doBulkGet(function (err, res) {
        if (err) {
          supportsBulkGetMap[dbUrl] = false;
          explainError(
            err.status,
            'PouchDB is just detecting if the remote ' +
            'supports the _bulk_get API.'
          );
          doBulkGetShim();
        } else {
          supportsBulkGetMap[dbUrl] = true;
          callback(null, res);
        }
      });
    } else if (supportsBulkGet) {
      doBulkGet(callback);
    } else {
      doBulkGetShim();
    }
  });

  // Calls GET on the host, which gets back a JSON string containing
  //    couchdb: A welcome string
  //    version: The version of CouchDB it is running
  api._info = async function (callback) {
    try {
      await setup();
      const response = await ourFetch(genDBUrl(host, ''));
      const info = await response.json();
      info.host = genDBUrl(host, '');
      callback(null, info);
    } catch (err) {
      callback(err);
    }
  };

  api.fetch = async function (path, options) {
    await setup();
    const url = path.substring(0, 1) === '/' ?
    new URL(path.substring(1), new URL(host)) :
    genDBUrl(host, path);
    return ourFetch(url, options);
  };

  // Get the document with the given id from the database given by host.
  // The id could be solely the _id in the database, or it may be a
  // _design/ID or _local/ID path
  api.get = adapterFun$1('get', async function (id, opts, callback) {
    // If no options were given, set the callback to the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = clone(opts);

    // List of parameters to add to the GET request
    const params = {};

    if (opts.revs) {
      params.revs = true;
    }

    if (opts.revs_info) {
      params.revs_info = true;
    }

    if (opts.latest) {
      params.latest = true;
    }

    if (opts.open_revs) {
      if (opts.open_revs !== "all") {
        opts.open_revs = JSON.stringify(opts.open_revs);
      }
      params.open_revs = opts.open_revs;
    }

    if (opts.rev) {
      params.rev = opts.rev;
    }

    if (opts.conflicts) {
      params.conflicts = opts.conflicts;
    }

    /* istanbul ignore if */
    if (opts.update_seq) {
      params.update_seq = opts.update_seq;
    }

    id = encodeDocId(id);

    function fetchAttachments(doc) {
      const atts = doc._attachments;
      const filenames = atts && Object.keys(atts);
      if (!atts || !filenames.length) {
        return;
      }
      // we fetch these manually in separate XHRs, because
      // Sync Gateway would normally send it back as multipart/mixed,
      // which we cannot parse. Also, this is more efficient than
      // receiving attachments as base64-encoded strings.
      async function fetchData(filename) {
        const att = atts[filename];
        const path = encodeDocId(doc._id) + '/' + encodeAttachmentId(filename) +
            '?rev=' + doc._rev;

        const response = await ourFetch(genDBUrl(host, path));

        let blob;
        if ('buffer' in response) {
          blob = await response.buffer();
        } else {
          /* istanbul ignore next */
          blob = await response.blob();
        }

        let data;
        if (opts.binary) {
          const typeFieldDescriptor = Object.getOwnPropertyDescriptor(blob.__proto__, 'type');
          if (!typeFieldDescriptor || typeFieldDescriptor.set) {
            blob.type = att.content_type;
          }
          data = blob;
        } else {
          data = await new Promise(function (resolve) {
            blobToBase64(blob, resolve);
          });
        }

        delete att.stub;
        delete att.length;
        att.data = data;
      }

      const promiseFactories = filenames.map(function (filename) {
        return function () {
          return fetchData(filename);
        };
      });

      // This limits the number of parallel xhr requests to 5 any time
      // to avoid issues with maximum browser request limits
      return pool(promiseFactories, 5);
    }

    function fetchAllAttachments(docOrDocs) {
      if (Array.isArray(docOrDocs)) {
        return Promise.all(docOrDocs.map(function (doc) {
          if (doc.ok) {
            return fetchAttachments(doc.ok);
          }
        }));
      }
      return fetchAttachments(docOrDocs);
    }

    const url = genDBUrl(host, id + paramsToStr(params));
    try {
      const res = await fetchJSON(url);
      if (opts.attachments) {
        await fetchAllAttachments(res.data);
      }
      callback(null, res.data);
    } catch (error) {
      error.docId = id;
      callback(error);
    }
  });


  // Delete the document given by doc from the database given by host.
  api.remove = adapterFun$1('remove', async function (docOrId, optsOrRev, opts, cb) {
    let doc;
    if (typeof optsOrRev === 'string') {
      // id, rev, opts, callback style
      doc = {
        _id: docOrId,
        _rev: optsOrRev
      };
      if (typeof opts === 'function') {
        cb = opts;
        opts = {};
      }
    } else {
      // doc, opts, callback style
      doc = docOrId;
      if (typeof optsOrRev === 'function') {
        cb = optsOrRev;
        opts = {};
      } else {
        cb = opts;
        opts = optsOrRev;
      }
    }

    const rev = (doc._rev || opts.rev);
    const url = genDBUrl(host, encodeDocId(doc._id)) + '?rev=' + rev;

    try {
      const result = await fetchJSON(url, {method: 'DELETE'});
      cb(null, result.data);
    } catch (error) {
      cb(error);
    }
  });

  function encodeAttachmentId(attachmentId) {
    return attachmentId.split("/").map(encodeURIComponent).join("/");
  }

  // Get the attachment
  api.getAttachment = adapterFun$1('getAttachment', async function (docId, attachmentId,
                                                            opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    const params = opts.rev ? ('?rev=' + opts.rev) : '';
    const url = genDBUrl(host, encodeDocId(docId)) + '/' +
        encodeAttachmentId(attachmentId) + params;
    let contentType;
    try {
      const response = await ourFetch(url, {method: 'GET'});

      if (!response.ok) {
        throw response;
      }

      contentType = response.headers.get('content-type');
      let blob;
      if (typeof process !== 'undefined' && !process.browser && typeof response.buffer === 'function') {
        blob = await response.buffer();
      } else {
        /* istanbul ignore next */
        blob = await response.blob();
      }

      // TODO: also remove
      if (typeof process !== 'undefined' && !process.browser) {
        const typeFieldDescriptor = Object.getOwnPropertyDescriptor(blob.__proto__, 'type');
        if (!typeFieldDescriptor || typeFieldDescriptor.set) {
          blob.type = contentType;
        }
      }
      callback(null, blob);
    } catch (err) {
      callback(err);
    }
  });

  // Remove the attachment given by the id and rev
  api.removeAttachment =  adapterFun$1('removeAttachment', async function (
    docId,
    attachmentId,
    rev,
    callback,
  ) {
    const url = genDBUrl(host, encodeDocId(docId) + '/' + encodeAttachmentId(attachmentId)) + '?rev=' + rev;

    try {
      const result = await fetchJSON(url, {method: 'DELETE'});
      callback(null, result.data);
    } catch (error) {
      callback(error);
    }
  });

  // Add the attachment given by blob and its contentType property
  // to the document with the given id, the revision given by rev, and
  // add it to the database given by host.
  api.putAttachment = adapterFun$1('putAttachment', async function (
    docId,
    attachmentId,
    rev,
    blob,
    type,
    callback,
  ) {
    if (typeof type === 'function') {
      callback = type;
      type = blob;
      blob = rev;
      rev = null;
    }
    const id = encodeDocId(docId) + '/' + encodeAttachmentId(attachmentId);
    let url = genDBUrl(host, id);
    if (rev) {
      url += '?rev=' + rev;
    }

    if (typeof blob === 'string') {
      // input is assumed to be a base64 string
      let binary;
      try {
        binary = atob(blob);
      } catch (err) {
        return callback(createError(BAD_ARG,
                        'Attachment is not a valid base64 string'));
      }
      blob = binary ? binStringToBluffer(binary, type) : '';
    }

    try {
      // Add the attachment
      const result = await fetchJSON(url, {
        headers: new Headers({'Content-Type': type}),
        method: 'PUT',
        body: blob
      });
      callback(null, result.data);
    } catch (error) {
      callback(error);
    }
  });

  // Update/create multiple documents given by req in the database
  // given by host.
  api._bulkDocs = async function (req, opts, callback) {
    // If new_edits=false then it prevents the database from creating
    // new revision numbers for the documents. Instead it just uses
    // the old ones. This is used in database replication.
    req.new_edits = opts.new_edits;

    try {
      await setup();
      await Promise.all(req.docs.map(preprocessAttachments));

      // Update/create the documents
      const result = await fetchJSON(genDBUrl(host, '_bulk_docs'), {
        method: 'POST',
        body: JSON.stringify(req)
      });
      callback(null, result.data);
    } catch (error) {
      callback(error);
    }
  };

  // Update/create document
  api._put = async function (doc, opts, callback) {
    try {
      await setup();
      await preprocessAttachments(doc);

      const result = await fetchJSON(genDBUrl(host, encodeDocId(doc._id)), {
        method: 'PUT',
        body: JSON.stringify(doc)
      });
      callback(null, result.data);
    } catch (error) {
      error.docId = doc && doc._id;
      callback(error);
    }
  };


  // Get a listing of the documents in the database given
  // by host and ordered by increasing id.
  api.allDocs = adapterFun$1('allDocs', async function (opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = clone(opts);

    // List of parameters to add to the GET request
    const params = {};
    let body;
    let method = 'GET';

    if (opts.conflicts) {
      params.conflicts = true;
    }

    /* istanbul ignore if */
    if (opts.update_seq) {
      params.update_seq = true;
    }

    if (opts.descending) {
      params.descending = true;
    }

    if (opts.include_docs) {
      params.include_docs = true;
    }

    // added in CouchDB 1.6.0
    if (opts.attachments) {
      params.attachments = true;
    }

    if (opts.key) {
      params.key = JSON.stringify(opts.key);
    }

    if (opts.start_key) {
      opts.startkey = opts.start_key;
    }

    if (opts.startkey) {
      params.startkey = JSON.stringify(opts.startkey);
    }

    if (opts.end_key) {
      opts.endkey = opts.end_key;
    }

    if (opts.endkey) {
      params.endkey = JSON.stringify(opts.endkey);
    }

    if (typeof opts.inclusive_end !== 'undefined') {
      params.inclusive_end = !!opts.inclusive_end;
    }

    if (typeof opts.limit !== 'undefined') {
      params.limit = opts.limit;
    }

    if (typeof opts.skip !== 'undefined') {
      params.skip = opts.skip;
    }

    const paramStr = paramsToStr(params);

    if (typeof opts.keys !== 'undefined') {
      method = 'POST';
      body = {keys: opts.keys};
    }

    try {
      const result = await fetchJSON(genDBUrl(host, '_all_docs' + paramStr), {
        method: method,
        body: JSON.stringify(body)
      });
      if (opts.include_docs && opts.attachments && opts.binary) {
        result.data.rows.forEach(readAttachmentsAsBlobOrBuffer);
      }
      callback(null, result.data);
    } catch (error) {
      callback(error);
    }
  });

  // Get a list of changes made to documents in the database given by host.
  // TODO According to the README, there should be two other methods here,
  // api.changes.addListener and api.changes.removeListener.
  api._changes = function (opts) {

    // We internally page the results of a changes request, this means
    // if there is a large set of changes to be returned we can start
    // processing them quicker instead of waiting on the entire
    // set of changes to return and attempting to process them at once
    const batchSize = 'batch_size' in opts ? opts.batch_size : CHANGES_BATCH_SIZE;

    opts = clone(opts);

    if (opts.continuous && !('heartbeat' in opts)) {
      opts.heartbeat = DEFAULT_HEARTBEAT;
    }

    let requestTimeout = ('timeout' in opts) ? opts.timeout : 30 * 1000;

    // ensure CHANGES_TIMEOUT_BUFFER applies
    if ('timeout' in opts && opts.timeout &&
      (requestTimeout - opts.timeout) < CHANGES_TIMEOUT_BUFFER) {
        requestTimeout = opts.timeout + CHANGES_TIMEOUT_BUFFER;
    }

    /* istanbul ignore if */
    if ('heartbeat' in opts && opts.heartbeat &&
       (requestTimeout - opts.heartbeat) < CHANGES_TIMEOUT_BUFFER) {
        requestTimeout = opts.heartbeat + CHANGES_TIMEOUT_BUFFER;
    }

    const params = {};
    if ('timeout' in opts && opts.timeout) {
      params.timeout = opts.timeout;
    }

    const limit = (typeof opts.limit !== 'undefined') ? opts.limit : false;
    let leftToFetch = limit;

    if (opts.style) {
      params.style = opts.style;
    }

    if (opts.include_docs || opts.filter && typeof opts.filter === 'function') {
      params.include_docs = true;
    }

    if (opts.attachments) {
      params.attachments = true;
    }

    if (opts.continuous) {
      params.feed = 'longpoll';
    }

    if (opts.seq_interval) {
      params.seq_interval = opts.seq_interval;
    }

    if (opts.conflicts) {
      params.conflicts = true;
    }

    if (opts.descending) {
      params.descending = true;
    }

    /* istanbul ignore if */
    if (opts.update_seq) {
      params.update_seq = true;
    }

    if ('heartbeat' in opts) {
      // If the heartbeat value is false, it disables the default heartbeat
      if (opts.heartbeat) {
        params.heartbeat = opts.heartbeat;
      }
    }

    if (opts.filter && typeof opts.filter === 'string') {
      params.filter = opts.filter;
    }

    if (opts.view && typeof opts.view === 'string') {
      params.filter = '_view';
      params.view = opts.view;
    }

    // If opts.query_params exists, pass it through to the changes request.
    // These parameters may be used by the filter on the source database.
    if (opts.query_params && typeof opts.query_params === 'object') {
      for (const param_name in opts.query_params) {
        /* istanbul ignore else */
        if (Object.prototype.hasOwnProperty.call(opts.query_params, param_name)) {
          params[param_name] = opts.query_params[param_name];
        }
      }
    }

    let method = 'GET';
    let body;

    if (opts.doc_ids) {
      // set this automagically for the user; it's annoying that couchdb
      // requires both a "filter" and a "doc_ids" param.
      params.filter = '_doc_ids';
      method = 'POST';
      body = {doc_ids: opts.doc_ids };
    }
    /* istanbul ignore next */
    else if (opts.selector) {
      // set this automagically for the user, similar to above
      params.filter = '_selector';
      method = 'POST';
      body = {selector: opts.selector };
    }

    const controller = new AbortController();
    let lastFetchedSeq;

    // Get all the changes starting wtih the one immediately after the
    // sequence number given by since.
    const fetchData = async function (since, callback) {
      if (opts.aborted) {
        return;
      }
      params.since = since;
      // "since" can be any kind of json object in Cloudant/CouchDB 2.x
      /* istanbul ignore next */
      if (typeof params.since === "object") {
        params.since = JSON.stringify(params.since);
      }

      if (opts.descending) {
        if (limit) {
          params.limit = leftToFetch;
        }
      } else {
        params.limit = (!limit || leftToFetch > batchSize) ?
          batchSize : leftToFetch;
      }

      // Set the options for the ajax call
      const url = genDBUrl(host, '_changes' + paramsToStr(params));
      const fetchOpts = {
        signal: controller.signal,
        method: method,
        body: JSON.stringify(body)
      };
      lastFetchedSeq = since;

      /* istanbul ignore if */
      if (opts.aborted) {
        return;
      }

      // Get the changes
      try {
        await setup();
        const result = await fetchJSON(url, fetchOpts);
        callback(null, result.data);
      } catch (error) {
        callback(error);
      }
    };

    // If opts.since exists, get all the changes from the sequence
    // number given by opts.since. Otherwise, get all the changes
    // from the sequence number 0.
    const results = {results: []};

    const fetched = function (err, res) {
      if (opts.aborted) {
        return;
      }
      let raw_results_length = 0;
      // If the result of the ajax call (res) contains changes (res.results)
      if (res && res.results) {
        raw_results_length = res.results.length;
        results.last_seq = res.last_seq;
        let pending = null;
        let lastSeq = null;
        // Attach 'pending' property if server supports it (CouchDB 2.0+)
        /* istanbul ignore if */
        if (typeof res.pending === 'number') {
          pending = res.pending;
        }
        if (typeof results.last_seq === 'string' || typeof results.last_seq === 'number') {
          lastSeq = results.last_seq;
        }
        opts.query_params;
        res.results = res.results.filter(function (c) {
          leftToFetch--;
          const ret = filterChange(opts)(c);
          if (ret) {
            if (opts.include_docs && opts.attachments && opts.binary) {
              readAttachmentsAsBlobOrBuffer(c);
            }
            if (opts.return_docs) {
              results.results.push(c);
            }
            opts.onChange(c, pending, lastSeq);
          }
          return ret;
        });
      } else if (err) {
        // In case of an error, stop listening for changes and call
        // opts.complete
        opts.aborted = true;
        opts.complete(err);
        return;
      }

      // The changes feed may have timed out with no results
      // if so reuse last update sequence
      if (res && res.last_seq) {
        lastFetchedSeq = res.last_seq;
      }

      const finished = (limit && leftToFetch <= 0) ||
        (res && raw_results_length < batchSize) ||
        (opts.descending);

      if ((opts.continuous && !(limit && leftToFetch <= 0)) || !finished) {
        // Queue a call to fetch again with the newest sequence number
        immediate(function () { fetchData(lastFetchedSeq, fetched); });
      } else {
        // We're done, call the callback
        opts.complete(null, results);
      }
    };

    fetchData(opts.since || 0, fetched);

    // Return a method to cancel this method from processing any more
    return {
      cancel: function () {
        opts.aborted = true;
        controller.abort();
      }
    };
  };

  // Given a set of document/revision IDs (given by req), tets the subset of
  // those that do NOT correspond to revisions stored in the database.
  // See http://wiki.apache.org/couchdb/HttpPostRevsDiff
  api.revsDiff = adapterFun$1('revsDiff', async function (req, opts, callback) {
    // If no options were given, set the callback to be the second parameter
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    try {
      // Get the missing document/revision IDs
      const result = await fetchJSON(genDBUrl(host, '_revs_diff'), {
        method: 'POST',
        body: JSON.stringify(req)
      });
      callback(null, result.data);
    } catch (error) {
      callback(error);
    }
  });

  api._close = function (callback) {
    callback();
  };

  api._destroy = async function (options, callback) {
    try {
      const json = await fetchJSON(genDBUrl(host, ''), {method: 'DELETE'});
      callback(null, json);
    } catch (error) {
      if (error.status === 404) {
        callback(null, {ok: true});
      } else {
        callback(error);
      }
    }
  };
}

// HttpPouch is a valid adapter.
HttpPouch.valid = function () {
  return true;
};

function HttpPouch$1 (PouchDB) {
  PouchDB.adapter('http', HttpPouch, false);
  PouchDB.adapter('https', HttpPouch, false);
}

export { HttpPouch$1 as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWh0dHAuYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWh0dHAvc3JjL3Byb21pc2UtcG9vbC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1odHRwL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBkZWFkIHNpbXBsZSBwcm9taXNlIHBvb2wsIGluc3BpcmVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS90aW1kcC9lczYtcHJvbWlzZS1wb29sXG4vLyBidXQgbXVjaCBzbWFsbGVyIGluIGNvZGUgc2l6ZS4gbGltaXRzIHRoZSBudW1iZXIgb2YgY29uY3VycmVudCBwcm9taXNlcyB0aGF0IGFyZSBleGVjdXRlZFxuXG5cbmZ1bmN0aW9uIHBvb2wocHJvbWlzZUZhY3RvcmllcywgbGltaXQpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgcnVubmluZyA9IDA7XG4gICAgdmFyIGN1cnJlbnQgPSAwO1xuICAgIHZhciBkb25lID0gMDtcbiAgICB2YXIgbGVuID0gcHJvbWlzZUZhY3Rvcmllcy5sZW5ndGg7XG4gICAgdmFyIGVycjtcblxuICAgIGZ1bmN0aW9uIHJ1bk5leHQoKSB7XG4gICAgICBydW5uaW5nKys7XG4gICAgICBwcm9taXNlRmFjdG9yaWVzW2N1cnJlbnQrK10oKS50aGVuKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZG9OZXh0KCkge1xuICAgICAgaWYgKCsrZG9uZSA9PT0gbGVuKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBydW5OZXh0QmF0Y2goKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvblN1Y2Nlc3MoKSB7XG4gICAgICBydW5uaW5nLS07XG4gICAgICBkb05leHQoKTtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGZ1bmN0aW9uIG9uRXJyb3IodGhpc0Vycikge1xuICAgICAgcnVubmluZy0tO1xuICAgICAgZXJyID0gZXJyIHx8IHRoaXNFcnI7XG4gICAgICBkb05leHQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBydW5OZXh0QmF0Y2goKSB7XG4gICAgICB3aGlsZSAocnVubmluZyA8IGxpbWl0ICYmIGN1cnJlbnQgPCBsZW4pIHtcbiAgICAgICAgcnVuTmV4dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJ1bk5leHRCYXRjaCgpO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9vbDsiLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuaW1wb3J0IHBvb2wgZnJvbSAnLi9wcm9taXNlLXBvb2wnO1xuXG5pbXBvcnQgeyBmZXRjaCwgSGVhZGVycywgQWJvcnRDb250cm9sbGVyIH0gZnJvbSAncG91Y2hkYi1mZXRjaCc7XG5cbmltcG9ydCB7XG4gIGNyZWF0ZUVycm9yLFxuICBCQURfQVJHLFxuICBnZW5lcmF0ZUVycm9yRnJvbVJlc3BvbnNlXG59IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuaW1wb3J0IHtcbiAgcGljayxcbiAgZmlsdGVyQ2hhbmdlLFxuICBhZGFwdGVyRnVuIGFzIGNvcmVBZGFwdGVyRnVuLFxuICBleHBsYWluRXJyb3IsXG4gIGNsb25lLFxuICBwYXJzZVVyaSxcbiAgYnVsa0dldFNoaW0sXG4gIGZsYXR0ZW4sXG4gIG5leHRUaWNrXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5pbXBvcnQge1xuICBiaW5hcnlTdHJpbmdUb0Jsb2JPckJ1ZmZlciBhcyBiaW5TdHJpbmdUb0J1ZmZlcixcbiAgYmFzZTY0U3RyaW5nVG9CbG9iT3JCdWZmZXIgYXMgYjY0U3RyaW5nVG9CdWZmZXIsXG4gIGJsb2JPckJ1ZmZlclRvQmFzZTY0IGFzIGJsdWZmZXJUb0Jhc2U2NFxufSBmcm9tICdwb3VjaGRiLWJpbmFyeS11dGlscyc7XG5cbmNvbnN0IENIQU5HRVNfQkFUQ0hfU0laRSA9IDI1O1xuY29uc3QgTUFYX1NJTVVMVEFORU9VU19SRVZTID0gNTA7XG5jb25zdCBDSEFOR0VTX1RJTUVPVVRfQlVGRkVSID0gNTAwMDtcbmNvbnN0IERFRkFVTFRfSEVBUlRCRUFUID0gMTAwMDA7XG5cbmNvbnN0IHN1cHBvcnRzQnVsa0dldE1hcCA9IHt9O1xuXG5mdW5jdGlvbiByZWFkQXR0YWNobWVudHNBc0Jsb2JPckJ1ZmZlcihyb3cpIHtcbiAgY29uc3QgZG9jID0gcm93LmRvYyB8fCByb3cub2s7XG4gIGNvbnN0IGF0dHMgPSBkb2MgJiYgZG9jLl9hdHRhY2htZW50cztcbiAgaWYgKCFhdHRzKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIE9iamVjdC5rZXlzKGF0dHMpLmZvckVhY2goZnVuY3Rpb24gKGZpbGVuYW1lKSB7XG4gICAgY29uc3QgYXR0ID0gYXR0c1tmaWxlbmFtZV07XG4gICAgYXR0LmRhdGEgPSBiNjRTdHJpbmdUb0J1ZmZlcihhdHQuZGF0YSwgYXR0LmNvbnRlbnRfdHlwZSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBlbmNvZGVEb2NJZChpZCkge1xuICBpZiAoL15fZGVzaWduLy50ZXN0KGlkKSkge1xuICAgIHJldHVybiAnX2Rlc2lnbi8nICsgZW5jb2RlVVJJQ29tcG9uZW50KGlkLnNsaWNlKDgpKTtcbiAgfVxuICBpZiAoaWQuc3RhcnRzV2l0aCgnX2xvY2FsLycpKSB7XG4gICAgcmV0dXJuICdfbG9jYWwvJyArIGVuY29kZVVSSUNvbXBvbmVudChpZC5zbGljZSg3KSk7XG4gIH1cbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChpZCk7XG59XG5cbmZ1bmN0aW9uIHByZXByb2Nlc3NBdHRhY2htZW50cyhkb2MpIHtcbiAgaWYgKCFkb2MuX2F0dGFjaG1lbnRzIHx8ICFPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIHJldHVybiBQcm9taXNlLmFsbChPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgIGNvbnN0IGF0dGFjaG1lbnQgPSBkb2MuX2F0dGFjaG1lbnRzW2tleV07XG4gICAgaWYgKGF0dGFjaG1lbnQuZGF0YSAmJiB0eXBlb2YgYXR0YWNobWVudC5kYXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgIGJsdWZmZXJUb0Jhc2U2NChhdHRhY2htZW50LmRhdGEsIHJlc29sdmUpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoYjY0KSB7XG4gICAgICAgIGF0dGFjaG1lbnQuZGF0YSA9IGI2NDtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSkpO1xufVxuXG5mdW5jdGlvbiBoYXNVcmxQcmVmaXgob3B0cykge1xuICBpZiAoIW9wdHMucHJlZml4KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvY29sID0gcGFyc2VVcmkob3B0cy5wcmVmaXgpLnByb3RvY29sO1xuICByZXR1cm4gcHJvdG9jb2wgPT09ICdodHRwJyB8fCBwcm90b2NvbCA9PT0gJ2h0dHBzJztcbn1cblxuLy8gR2V0IGFsbCB0aGUgaW5mb3JtYXRpb24geW91IHBvc3NpYmx5IGNhbiBhYm91dCB0aGUgVVJJIGdpdmVuIGJ5IG5hbWUgYW5kXG4vLyByZXR1cm4gaXQgYXMgYSBzdWl0YWJsZSBvYmplY3QuXG5mdW5jdGlvbiBnZXRIb3N0KG5hbWUsIG9wdHMpIHtcbiAgLy8gZW5jb2RlIGRiIG5hbWUgaWYgb3B0cy5wcmVmaXggaXMgYSB1cmwgKCM1NTc0KVxuICBpZiAoaGFzVXJsUHJlZml4KG9wdHMpKSB7XG4gICAgY29uc3QgZGJOYW1lID0gb3B0cy5uYW1lLnN1YnN0cihvcHRzLnByZWZpeC5sZW5ndGgpO1xuICAgIC8vIEVuc3VyZSBwcmVmaXggaGFzIGEgdHJhaWxpbmcgc2xhc2hcbiAgICBjb25zdCBwcmVmaXggPSBvcHRzLnByZWZpeC5yZXBsYWNlKC9cXC8/JC8sICcvJyk7XG4gICAgbmFtZSA9IHByZWZpeCArIGVuY29kZVVSSUNvbXBvbmVudChkYk5hbWUpO1xuICB9XG5cbiAgY29uc3QgdXJpID0gcGFyc2VVcmkobmFtZSk7XG4gIGlmICh1cmkudXNlciB8fCB1cmkucGFzc3dvcmQpIHtcbiAgICB1cmkuYXV0aCA9IHt1c2VybmFtZTogdXJpLnVzZXIsIHBhc3N3b3JkOiB1cmkucGFzc3dvcmR9O1xuICB9XG5cbiAgLy8gU3BsaXQgdGhlIHBhdGggcGFydCBvZiB0aGUgVVJJIGludG8gcGFydHMgdXNpbmcgJy8nIGFzIHRoZSBkZWxpbWl0ZXJcbiAgLy8gYWZ0ZXIgcmVtb3ZpbmcgYW55IGxlYWRpbmcgJy8nIGFuZCBhbnkgdHJhaWxpbmcgJy8nXG4gIGNvbnN0IHBhcnRzID0gdXJpLnBhdGgucmVwbGFjZSgvKF5cXC98XFwvJCkvZywgJycpLnNwbGl0KCcvJyk7XG5cbiAgdXJpLmRiID0gcGFydHMucG9wKCk7XG4gIC8vIFByZXZlbnQgZG91YmxlIGVuY29kaW5nIG9mIFVSSSBjb21wb25lbnRcbiAgaWYgKHVyaS5kYi5pbmRleE9mKCclJykgPT09IC0xKSB7XG4gICAgdXJpLmRiID0gZW5jb2RlVVJJQ29tcG9uZW50KHVyaS5kYik7XG4gIH1cblxuICB1cmkucGF0aCA9IHBhcnRzLmpvaW4oJy8nKTtcblxuICByZXR1cm4gdXJpO1xufVxuXG4vLyBHZW5lcmF0ZSBhIFVSTCB3aXRoIHRoZSBob3N0IGRhdGEgZ2l2ZW4gYnkgb3B0cyBhbmQgdGhlIGdpdmVuIHBhdGhcbmZ1bmN0aW9uIGdlbkRCVXJsKG9wdHMsIHBhdGgpIHtcbiAgcmV0dXJuIG5ldyBVUkwoey4uLm9wdHMsIHBhdGhuYW1lOiBvcHRzLmRiICsgJy8nICsgcGF0aCB9KTtcbn1cblxuZnVuY3Rpb24gcGFyYW1zVG9TdHIocGFyYW1zKSB7XG4gIGNvbnN0IHBhcmFtS2V5cyA9IE9iamVjdC5rZXlzKHBhcmFtcyk7XG4gIGlmIChwYXJhbUtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgcmV0dXJuICc/JyArIHBhcmFtS2V5cy5tYXAoa2V5ID0+IGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChwYXJhbXNba2V5XSkpLmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkQ2FjaGVCdXN0KG9wdHMpIHtcbiAgY29uc3QgdWEgPSAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCkgP1xuICAgICAgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpIDogJyc7XG4gIGNvbnN0IGlzSUUgPSB1YS5pbmRleE9mKCdtc2llJykgIT09IC0xO1xuICBjb25zdCBpc1RyaWRlbnQgPSB1YS5pbmRleE9mKCd0cmlkZW50JykgIT09IC0xO1xuICBjb25zdCBpc0VkZ2UgPSB1YS5pbmRleE9mKCdlZGdlJykgIT09IC0xO1xuICBjb25zdCBpc0dFVCA9ICEoJ21ldGhvZCcgaW4gb3B0cykgfHwgb3B0cy5tZXRob2QgPT09ICdHRVQnO1xuICByZXR1cm4gKGlzSUUgfHwgaXNUcmlkZW50IHx8IGlzRWRnZSkgJiYgaXNHRVQ7XG59XG5cbi8vIEltcGxlbWVudHMgdGhlIFBvdWNoREIgQVBJIGZvciBkZWFsaW5nIHdpdGggQ291Y2hEQiBpbnN0YW5jZXMgb3ZlciBIVFRQXG5mdW5jdGlvbiBIdHRwUG91Y2gob3B0cywgY2FsbGJhY2spIHtcblxuICAvLyBUaGUgZnVuY3Rpb25zIHRoYXQgd2lsbCBiZSBwdWJsaWNseSBhdmFpbGFibGUgZm9yIEh0dHBQb3VjaFxuICBjb25zdCBhcGkgPSB0aGlzO1xuXG4gIGNvbnN0IGhvc3QgPSBnZXRIb3N0KG9wdHMubmFtZSwgb3B0cyk7XG4gIGNvbnN0IGRiVXJsID0gZ2VuREJVcmwoaG9zdCwgJycpO1xuXG4gIG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICBjb25zdCBvdXJGZXRjaCA9IGFzeW5jIGZ1bmN0aW9uICh1cmwsIG9wdGlvbnMpIHtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCBuZXcgSGVhZGVycygpO1xuXG4gICAgb3B0aW9ucy5jcmVkZW50aWFscyA9ICdpbmNsdWRlJztcblxuICAgIGlmIChvcHRzLmF1dGggfHwgaG9zdC5hdXRoKSB7XG4gICAgICBjb25zdCBuQXV0aCA9IG9wdHMuYXV0aCB8fCBob3N0LmF1dGg7XG4gICAgICBjb25zdCBzdHIgPSBuQXV0aC51c2VybmFtZSArICc6JyArIG5BdXRoLnBhc3N3b3JkO1xuICAgICAgY29uc3QgdG9rZW4gPSBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChzdHIpKSk7XG4gICAgICBvcHRpb25zLmhlYWRlcnMuc2V0KCdBdXRob3JpemF0aW9uJywgJ0Jhc2ljICcgKyB0b2tlbik7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZGVycyA9IG9wdHMuaGVhZGVycyB8fCB7fTtcbiAgICBPYmplY3Qua2V5cyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIG9wdGlvbnMuaGVhZGVycy5hcHBlbmQoa2V5LCBoZWFkZXJzW2tleV0pO1xuICAgIH0pO1xuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHNob3VsZENhY2hlQnVzdChvcHRpb25zKSkge1xuICAgICAgdXJsICs9ICh1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJykgKyAnX25vbmNlPScgKyBEYXRlLm5vdygpO1xuICAgIH1cblxuICAgIGNvbnN0IGZldGNoRnVuID0gb3B0cy5mZXRjaCB8fCBmZXRjaDtcbiAgICByZXR1cm4gYXdhaXQgZmV0Y2hGdW4odXJsLCBvcHRpb25zKTtcbiAgfTtcblxuICBmdW5jdGlvbiBhZGFwdGVyRnVuKG5hbWUsIGZ1bikge1xuICAgIHJldHVybiBjb3JlQWRhcHRlckZ1bihuYW1lLCBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgc2V0dXAoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZ1bi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKGFwaSk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBmZXRjaEpTT04odXJsLCBvcHRpb25zKSB7XG5cbiAgICBjb25zdCByZXN1bHQgPSB7fTtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCBuZXcgSGVhZGVycygpO1xuXG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMuZ2V0KCdDb250ZW50LVR5cGUnKSkge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzLnNldCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMuZ2V0KCdBY2NlcHQnKSkge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzLnNldCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG91ckZldGNoKHVybCwgb3B0aW9ucyk7XG4gICAgcmVzdWx0Lm9rID0gcmVzcG9uc2Uub2s7XG4gICAgcmVzdWx0LnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgcmVzdWx0LmRhdGEgPSBqc29uO1xuICAgIGlmICghcmVzdWx0Lm9rKSB7XG4gICAgICByZXN1bHQuZGF0YS5zdGF0dXMgPSByZXN1bHQuc3RhdHVzO1xuICAgICAgY29uc3QgZXJyID0gZ2VuZXJhdGVFcnJvckZyb21SZXNwb25zZShyZXN1bHQuZGF0YSk7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0LmRhdGEpKSB7XG4gICAgICByZXN1bHQuZGF0YSA9IHJlc3VsdC5kYXRhLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICBpZiAodi5lcnJvciB8fCB2Lm1pc3NpbmcpIHtcbiAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVFcnJvckZyb21SZXNwb25zZSh2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGxldCBzZXR1cFByb21pc2U7XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0dXAoKSB7XG4gICAgaWYgKG9wdHMuc2tpcF9zZXR1cCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIGEgc2V0dXAgaW4gcHJvY2VzcyBvciBwcmV2aW91cyBzdWNjZXNzZnVsIHNldHVwXG4gICAgLy8gZG9uZSB0aGVuIHdlIHdpbGwgdXNlIHRoYXRcbiAgICAvLyBJZiBwcmV2aW91cyBzZXR1cHMgaGF2ZSBiZWVuIHJlamVjdGVkIHdlIHdpbGwgdHJ5IGFnYWluXG4gICAgaWYgKHNldHVwUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHNldHVwUHJvbWlzZTtcbiAgICB9XG5cbiAgICBzZXR1cFByb21pc2UgPSBmZXRjaEpTT04oZGJVcmwpLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIgJiYgZXJyLnN0YXR1cyAmJiBlcnIuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgLy8gRG9lc250IGV4aXN0LCBjcmVhdGUgaXRcbiAgICAgICAgZXhwbGFpbkVycm9yKDQwNCwgJ1BvdWNoREIgaXMganVzdCBkZXRlY3RpbmcgaWYgdGhlIHJlbW90ZSBleGlzdHMuJyk7XG4gICAgICAgIHJldHVybiBmZXRjaEpTT04oZGJVcmwsIHttZXRob2Q6ICdQVVQnfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgIH1cbiAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAvLyBJZiB3ZSB0cnkgdG8gY3JlYXRlIGEgZGF0YWJhc2UgdGhhdCBhbHJlYWR5IGV4aXN0cywgc2tpcHBlZCBpblxuICAgICAgLy8gaXN0YW5idWwgc2luY2UgaXRzIGNhdGNoaW5nIGEgcmFjZSBjb25kaXRpb24uXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlcnIgJiYgZXJyLnN0YXR1cyAmJiBlcnIuc3RhdHVzID09PSA0MTIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICB9KTtcblxuICAgIHNldHVwUHJvbWlzZS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICBzZXR1cFByb21pc2UgPSBudWxsO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNldHVwUHJvbWlzZTtcbiAgfVxuXG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCBhcGkpO1xuICB9KTtcblxuICBhcGkuX3JlbW90ZSA9IHRydWU7XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgYXBpLnR5cGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICdodHRwJztcbiAgfTtcblxuICBhcGkuaWQgPSBhZGFwdGVyRnVuKCdpZCcsIGFzeW5jIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgb3VyRmV0Y2gobmV3IFVSTChob3N0KSk7XG4gICAgICByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXN1bHQgPSB7fTtcbiAgICB9XG5cbiAgICAvLyBCYWQgcmVzcG9uc2Ugb3IgbWlzc2luZyBgdXVpZGAgc2hvdWxkIG5vdCBwcmV2ZW50IElEIGdlbmVyYXRpb24uXG4gICAgY29uc3QgdXVpZCA9IChyZXN1bHQgJiYgcmVzdWx0LnV1aWQpID8gKHJlc3VsdC51dWlkICsgaG9zdC5kYikgOiBnZW5EQlVybChob3N0LCAnJyk7XG4gICAgY2FsbGJhY2sobnVsbCwgdXVpZCk7XG4gIH0pO1xuXG4gIC8vIFNlbmRzIGEgUE9TVCByZXF1ZXN0IHRvIHRoZSBob3N0IGNhbGxpbmcgdGhlIGNvdWNoZGIgX2NvbXBhY3QgZnVuY3Rpb25cbiAgLy8gICAgdmVyc2lvbjogVGhlIHZlcnNpb24gb2YgQ291Y2hEQiBpdCBpcyBydW5uaW5nXG4gIGFwaS5jb21wYWN0ID0gYWRhcHRlckZ1bignY29tcGFjdCcsIGFzeW5jIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBvcHRzID0gY2xvbmUob3B0cyk7XG5cbiAgICBhd2FpdCBmZXRjaEpTT04oZ2VuREJVcmwoaG9zdCwgJ19jb21wYWN0JyksIHttZXRob2Q6ICdQT1NUJ30pO1xuXG4gICAgZnVuY3Rpb24gcGluZygpIHtcbiAgICAgIGFwaS5pbmZvKGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAvLyBDb3VjaERCIG1heSBzZW5kIGEgXCJjb21wYWN0X3J1bm5pbmc6dHJ1ZVwiIGlmIGl0J3NcbiAgICAgICAgLy8gYWxyZWFkeSBjb21wYWN0aW5nLiBQb3VjaERCIFNlcnZlciBkb2Vzbid0LlxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgICBpZiAocmVzICYmICFyZXMuY29tcGFjdF9ydW5uaW5nKSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwge29rOiB0cnVlfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2V0VGltZW91dChwaW5nLCBvcHRzLmludGVydmFsIHx8IDIwMCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBQaW5nIHRoZSBodHRwIGlmIGl0J3MgZmluaXNoZWQgY29tcGFjdGlvblxuICAgIHBpbmcoKTtcbiAgfSk7XG5cbiAgYXBpLmJ1bGtHZXQgPSBjb3JlQWRhcHRlckZ1bignYnVsa0dldCcsIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgYXN5bmMgZnVuY3Rpb24gZG9CdWxrR2V0KGNiKSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSB7fTtcbiAgICAgIGlmIChvcHRzLnJldnMpIHtcbiAgICAgICAgcGFyYW1zLnJldnMgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgcGFyYW1zLmF0dGFjaG1lbnRzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRzLmxhdGVzdCkge1xuICAgICAgICBwYXJhbXMubGF0ZXN0ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTihnZW5EQlVybChob3N0LCAnX2J1bGtfZ2V0JyArIHBhcmFtc1RvU3RyKHBhcmFtcykpLCB7XG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBkb2NzOiBvcHRzLmRvY3N9KVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBvcHRzLmJpbmFyeSkge1xuICAgICAgICAgIHJlc3VsdC5kYXRhLnJlc3VsdHMuZm9yRWFjaChmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICByZXMuZG9jcy5mb3JFYWNoKHJlYWRBdHRhY2htZW50c0FzQmxvYk9yQnVmZmVyKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjYihlcnJvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBmdW5jdGlvbiBkb0J1bGtHZXRTaGltKCkge1xuICAgICAgLy8gYXZvaWQgXCJ1cmwgdG9vIGxvbmcgZXJyb3JcIiBieSBzcGxpdHRpbmcgdXAgaW50byBtdWx0aXBsZSByZXF1ZXN0c1xuICAgICAgY29uc3QgYmF0Y2hTaXplID0gTUFYX1NJTVVMVEFORU9VU19SRVZTO1xuICAgICAgY29uc3QgbnVtQmF0Y2hlcyA9IE1hdGguY2VpbChvcHRzLmRvY3MubGVuZ3RoIC8gYmF0Y2hTaXplKTtcbiAgICAgIGxldCBudW1Eb25lID0gMDtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBuZXcgQXJyYXkobnVtQmF0Y2hlcyk7XG5cbiAgICAgIGZ1bmN0aW9uIG9uUmVzdWx0KGJhdGNoTnVtKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAvLyBlcnIgaXMgaW1wb3NzaWJsZSBiZWNhdXNlIHNoaW0gcmV0dXJucyBhIGxpc3Qgb2YgZXJycyBpbiB0aGF0IGNhc2VcbiAgICAgICAgICByZXN1bHRzW2JhdGNoTnVtXSA9IHJlcy5yZXN1bHRzO1xuICAgICAgICAgIGlmICgrK251bURvbmUgPT09IG51bUJhdGNoZXMpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHtyZXN1bHRzOiBmbGF0dGVuKHJlc3VsdHMpfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUJhdGNoZXM7IGkrKykge1xuICAgICAgICBjb25zdCBzdWJPcHRzID0gcGljayhvcHRzLCBbJ3JldnMnLCAnYXR0YWNobWVudHMnLCAnYmluYXJ5JywgJ2xhdGVzdCddKTtcbiAgICAgICAgc3ViT3B0cy5kb2NzID0gb3B0cy5kb2NzLnNsaWNlKGkgKiBiYXRjaFNpemUsXG4gICAgICAgICAgTWF0aC5taW4ob3B0cy5kb2NzLmxlbmd0aCwgKGkgKyAxKSAqIGJhdGNoU2l6ZSkpO1xuICAgICAgICBidWxrR2V0U2hpbShzZWxmLCBzdWJPcHRzLCBvblJlc3VsdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gbWFyayB0aGUgd2hvbGUgZGF0YWJhc2UgYXMgZWl0aGVyIHN1cHBvcnRpbmcgb3Igbm90IHN1cHBvcnRpbmcgX2J1bGtfZ2V0XG4gICAgY29uc3QgZGJVcmwgPSBuZXcgVVJMKGhvc3QpO1xuICAgIGNvbnN0IHN1cHBvcnRzQnVsa0dldCA9IHN1cHBvcnRzQnVsa0dldE1hcFtkYlVybF07XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0eXBlb2Ygc3VwcG9ydHNCdWxrR2V0ICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIC8vIGNoZWNrIGlmIHRoaXMgZGF0YWJhc2Ugc3VwcG9ydHMgX2J1bGtfZ2V0XG4gICAgICBkb0J1bGtHZXQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBzdXBwb3J0c0J1bGtHZXRNYXBbZGJVcmxdID0gZmFsc2U7XG4gICAgICAgICAgZXhwbGFpbkVycm9yKFxuICAgICAgICAgICAgZXJyLnN0YXR1cyxcbiAgICAgICAgICAgICdQb3VjaERCIGlzIGp1c3QgZGV0ZWN0aW5nIGlmIHRoZSByZW1vdGUgJyArXG4gICAgICAgICAgICAnc3VwcG9ydHMgdGhlIF9idWxrX2dldCBBUEkuJ1xuICAgICAgICAgICk7XG4gICAgICAgICAgZG9CdWxrR2V0U2hpbSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN1cHBvcnRzQnVsa0dldE1hcFtkYlVybF0gPSB0cnVlO1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoc3VwcG9ydHNCdWxrR2V0KSB7XG4gICAgICBkb0J1bGtHZXQoY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb0J1bGtHZXRTaGltKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBDYWxscyBHRVQgb24gdGhlIGhvc3QsIHdoaWNoIGdldHMgYmFjayBhIEpTT04gc3RyaW5nIGNvbnRhaW5pbmdcbiAgLy8gICAgY291Y2hkYjogQSB3ZWxjb21lIHN0cmluZ1xuICAvLyAgICB2ZXJzaW9uOiBUaGUgdmVyc2lvbiBvZiBDb3VjaERCIGl0IGlzIHJ1bm5pbmdcbiAgYXBpLl9pbmZvID0gYXN5bmMgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNldHVwKCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG91ckZldGNoKGdlbkRCVXJsKGhvc3QsICcnKSk7XG4gICAgICBjb25zdCBpbmZvID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgaW5mby5ob3N0ID0gZ2VuREJVcmwoaG9zdCwgJycpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgaW5mbyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH1cbiAgfTtcblxuICBhcGkuZmV0Y2ggPSBhc3luYyBmdW5jdGlvbiAocGF0aCwgb3B0aW9ucykge1xuICAgIGF3YWl0IHNldHVwKCk7XG4gICAgY29uc3QgdXJsID0gcGF0aC5zdWJzdHJpbmcoMCwgMSkgPT09ICcvJyA/XG4gICAgbmV3IFVSTChwYXRoLnN1YnN0cmluZygxKSwgbmV3IFVSTChob3N0KSkgOlxuICAgIGdlbkRCVXJsKGhvc3QsIHBhdGgpO1xuICAgIHJldHVybiBvdXJGZXRjaCh1cmwsIG9wdGlvbnMpO1xuICB9O1xuXG4gIC8vIEdldCB0aGUgZG9jdW1lbnQgd2l0aCB0aGUgZ2l2ZW4gaWQgZnJvbSB0aGUgZGF0YWJhc2UgZ2l2ZW4gYnkgaG9zdC5cbiAgLy8gVGhlIGlkIGNvdWxkIGJlIHNvbGVseSB0aGUgX2lkIGluIHRoZSBkYXRhYmFzZSwgb3IgaXQgbWF5IGJlIGFcbiAgLy8gX2Rlc2lnbi9JRCBvciBfbG9jYWwvSUQgcGF0aFxuICBhcGkuZ2V0ID0gYWRhcHRlckZ1bignZ2V0JywgYXN5bmMgZnVuY3Rpb24gKGlkLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIC8vIElmIG5vIG9wdGlvbnMgd2VyZSBnaXZlbiwgc2V0IHRoZSBjYWxsYmFjayB0byB0aGUgc2Vjb25kIHBhcmFtZXRlclxuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBvcHRzID0gY2xvbmUob3B0cyk7XG5cbiAgICAvLyBMaXN0IG9mIHBhcmFtZXRlcnMgdG8gYWRkIHRvIHRoZSBHRVQgcmVxdWVzdFxuICAgIGNvbnN0IHBhcmFtcyA9IHt9O1xuXG4gICAgaWYgKG9wdHMucmV2cykge1xuICAgICAgcGFyYW1zLnJldnMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLnJldnNfaW5mbykge1xuICAgICAgcGFyYW1zLnJldnNfaW5mbyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMubGF0ZXN0KSB7XG4gICAgICBwYXJhbXMubGF0ZXN0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5vcGVuX3JldnMpIHtcbiAgICAgIGlmIChvcHRzLm9wZW5fcmV2cyAhPT0gXCJhbGxcIikge1xuICAgICAgICBvcHRzLm9wZW5fcmV2cyA9IEpTT04uc3RyaW5naWZ5KG9wdHMub3Blbl9yZXZzKTtcbiAgICAgIH1cbiAgICAgIHBhcmFtcy5vcGVuX3JldnMgPSBvcHRzLm9wZW5fcmV2cztcbiAgICB9XG5cbiAgICBpZiAob3B0cy5yZXYpIHtcbiAgICAgIHBhcmFtcy5yZXYgPSBvcHRzLnJldjtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5jb25mbGljdHMpIHtcbiAgICAgIHBhcmFtcy5jb25mbGljdHMgPSBvcHRzLmNvbmZsaWN0cztcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAob3B0cy51cGRhdGVfc2VxKSB7XG4gICAgICBwYXJhbXMudXBkYXRlX3NlcSA9IG9wdHMudXBkYXRlX3NlcTtcbiAgICB9XG5cbiAgICBpZCA9IGVuY29kZURvY0lkKGlkKTtcblxuICAgIGZ1bmN0aW9uIGZldGNoQXR0YWNobWVudHMoZG9jKSB7XG4gICAgICBjb25zdCBhdHRzID0gZG9jLl9hdHRhY2htZW50cztcbiAgICAgIGNvbnN0IGZpbGVuYW1lcyA9IGF0dHMgJiYgT2JqZWN0LmtleXMoYXR0cyk7XG4gICAgICBpZiAoIWF0dHMgfHwgIWZpbGVuYW1lcy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8gd2UgZmV0Y2ggdGhlc2UgbWFudWFsbHkgaW4gc2VwYXJhdGUgWEhScywgYmVjYXVzZVxuICAgICAgLy8gU3luYyBHYXRld2F5IHdvdWxkIG5vcm1hbGx5IHNlbmQgaXQgYmFjayBhcyBtdWx0aXBhcnQvbWl4ZWQsXG4gICAgICAvLyB3aGljaCB3ZSBjYW5ub3QgcGFyc2UuIEFsc28sIHRoaXMgaXMgbW9yZSBlZmZpY2llbnQgdGhhblxuICAgICAgLy8gcmVjZWl2aW5nIGF0dGFjaG1lbnRzIGFzIGJhc2U2NC1lbmNvZGVkIHN0cmluZ3MuXG4gICAgICBhc3luYyBmdW5jdGlvbiBmZXRjaERhdGEoZmlsZW5hbWUpIHtcbiAgICAgICAgY29uc3QgYXR0ID0gYXR0c1tmaWxlbmFtZV07XG4gICAgICAgIGNvbnN0IHBhdGggPSBlbmNvZGVEb2NJZChkb2MuX2lkKSArICcvJyArIGVuY29kZUF0dGFjaG1lbnRJZChmaWxlbmFtZSkgK1xuICAgICAgICAgICAgJz9yZXY9JyArIGRvYy5fcmV2O1xuXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgb3VyRmV0Y2goZ2VuREJVcmwoaG9zdCwgcGF0aCkpO1xuXG4gICAgICAgIGxldCBibG9iO1xuICAgICAgICBpZiAoJ2J1ZmZlcicgaW4gcmVzcG9uc2UpIHtcbiAgICAgICAgICBibG9iID0gYXdhaXQgcmVzcG9uc2UuYnVmZmVyKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgICBibG9iID0gYXdhaXQgcmVzcG9uc2UuYmxvYigpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGRhdGE7XG4gICAgICAgIGlmIChvcHRzLmJpbmFyeSkge1xuICAgICAgICAgIGNvbnN0IHR5cGVGaWVsZERlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGJsb2IuX19wcm90b19fLCAndHlwZScpO1xuICAgICAgICAgIGlmICghdHlwZUZpZWxkRGVzY3JpcHRvciB8fCB0eXBlRmllbGREZXNjcmlwdG9yLnNldCkge1xuICAgICAgICAgICAgYmxvYi50eXBlID0gYXR0LmNvbnRlbnRfdHlwZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgZGF0YSA9IGJsb2I7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGF0YSA9IGF3YWl0IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgICAgICBibHVmZmVyVG9CYXNlNjQoYmxvYiwgcmVzb2x2ZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgYXR0LnN0dWI7XG4gICAgICAgIGRlbGV0ZSBhdHQubGVuZ3RoO1xuICAgICAgICBhdHQuZGF0YSA9IGRhdGE7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHByb21pc2VGYWN0b3JpZXMgPSBmaWxlbmFtZXMubWFwKGZ1bmN0aW9uIChmaWxlbmFtZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBmZXRjaERhdGEoZmlsZW5hbWUpO1xuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFRoaXMgbGltaXRzIHRoZSBudW1iZXIgb2YgcGFyYWxsZWwgeGhyIHJlcXVlc3RzIHRvIDUgYW55IHRpbWVcbiAgICAgIC8vIHRvIGF2b2lkIGlzc3VlcyB3aXRoIG1heGltdW0gYnJvd3NlciByZXF1ZXN0IGxpbWl0c1xuICAgICAgcmV0dXJuIHBvb2wocHJvbWlzZUZhY3RvcmllcywgNSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZmV0Y2hBbGxBdHRhY2htZW50cyhkb2NPckRvY3MpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGRvY09yRG9jcykpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKGRvY09yRG9jcy5tYXAoZnVuY3Rpb24gKGRvYykge1xuICAgICAgICAgIGlmIChkb2Mub2spIHtcbiAgICAgICAgICAgIHJldHVybiBmZXRjaEF0dGFjaG1lbnRzKGRvYy5vayk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmV0Y2hBdHRhY2htZW50cyhkb2NPckRvY3MpO1xuICAgIH1cblxuICAgIGNvbnN0IHVybCA9IGdlbkRCVXJsKGhvc3QsIGlkICsgcGFyYW1zVG9TdHIocGFyYW1zKSk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoSlNPTih1cmwpO1xuICAgICAgaWYgKG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICAgICAgYXdhaXQgZmV0Y2hBbGxBdHRhY2htZW50cyhyZXMuZGF0YSk7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCByZXMuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGVycm9yLmRvY0lkID0gaWQ7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9KTtcblxuXG4gIC8vIERlbGV0ZSB0aGUgZG9jdW1lbnQgZ2l2ZW4gYnkgZG9jIGZyb20gdGhlIGRhdGFiYXNlIGdpdmVuIGJ5IGhvc3QuXG4gIGFwaS5yZW1vdmUgPSBhZGFwdGVyRnVuKCdyZW1vdmUnLCBhc3luYyBmdW5jdGlvbiAoZG9jT3JJZCwgb3B0c09yUmV2LCBvcHRzLCBjYikge1xuICAgIGxldCBkb2M7XG4gICAgaWYgKHR5cGVvZiBvcHRzT3JSZXYgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBpZCwgcmV2LCBvcHRzLCBjYWxsYmFjayBzdHlsZVxuICAgICAgZG9jID0ge1xuICAgICAgICBfaWQ6IGRvY09ySWQsXG4gICAgICAgIF9yZXY6IG9wdHNPclJldlxuICAgICAgfTtcbiAgICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYiA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gZG9jLCBvcHRzLCBjYWxsYmFjayBzdHlsZVxuICAgICAgZG9jID0gZG9jT3JJZDtcbiAgICAgIGlmICh0eXBlb2Ygb3B0c09yUmV2ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gb3B0c09yUmV2O1xuICAgICAgICBvcHRzID0ge307XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYiA9IG9wdHM7XG4gICAgICAgIG9wdHMgPSBvcHRzT3JSZXY7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgcmV2ID0gKGRvYy5fcmV2IHx8IG9wdHMucmV2KTtcbiAgICBjb25zdCB1cmwgPSBnZW5EQlVybChob3N0LCBlbmNvZGVEb2NJZChkb2MuX2lkKSkgKyAnP3Jldj0nICsgcmV2O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTih1cmwsIHttZXRob2Q6ICdERUxFVEUnfSk7XG4gICAgICBjYihudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNiKGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGVuY29kZUF0dGFjaG1lbnRJZChhdHRhY2htZW50SWQpIHtcbiAgICByZXR1cm4gYXR0YWNobWVudElkLnNwbGl0KFwiL1wiKS5tYXAoZW5jb2RlVVJJQ29tcG9uZW50KS5qb2luKFwiL1wiKTtcbiAgfVxuXG4gIC8vIEdldCB0aGUgYXR0YWNobWVudFxuICBhcGkuZ2V0QXR0YWNobWVudCA9IGFkYXB0ZXJGdW4oJ2dldEF0dGFjaG1lbnQnLCBhc3luYyBmdW5jdGlvbiAoZG9jSWQsIGF0dGFjaG1lbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIGNvbnN0IHBhcmFtcyA9IG9wdHMucmV2ID8gKCc/cmV2PScgKyBvcHRzLnJldikgOiAnJztcbiAgICBjb25zdCB1cmwgPSBnZW5EQlVybChob3N0LCBlbmNvZGVEb2NJZChkb2NJZCkpICsgJy8nICtcbiAgICAgICAgZW5jb2RlQXR0YWNobWVudElkKGF0dGFjaG1lbnRJZCkgKyBwYXJhbXM7XG4gICAgbGV0IGNvbnRlbnRUeXBlO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG91ckZldGNoKHVybCwge21ldGhvZDogJ0dFVCd9KTtcblxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICB0aHJvdyByZXNwb25zZTtcbiAgICAgIH1cblxuICAgICAgY29udGVudFR5cGUgPSByZXNwb25zZS5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJyk7XG4gICAgICBsZXQgYmxvYjtcbiAgICAgIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgIXByb2Nlc3MuYnJvd3NlciAmJiB0eXBlb2YgcmVzcG9uc2UuYnVmZmVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGJsb2IgPSBhd2FpdCByZXNwb25zZS5idWZmZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIGJsb2IgPSBhd2FpdCByZXNwb25zZS5ibG9iKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRPRE86IGFsc28gcmVtb3ZlXG4gICAgICBpZiAodHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmICFwcm9jZXNzLmJyb3dzZXIpIHtcbiAgICAgICAgY29uc3QgdHlwZUZpZWxkRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoYmxvYi5fX3Byb3RvX18sICd0eXBlJyk7XG4gICAgICAgIGlmICghdHlwZUZpZWxkRGVzY3JpcHRvciB8fCB0eXBlRmllbGREZXNjcmlwdG9yLnNldCkge1xuICAgICAgICAgIGJsb2IudHlwZSA9IGNvbnRlbnRUeXBlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCBibG9iKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNhbGxiYWNrKGVycik7XG4gICAgfVxuICB9KTtcblxuICAvLyBSZW1vdmUgdGhlIGF0dGFjaG1lbnQgZ2l2ZW4gYnkgdGhlIGlkIGFuZCByZXZcbiAgYXBpLnJlbW92ZUF0dGFjaG1lbnQgPSAgYWRhcHRlckZ1bigncmVtb3ZlQXR0YWNobWVudCcsIGFzeW5jIGZ1bmN0aW9uIChcbiAgICBkb2NJZCxcbiAgICBhdHRhY2htZW50SWQsXG4gICAgcmV2LFxuICAgIGNhbGxiYWNrLFxuICApIHtcbiAgICBjb25zdCB1cmwgPSBnZW5EQlVybChob3N0LCBlbmNvZGVEb2NJZChkb2NJZCkgKyAnLycgKyBlbmNvZGVBdHRhY2htZW50SWQoYXR0YWNobWVudElkKSkgKyAnP3Jldj0nICsgcmV2O1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTih1cmwsIHttZXRob2Q6ICdERUxFVEUnfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEFkZCB0aGUgYXR0YWNobWVudCBnaXZlbiBieSBibG9iIGFuZCBpdHMgY29udGVudFR5cGUgcHJvcGVydHlcbiAgLy8gdG8gdGhlIGRvY3VtZW50IHdpdGggdGhlIGdpdmVuIGlkLCB0aGUgcmV2aXNpb24gZ2l2ZW4gYnkgcmV2LCBhbmRcbiAgLy8gYWRkIGl0IHRvIHRoZSBkYXRhYmFzZSBnaXZlbiBieSBob3N0LlxuICBhcGkucHV0QXR0YWNobWVudCA9IGFkYXB0ZXJGdW4oJ3B1dEF0dGFjaG1lbnQnLCBhc3luYyBmdW5jdGlvbiAoXG4gICAgZG9jSWQsXG4gICAgYXR0YWNobWVudElkLFxuICAgIHJldixcbiAgICBibG9iLFxuICAgIHR5cGUsXG4gICAgY2FsbGJhY2ssXG4gICkge1xuICAgIGlmICh0eXBlb2YgdHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSB0eXBlO1xuICAgICAgdHlwZSA9IGJsb2I7XG4gICAgICBibG9iID0gcmV2O1xuICAgICAgcmV2ID0gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgaWQgPSBlbmNvZGVEb2NJZChkb2NJZCkgKyAnLycgKyBlbmNvZGVBdHRhY2htZW50SWQoYXR0YWNobWVudElkKTtcbiAgICBsZXQgdXJsID0gZ2VuREJVcmwoaG9zdCwgaWQpO1xuICAgIGlmIChyZXYpIHtcbiAgICAgIHVybCArPSAnP3Jldj0nICsgcmV2O1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYmxvYiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIGlucHV0IGlzIGFzc3VtZWQgdG8gYmUgYSBiYXNlNjQgc3RyaW5nXG4gICAgICBsZXQgYmluYXJ5O1xuICAgICAgdHJ5IHtcbiAgICAgICAgYmluYXJ5ID0gYXRvYihibG9iKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICByZXR1cm4gY2FsbGJhY2soY3JlYXRlRXJyb3IoQkFEX0FSRyxcbiAgICAgICAgICAgICAgICAgICAgICAgICdBdHRhY2htZW50IGlzIG5vdCBhIHZhbGlkIGJhc2U2NCBzdHJpbmcnKSk7XG4gICAgICB9XG4gICAgICBibG9iID0gYmluYXJ5ID8gYmluU3RyaW5nVG9CdWZmZXIoYmluYXJ5LCB0eXBlKSA6ICcnO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBBZGQgdGhlIGF0dGFjaG1lbnRcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTih1cmwsIHtcbiAgICAgICAgaGVhZGVyczogbmV3IEhlYWRlcnMoeydDb250ZW50LVR5cGUnOiB0eXBlfSksXG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgIGJvZHk6IGJsb2JcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICAvLyBVcGRhdGUvY3JlYXRlIG11bHRpcGxlIGRvY3VtZW50cyBnaXZlbiBieSByZXEgaW4gdGhlIGRhdGFiYXNlXG4gIC8vIGdpdmVuIGJ5IGhvc3QuXG4gIGFwaS5fYnVsa0RvY3MgPSBhc3luYyBmdW5jdGlvbiAocmVxLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIC8vIElmIG5ld19lZGl0cz1mYWxzZSB0aGVuIGl0IHByZXZlbnRzIHRoZSBkYXRhYmFzZSBmcm9tIGNyZWF0aW5nXG4gICAgLy8gbmV3IHJldmlzaW9uIG51bWJlcnMgZm9yIHRoZSBkb2N1bWVudHMuIEluc3RlYWQgaXQganVzdCB1c2VzXG4gICAgLy8gdGhlIG9sZCBvbmVzLiBUaGlzIGlzIHVzZWQgaW4gZGF0YWJhc2UgcmVwbGljYXRpb24uXG4gICAgcmVxLm5ld19lZGl0cyA9IG9wdHMubmV3X2VkaXRzO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNldHVwKCk7XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChyZXEuZG9jcy5tYXAocHJlcHJvY2Vzc0F0dGFjaG1lbnRzKSk7XG5cbiAgICAgIC8vIFVwZGF0ZS9jcmVhdGUgdGhlIGRvY3VtZW50c1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2hKU09OKGdlbkRCVXJsKGhvc3QsICdfYnVsa19kb2NzJyksIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcSlcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIC8vIFVwZGF0ZS9jcmVhdGUgZG9jdW1lbnRcbiAgYXBpLl9wdXQgPSBhc3luYyBmdW5jdGlvbiAoZG9jLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBzZXR1cCgpO1xuICAgICAgYXdhaXQgcHJlcHJvY2Vzc0F0dGFjaG1lbnRzKGRvYyk7XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTihnZW5EQlVybChob3N0LCBlbmNvZGVEb2NJZChkb2MuX2lkKSksIHtcbiAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoZG9jKVxuICAgICAgfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGVycm9yLmRvY0lkID0gZG9jICYmIGRvYy5faWQ7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9O1xuXG5cbiAgLy8gR2V0IGEgbGlzdGluZyBvZiB0aGUgZG9jdW1lbnRzIGluIHRoZSBkYXRhYmFzZSBnaXZlblxuICAvLyBieSBob3N0IGFuZCBvcmRlcmVkIGJ5IGluY3JlYXNpbmcgaWQuXG4gIGFwaS5hbGxEb2NzID0gYWRhcHRlckZ1bignYWxsRG9jcycsIGFzeW5jIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBvcHRzID0gY2xvbmUob3B0cyk7XG5cbiAgICAvLyBMaXN0IG9mIHBhcmFtZXRlcnMgdG8gYWRkIHRvIHRoZSBHRVQgcmVxdWVzdFxuICAgIGNvbnN0IHBhcmFtcyA9IHt9O1xuICAgIGxldCBib2R5O1xuICAgIGxldCBtZXRob2QgPSAnR0VUJztcblxuICAgIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgICAgcGFyYW1zLmNvbmZsaWN0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKG9wdHMudXBkYXRlX3NlcSkge1xuICAgICAgcGFyYW1zLnVwZGF0ZV9zZXEgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAgIHBhcmFtcy5kZXNjZW5kaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5pbmNsdWRlX2RvY3MpIHtcbiAgICAgIHBhcmFtcy5pbmNsdWRlX2RvY3MgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIGFkZGVkIGluIENvdWNoREIgMS42LjBcbiAgICBpZiAob3B0cy5hdHRhY2htZW50cykge1xuICAgICAgcGFyYW1zLmF0dGFjaG1lbnRzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5rZXkpIHtcbiAgICAgIHBhcmFtcy5rZXkgPSBKU09OLnN0cmluZ2lmeShvcHRzLmtleSk7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuc3RhcnRfa2V5KSB7XG4gICAgICBvcHRzLnN0YXJ0a2V5ID0gb3B0cy5zdGFydF9rZXk7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuc3RhcnRrZXkpIHtcbiAgICAgIHBhcmFtcy5zdGFydGtleSA9IEpTT04uc3RyaW5naWZ5KG9wdHMuc3RhcnRrZXkpO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmVuZF9rZXkpIHtcbiAgICAgIG9wdHMuZW5ka2V5ID0gb3B0cy5lbmRfa2V5O1xuICAgIH1cblxuICAgIGlmIChvcHRzLmVuZGtleSkge1xuICAgICAgcGFyYW1zLmVuZGtleSA9IEpTT04uc3RyaW5naWZ5KG9wdHMuZW5ka2V5KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdHMuaW5jbHVzaXZlX2VuZCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHBhcmFtcy5pbmNsdXNpdmVfZW5kID0gISFvcHRzLmluY2x1c2l2ZV9lbmQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvcHRzLmxpbWl0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcGFyYW1zLmxpbWl0ID0gb3B0cy5saW1pdDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdHMuc2tpcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHBhcmFtcy5za2lwID0gb3B0cy5za2lwO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtU3RyID0gcGFyYW1zVG9TdHIocGFyYW1zKTtcblxuICAgIGlmICh0eXBlb2Ygb3B0cy5rZXlzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgbWV0aG9kID0gJ1BPU1QnO1xuICAgICAgYm9keSA9IHtrZXlzOiBvcHRzLmtleXN9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBmZXRjaEpTT04oZ2VuREJVcmwoaG9zdCwgJ19hbGxfZG9jcycgKyBwYXJhbVN0ciksIHtcbiAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gICAgICB9KTtcbiAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcyAmJiBvcHRzLmF0dGFjaG1lbnRzICYmIG9wdHMuYmluYXJ5KSB7XG4gICAgICAgIHJlc3VsdC5kYXRhLnJvd3MuZm9yRWFjaChyZWFkQXR0YWNobWVudHNBc0Jsb2JPckJ1ZmZlcik7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEdldCBhIGxpc3Qgb2YgY2hhbmdlcyBtYWRlIHRvIGRvY3VtZW50cyBpbiB0aGUgZGF0YWJhc2UgZ2l2ZW4gYnkgaG9zdC5cbiAgLy8gVE9ETyBBY2NvcmRpbmcgdG8gdGhlIFJFQURNRSwgdGhlcmUgc2hvdWxkIGJlIHR3byBvdGhlciBtZXRob2RzIGhlcmUsXG4gIC8vIGFwaS5jaGFuZ2VzLmFkZExpc3RlbmVyIGFuZCBhcGkuY2hhbmdlcy5yZW1vdmVMaXN0ZW5lci5cbiAgYXBpLl9jaGFuZ2VzID0gZnVuY3Rpb24gKG9wdHMpIHtcblxuICAgIC8vIFdlIGludGVybmFsbHkgcGFnZSB0aGUgcmVzdWx0cyBvZiBhIGNoYW5nZXMgcmVxdWVzdCwgdGhpcyBtZWFuc1xuICAgIC8vIGlmIHRoZXJlIGlzIGEgbGFyZ2Ugc2V0IG9mIGNoYW5nZXMgdG8gYmUgcmV0dXJuZWQgd2UgY2FuIHN0YXJ0XG4gICAgLy8gcHJvY2Vzc2luZyB0aGVtIHF1aWNrZXIgaW5zdGVhZCBvZiB3YWl0aW5nIG9uIHRoZSBlbnRpcmVcbiAgICAvLyBzZXQgb2YgY2hhbmdlcyB0byByZXR1cm4gYW5kIGF0dGVtcHRpbmcgdG8gcHJvY2VzcyB0aGVtIGF0IG9uY2VcbiAgICBjb25zdCBiYXRjaFNpemUgPSAnYmF0Y2hfc2l6ZScgaW4gb3B0cyA/IG9wdHMuYmF0Y2hfc2l6ZSA6IENIQU5HRVNfQkFUQ0hfU0laRTtcblxuICAgIG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICAgIGlmIChvcHRzLmNvbnRpbnVvdXMgJiYgISgnaGVhcnRiZWF0JyBpbiBvcHRzKSkge1xuICAgICAgb3B0cy5oZWFydGJlYXQgPSBERUZBVUxUX0hFQVJUQkVBVDtcbiAgICB9XG5cbiAgICBsZXQgcmVxdWVzdFRpbWVvdXQgPSAoJ3RpbWVvdXQnIGluIG9wdHMpID8gb3B0cy50aW1lb3V0IDogMzAgKiAxMDAwO1xuXG4gICAgLy8gZW5zdXJlIENIQU5HRVNfVElNRU9VVF9CVUZGRVIgYXBwbGllc1xuICAgIGlmICgndGltZW91dCcgaW4gb3B0cyAmJiBvcHRzLnRpbWVvdXQgJiZcbiAgICAgIChyZXF1ZXN0VGltZW91dCAtIG9wdHMudGltZW91dCkgPCBDSEFOR0VTX1RJTUVPVVRfQlVGRkVSKSB7XG4gICAgICAgIHJlcXVlc3RUaW1lb3V0ID0gb3B0cy50aW1lb3V0ICsgQ0hBTkdFU19USU1FT1VUX0JVRkZFUjtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoJ2hlYXJ0YmVhdCcgaW4gb3B0cyAmJiBvcHRzLmhlYXJ0YmVhdCAmJlxuICAgICAgIChyZXF1ZXN0VGltZW91dCAtIG9wdHMuaGVhcnRiZWF0KSA8IENIQU5HRVNfVElNRU9VVF9CVUZGRVIpIHtcbiAgICAgICAgcmVxdWVzdFRpbWVvdXQgPSBvcHRzLmhlYXJ0YmVhdCArIENIQU5HRVNfVElNRU9VVF9CVUZGRVI7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0ge307XG4gICAgaWYgKCd0aW1lb3V0JyBpbiBvcHRzICYmIG9wdHMudGltZW91dCkge1xuICAgICAgcGFyYW1zLnRpbWVvdXQgPSBvcHRzLnRpbWVvdXQ7XG4gICAgfVxuXG4gICAgY29uc3QgbGltaXQgPSAodHlwZW9mIG9wdHMubGltaXQgIT09ICd1bmRlZmluZWQnKSA/IG9wdHMubGltaXQgOiBmYWxzZTtcbiAgICBsZXQgbGVmdFRvRmV0Y2ggPSBsaW1pdDtcblxuICAgIGlmIChvcHRzLnN0eWxlKSB7XG4gICAgICBwYXJhbXMuc3R5bGUgPSBvcHRzLnN0eWxlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcyB8fCBvcHRzLmZpbHRlciAmJiB0eXBlb2Ygb3B0cy5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHBhcmFtcy5pbmNsdWRlX2RvY3MgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmF0dGFjaG1lbnRzKSB7XG4gICAgICBwYXJhbXMuYXR0YWNobWVudHMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmNvbnRpbnVvdXMpIHtcbiAgICAgIHBhcmFtcy5mZWVkID0gJ2xvbmdwb2xsJztcbiAgICB9XG5cbiAgICBpZiAob3B0cy5zZXFfaW50ZXJ2YWwpIHtcbiAgICAgIHBhcmFtcy5zZXFfaW50ZXJ2YWwgPSBvcHRzLnNlcV9pbnRlcnZhbDtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5jb25mbGljdHMpIHtcbiAgICAgIHBhcmFtcy5jb25mbGljdHMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAgIHBhcmFtcy5kZXNjZW5kaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAob3B0cy51cGRhdGVfc2VxKSB7XG4gICAgICBwYXJhbXMudXBkYXRlX3NlcSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCdoZWFydGJlYXQnIGluIG9wdHMpIHtcbiAgICAgIC8vIElmIHRoZSBoZWFydGJlYXQgdmFsdWUgaXMgZmFsc2UsIGl0IGRpc2FibGVzIHRoZSBkZWZhdWx0IGhlYXJ0YmVhdFxuICAgICAgaWYgKG9wdHMuaGVhcnRiZWF0KSB7XG4gICAgICAgIHBhcmFtcy5oZWFydGJlYXQgPSBvcHRzLmhlYXJ0YmVhdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3B0cy5maWx0ZXIgJiYgdHlwZW9mIG9wdHMuZmlsdGVyID09PSAnc3RyaW5nJykge1xuICAgICAgcGFyYW1zLmZpbHRlciA9IG9wdHMuZmlsdGVyO1xuICAgIH1cblxuICAgIGlmIChvcHRzLnZpZXcgJiYgdHlwZW9mIG9wdHMudmlldyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHBhcmFtcy5maWx0ZXIgPSAnX3ZpZXcnO1xuICAgICAgcGFyYW1zLnZpZXcgPSBvcHRzLnZpZXc7XG4gICAgfVxuXG4gICAgLy8gSWYgb3B0cy5xdWVyeV9wYXJhbXMgZXhpc3RzLCBwYXNzIGl0IHRocm91Z2ggdG8gdGhlIGNoYW5nZXMgcmVxdWVzdC5cbiAgICAvLyBUaGVzZSBwYXJhbWV0ZXJzIG1heSBiZSB1c2VkIGJ5IHRoZSBmaWx0ZXIgb24gdGhlIHNvdXJjZSBkYXRhYmFzZS5cbiAgICBpZiAob3B0cy5xdWVyeV9wYXJhbXMgJiYgdHlwZW9mIG9wdHMucXVlcnlfcGFyYW1zID09PSAnb2JqZWN0Jykge1xuICAgICAgZm9yIChjb25zdCBwYXJhbV9uYW1lIGluIG9wdHMucXVlcnlfcGFyYW1zKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob3B0cy5xdWVyeV9wYXJhbXMsIHBhcmFtX25hbWUpKSB7XG4gICAgICAgICAgcGFyYW1zW3BhcmFtX25hbWVdID0gb3B0cy5xdWVyeV9wYXJhbXNbcGFyYW1fbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgbWV0aG9kID0gJ0dFVCc7XG4gICAgbGV0IGJvZHk7XG5cbiAgICBpZiAob3B0cy5kb2NfaWRzKSB7XG4gICAgICAvLyBzZXQgdGhpcyBhdXRvbWFnaWNhbGx5IGZvciB0aGUgdXNlcjsgaXQncyBhbm5veWluZyB0aGF0IGNvdWNoZGJcbiAgICAgIC8vIHJlcXVpcmVzIGJvdGggYSBcImZpbHRlclwiIGFuZCBhIFwiZG9jX2lkc1wiIHBhcmFtLlxuICAgICAgcGFyYW1zLmZpbHRlciA9ICdfZG9jX2lkcyc7XG4gICAgICBtZXRob2QgPSAnUE9TVCc7XG4gICAgICBib2R5ID0ge2RvY19pZHM6IG9wdHMuZG9jX2lkcyB9O1xuICAgIH1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGVsc2UgaWYgKG9wdHMuc2VsZWN0b3IpIHtcbiAgICAgIC8vIHNldCB0aGlzIGF1dG9tYWdpY2FsbHkgZm9yIHRoZSB1c2VyLCBzaW1pbGFyIHRvIGFib3ZlXG4gICAgICBwYXJhbXMuZmlsdGVyID0gJ19zZWxlY3Rvcic7XG4gICAgICBtZXRob2QgPSAnUE9TVCc7XG4gICAgICBib2R5ID0ge3NlbGVjdG9yOiBvcHRzLnNlbGVjdG9yIH07XG4gICAgfVxuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBsZXQgbGFzdEZldGNoZWRTZXE7XG5cbiAgICAvLyBHZXQgYWxsIHRoZSBjaGFuZ2VzIHN0YXJ0aW5nIHd0aWggdGhlIG9uZSBpbW1lZGlhdGVseSBhZnRlciB0aGVcbiAgICAvLyBzZXF1ZW5jZSBudW1iZXIgZ2l2ZW4gYnkgc2luY2UuXG4gICAgY29uc3QgZmV0Y2hEYXRhID0gYXN5bmMgZnVuY3Rpb24gKHNpbmNlLCBjYWxsYmFjaykge1xuICAgICAgaWYgKG9wdHMuYWJvcnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBwYXJhbXMuc2luY2UgPSBzaW5jZTtcbiAgICAgIC8vIFwic2luY2VcIiBjYW4gYmUgYW55IGtpbmQgb2YganNvbiBvYmplY3QgaW4gQ2xvdWRhbnQvQ291Y2hEQiAyLnhcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBpZiAodHlwZW9mIHBhcmFtcy5zaW5jZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBwYXJhbXMuc2luY2UgPSBKU09OLnN0cmluZ2lmeShwYXJhbXMuc2luY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0cy5kZXNjZW5kaW5nKSB7XG4gICAgICAgIGlmIChsaW1pdCkge1xuICAgICAgICAgIHBhcmFtcy5saW1pdCA9IGxlZnRUb0ZldGNoO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJhbXMubGltaXQgPSAoIWxpbWl0IHx8IGxlZnRUb0ZldGNoID4gYmF0Y2hTaXplKSA/XG4gICAgICAgICAgYmF0Y2hTaXplIDogbGVmdFRvRmV0Y2g7XG4gICAgICB9XG5cbiAgICAgIC8vIFNldCB0aGUgb3B0aW9ucyBmb3IgdGhlIGFqYXggY2FsbFxuICAgICAgY29uc3QgdXJsID0gZ2VuREJVcmwoaG9zdCwgJ19jaGFuZ2VzJyArIHBhcmFtc1RvU3RyKHBhcmFtcykpO1xuICAgICAgY29uc3QgZmV0Y2hPcHRzID0ge1xuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgICAgIH07XG4gICAgICBsYXN0RmV0Y2hlZFNlcSA9IHNpbmNlO1xuXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChvcHRzLmFib3J0ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIGNoYW5nZXNcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNldHVwKCk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTih1cmwsIGZldGNoT3B0cyk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdC5kYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gSWYgb3B0cy5zaW5jZSBleGlzdHMsIGdldCBhbGwgdGhlIGNoYW5nZXMgZnJvbSB0aGUgc2VxdWVuY2VcbiAgICAvLyBudW1iZXIgZ2l2ZW4gYnkgb3B0cy5zaW5jZS4gT3RoZXJ3aXNlLCBnZXQgYWxsIHRoZSBjaGFuZ2VzXG4gICAgLy8gZnJvbSB0aGUgc2VxdWVuY2UgbnVtYmVyIDAuXG4gICAgY29uc3QgcmVzdWx0cyA9IHtyZXN1bHRzOiBbXX07XG5cbiAgICBjb25zdCBmZXRjaGVkID0gZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICBpZiAob3B0cy5hYm9ydGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGxldCByYXdfcmVzdWx0c19sZW5ndGggPSAwO1xuICAgICAgLy8gSWYgdGhlIHJlc3VsdCBvZiB0aGUgYWpheCBjYWxsIChyZXMpIGNvbnRhaW5zIGNoYW5nZXMgKHJlcy5yZXN1bHRzKVxuICAgICAgaWYgKHJlcyAmJiByZXMucmVzdWx0cykge1xuICAgICAgICByYXdfcmVzdWx0c19sZW5ndGggPSByZXMucmVzdWx0cy5sZW5ndGg7XG4gICAgICAgIHJlc3VsdHMubGFzdF9zZXEgPSByZXMubGFzdF9zZXE7XG4gICAgICAgIGxldCBwZW5kaW5nID0gbnVsbDtcbiAgICAgICAgbGV0IGxhc3RTZXEgPSBudWxsO1xuICAgICAgICAvLyBBdHRhY2ggJ3BlbmRpbmcnIHByb3BlcnR5IGlmIHNlcnZlciBzdXBwb3J0cyBpdCAoQ291Y2hEQiAyLjArKVxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKHR5cGVvZiByZXMucGVuZGluZyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBwZW5kaW5nID0gcmVzLnBlbmRpbmc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiByZXN1bHRzLmxhc3Rfc2VxID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgcmVzdWx0cy5sYXN0X3NlcSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBsYXN0U2VxID0gcmVzdWx0cy5sYXN0X3NlcTtcbiAgICAgICAgfVxuICAgICAgICAvLyBGb3IgZWFjaCBjaGFuZ2VcbiAgICAgICAgY29uc3QgcmVxID0ge307XG4gICAgICAgIHJlcS5xdWVyeSA9IG9wdHMucXVlcnlfcGFyYW1zO1xuICAgICAgICByZXMucmVzdWx0cyA9IHJlcy5yZXN1bHRzLmZpbHRlcihmdW5jdGlvbiAoYykge1xuICAgICAgICAgIGxlZnRUb0ZldGNoLS07XG4gICAgICAgICAgY29uc3QgcmV0ID0gZmlsdGVyQ2hhbmdlKG9wdHMpKGMpO1xuICAgICAgICAgIGlmIChyZXQpIHtcbiAgICAgICAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcyAmJiBvcHRzLmF0dGFjaG1lbnRzICYmIG9wdHMuYmluYXJ5KSB7XG4gICAgICAgICAgICAgIHJlYWRBdHRhY2htZW50c0FzQmxvYk9yQnVmZmVyKGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdHMucmV0dXJuX2RvY3MpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5yZXN1bHRzLnB1c2goYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvcHRzLm9uQ2hhbmdlKGMsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoZXJyKSB7XG4gICAgICAgIC8vIEluIGNhc2Ugb2YgYW4gZXJyb3IsIHN0b3AgbGlzdGVuaW5nIGZvciBjaGFuZ2VzIGFuZCBjYWxsXG4gICAgICAgIC8vIG9wdHMuY29tcGxldGVcbiAgICAgICAgb3B0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgICAgb3B0cy5jb21wbGV0ZShlcnIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBjaGFuZ2VzIGZlZWQgbWF5IGhhdmUgdGltZWQgb3V0IHdpdGggbm8gcmVzdWx0c1xuICAgICAgLy8gaWYgc28gcmV1c2UgbGFzdCB1cGRhdGUgc2VxdWVuY2VcbiAgICAgIGlmIChyZXMgJiYgcmVzLmxhc3Rfc2VxKSB7XG4gICAgICAgIGxhc3RGZXRjaGVkU2VxID0gcmVzLmxhc3Rfc2VxO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmaW5pc2hlZCA9IChsaW1pdCAmJiBsZWZ0VG9GZXRjaCA8PSAwKSB8fFxuICAgICAgICAocmVzICYmIHJhd19yZXN1bHRzX2xlbmd0aCA8IGJhdGNoU2l6ZSkgfHxcbiAgICAgICAgKG9wdHMuZGVzY2VuZGluZyk7XG5cbiAgICAgIGlmICgob3B0cy5jb250aW51b3VzICYmICEobGltaXQgJiYgbGVmdFRvRmV0Y2ggPD0gMCkpIHx8ICFmaW5pc2hlZCkge1xuICAgICAgICAvLyBRdWV1ZSBhIGNhbGwgdG8gZmV0Y2ggYWdhaW4gd2l0aCB0aGUgbmV3ZXN0IHNlcXVlbmNlIG51bWJlclxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7IGZldGNoRGF0YShsYXN0RmV0Y2hlZFNlcSwgZmV0Y2hlZCk7IH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2UncmUgZG9uZSwgY2FsbCB0aGUgY2FsbGJhY2tcbiAgICAgICAgb3B0cy5jb21wbGV0ZShudWxsLCByZXN1bHRzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZmV0Y2hEYXRhKG9wdHMuc2luY2UgfHwgMCwgZmV0Y2hlZCk7XG5cbiAgICAvLyBSZXR1cm4gYSBtZXRob2QgdG8gY2FuY2VsIHRoaXMgbWV0aG9kIGZyb20gcHJvY2Vzc2luZyBhbnkgbW9yZVxuICAgIHJldHVybiB7XG4gICAgICBjYW5jZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgb3B0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgfVxuICAgIH07XG4gIH07XG5cbiAgLy8gR2l2ZW4gYSBzZXQgb2YgZG9jdW1lbnQvcmV2aXNpb24gSURzIChnaXZlbiBieSByZXEpLCB0ZXRzIHRoZSBzdWJzZXQgb2ZcbiAgLy8gdGhvc2UgdGhhdCBkbyBOT1QgY29ycmVzcG9uZCB0byByZXZpc2lvbnMgc3RvcmVkIGluIHRoZSBkYXRhYmFzZS5cbiAgLy8gU2VlIGh0dHA6Ly93aWtpLmFwYWNoZS5vcmcvY291Y2hkYi9IdHRwUG9zdFJldnNEaWZmXG4gIGFwaS5yZXZzRGlmZiA9IGFkYXB0ZXJGdW4oJ3JldnNEaWZmJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAvLyBJZiBubyBvcHRpb25zIHdlcmUgZ2l2ZW4sIHNldCB0aGUgY2FsbGJhY2sgdG8gYmUgdGhlIHNlY29uZCBwYXJhbWV0ZXJcbiAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gR2V0IHRoZSBtaXNzaW5nIGRvY3VtZW50L3JldmlzaW9uIElEc1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2hKU09OKGdlbkRCVXJsKGhvc3QsICdfcmV2c19kaWZmJyksIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcSlcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBhcGkuX2Nsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2soKTtcbiAgfTtcblxuICBhcGkuX2Rlc3Ryb3kgPSBhc3luYyBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QganNvbiA9IGF3YWl0IGZldGNoSlNPTihnZW5EQlVybChob3N0LCAnJyksIHttZXRob2Q6ICdERUxFVEUnfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCBqc29uKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtvazogdHJ1ZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuLy8gSHR0cFBvdWNoIGlzIGEgdmFsaWQgYWRhcHRlci5cbkh0dHBQb3VjaC52YWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUG91Y2hEQikge1xuICBQb3VjaERCLmFkYXB0ZXIoJ2h0dHAnLCBIdHRwUG91Y2gsIGZhbHNlKTtcbiAgUG91Y2hEQi5hZGFwdGVyKCdodHRwcycsIEh0dHBQb3VjaCwgZmFsc2UpO1xufVxuIl0sIm5hbWVzIjpbImI2NFN0cmluZ1RvQnVmZmVyIiwiYmx1ZmZlclRvQmFzZTY0IiwiYWRhcHRlckZ1biIsImNvcmVBZGFwdGVyRnVuIiwibmV4dFRpY2siLCJidWxrR2V0U2hpbSIsImJpblN0cmluZ1RvQnVmZmVyIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxLQUFLLEVBQUU7QUFDdkMsRUFBRSxPQUFPLElBQUksT0FBTyxDQUFDLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUNoRCxJQUFJLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztBQUNwQixJQUFJLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztBQUNwQixJQUFJLElBQUksSUFBSSxHQUFHLENBQUMsQ0FBQztBQUNqQixJQUFJLElBQUksR0FBRyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sQ0FBQztBQUN0QyxJQUFJLElBQUksR0FBRyxDQUFDO0FBQ1o7QUFDQSxJQUFJLFNBQVMsT0FBTyxHQUFHO0FBQ3ZCLE1BQU0sT0FBTyxFQUFFLENBQUM7QUFDaEIsTUFBTSxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUM3RCxLQUFLO0FBQ0w7QUFDQSxJQUFJLFNBQVMsTUFBTSxHQUFHO0FBQ3RCLE1BQU0sSUFBSSxFQUFFLElBQUksS0FBSyxHQUFHLEVBQUU7QUFDMUI7QUFDQSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQ2pCLFVBQVUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3RCLFNBQVMsTUFBTTtBQUNmLFVBQVUsT0FBTyxFQUFFLENBQUM7QUFDcEIsU0FBUztBQUNULE9BQU8sTUFBTTtBQUNiLFFBQVEsWUFBWSxFQUFFLENBQUM7QUFDdkIsT0FBTztBQUNQLEtBQUs7QUFDTDtBQUNBLElBQUksU0FBUyxTQUFTLEdBQUc7QUFDekIsTUFBTSxPQUFPLEVBQUUsQ0FBQztBQUNoQixNQUFNLE1BQU0sRUFBRSxDQUFDO0FBQ2YsS0FBSztBQUNMO0FBQ0E7QUFDQSxJQUFJLFNBQVMsT0FBTyxDQUFDLE9BQU8sRUFBRTtBQUM5QixNQUFNLE9BQU8sRUFBRSxDQUFDO0FBQ2hCLE1BQU0sR0FBRyxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUM7QUFDM0IsTUFBTSxNQUFNLEVBQUUsQ0FBQztBQUNmLEtBQUs7QUFDTDtBQUNBLElBQUksU0FBUyxZQUFZLEdBQUc7QUFDNUIsTUFBTSxPQUFPLE9BQU8sR0FBRyxLQUFLLElBQUksT0FBTyxHQUFHLEdBQUcsRUFBRTtBQUMvQyxRQUFRLE9BQU8sRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUCxLQUFLO0FBQ0w7QUFDQSxJQUFJLFlBQVksRUFBRSxDQUFDO0FBQ25CLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7O0FDbERBO0FBQ0E7QUE0QkE7QUFDQSxNQUFNLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztBQUM5QixNQUFNLHFCQUFxQixHQUFHLEVBQUUsQ0FBQztBQUNqQyxNQUFNLHNCQUFzQixHQUFHLElBQUksQ0FBQztBQUNwQyxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQUNoQztBQUNBLE1BQU0sa0JBQWtCLEdBQUcsRUFBRSxDQUFDO0FBQzlCO0FBQ0EsU0FBUyw2QkFBNkIsQ0FBQyxHQUFHLEVBQUU7QUFDNUMsRUFBRSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFDaEMsRUFBRSxNQUFNLElBQUksR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQztBQUN2QyxFQUFFLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDYixJQUFJLE9BQU87QUFDWCxHQUFHO0FBQ0gsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLFFBQVEsRUFBRTtBQUNoRCxJQUFJLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMvQixJQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUdBLFlBQWlCLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDN0QsR0FBRyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLFdBQVcsQ0FBQyxFQUFFLEVBQUU7QUFDekIsRUFBRSxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUU7QUFDM0IsSUFBSSxPQUFPLFVBQVUsR0FBRyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEQsR0FBRztBQUNILEVBQUUsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxFQUFFO0FBQ2hDLElBQUksT0FBTyxTQUFTLEdBQUcsa0JBQWtCLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELEdBQUc7QUFDSCxFQUFFLE9BQU8sa0JBQWtCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUNEO0FBQ0EsU0FBUyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUU7QUFDcEMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFO0FBQzNELElBQUksT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDN0IsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3RFLElBQUksTUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QyxJQUFJLElBQUksVUFBVSxDQUFDLElBQUksSUFBSSxPQUFPLFVBQVUsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO0FBQ2hFLE1BQU0sT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFVLE9BQU8sRUFBRTtBQUM1QyxRQUFRQyxZQUFlLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNsRCxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDN0IsUUFBUSxVQUFVLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztBQUM5QixPQUFPLENBQUMsQ0FBQztBQUNULEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ04sQ0FBQztBQUNEO0FBQ0EsU0FBUyxZQUFZLENBQUMsSUFBSSxFQUFFO0FBQzVCLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDcEIsSUFBSSxPQUFPLEtBQUssQ0FBQztBQUNqQixHQUFHO0FBQ0gsRUFBRSxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNsRCxFQUFFLE9BQU8sUUFBUSxLQUFLLE1BQU0sSUFBSSxRQUFRLEtBQUssT0FBTyxDQUFDO0FBQ3JELENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQzdCO0FBQ0EsRUFBRSxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUMxQixJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDeEQ7QUFDQSxJQUFJLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNwRCxJQUFJLElBQUksR0FBRyxNQUFNLEdBQUcsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDL0MsR0FBRztBQUNIO0FBQ0EsRUFBRSxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0IsRUFBRSxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRTtBQUNoQyxJQUFJLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzVELEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQSxFQUFFLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUQ7QUFDQSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ3ZCO0FBQ0EsRUFBRSxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ2xDLElBQUksR0FBRyxDQUFDLEVBQUUsR0FBRyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDeEMsR0FBRztBQUNIO0FBQ0EsRUFBRSxHQUFHLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDN0I7QUFDQSxFQUFFLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUNEO0FBQ0E7QUFDQSxTQUFTLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFO0FBQzlCLEVBQUUsT0FBTyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0FBQzdELENBQUM7QUFDRDtBQUNBLFNBQVMsV0FBVyxDQUFDLE1BQU0sRUFBRTtBQUM3QixFQUFFLE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDeEMsRUFBRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzlCLElBQUksT0FBTyxFQUFFLENBQUM7QUFDZCxHQUFHO0FBQ0g7QUFDQSxFQUFFLE9BQU8sR0FBRyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsR0FBRyxHQUFHLEdBQUcsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDM0YsQ0FBQztBQUNEO0FBQ0EsU0FBUyxlQUFlLENBQUMsSUFBSSxFQUFFO0FBQy9CLEVBQUUsTUFBTSxFQUFFLEdBQUcsQ0FBQyxPQUFPLFNBQVMsS0FBSyxXQUFXLElBQUksU0FBUyxDQUFDLFNBQVM7QUFDckUsTUFBTSxTQUFTLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUM3QyxFQUFFLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDekMsRUFBRSxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ2pELEVBQUUsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUMzQyxFQUFFLE1BQU0sS0FBSyxHQUFHLEVBQUUsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssS0FBSyxDQUFDO0FBQzdELEVBQUUsT0FBTyxDQUFDLElBQUksSUFBSSxTQUFTLElBQUksTUFBTSxLQUFLLEtBQUssQ0FBQztBQUNoRCxDQUFDO0FBQ0Q7QUFDQTtBQUNBLFNBQVMsU0FBUyxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDbkM7QUFDQTtBQUNBLEVBQUUsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ25CO0FBQ0EsRUFBRSxNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN4QyxFQUFFLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDbkM7QUFDQSxFQUFFLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckI7QUFDQSxFQUFFLE1BQU0sUUFBUSxHQUFHLGdCQUFnQixHQUFHLEVBQUUsT0FBTyxFQUFFO0FBQ2pEO0FBQ0EsSUFBSSxPQUFPLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQztBQUM1QixJQUFJLE9BQU8sQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sSUFBSSxJQUFJLE9BQU8sRUFBRSxDQUFDO0FBQ3ZEO0FBQ0EsSUFBSSxPQUFPLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQztBQUNwQztBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDaEMsTUFBTSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDM0MsTUFBTSxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsUUFBUSxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO0FBQ3hELE1BQU0sTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUQsTUFBTSxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQzdELEtBQUs7QUFDTDtBQUNBLElBQUksTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7QUFDdkMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUNoRCxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoRCxLQUFLLENBQUMsQ0FBQztBQUNQO0FBQ0E7QUFDQSxJQUFJLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0FBQ2xDLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDNUUsS0FBSztBQUNMO0FBQ0EsSUFBSSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQztBQUN6QyxJQUFJLE9BQU8sTUFBTSxRQUFRLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ3hDLEdBQUcsQ0FBQztBQUNKO0FBQ0EsRUFBRSxTQUFTQyxZQUFVLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRTtBQUNqQyxJQUFJLE9BQU9DLFVBQWMsQ0FBQyxJQUFJLEVBQUUsVUFBVSxHQUFHLElBQUksRUFBRTtBQUNuRCxNQUFNLEtBQUssRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZO0FBQy9CLFFBQVEsT0FBTyxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNyQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFDNUIsUUFBUSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7QUFDcEMsUUFBUSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakIsR0FBRztBQUNIO0FBQ0EsRUFBRSxlQUFlLFNBQVMsQ0FBQyxHQUFHLEVBQUUsT0FBTyxFQUFFO0FBQ3pDO0FBQ0EsSUFBSSxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDdEI7QUFDQSxJQUFJLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO0FBQzVCLElBQUksT0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsT0FBTyxJQUFJLElBQUksT0FBTyxFQUFFLENBQUM7QUFDdkQ7QUFDQSxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFjLENBQUMsRUFBRTtBQUM5QyxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0FBQzlELEtBQUs7QUFDTCxJQUFJLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUN4QyxNQUFNLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO0FBQ3hELEtBQUs7QUFDTDtBQUNBLElBQUksTUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQ2xELElBQUksTUFBTSxDQUFDLEVBQUUsR0FBRyxRQUFRLENBQUMsRUFBRSxDQUFDO0FBQzVCLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDO0FBQ3BDLElBQUksTUFBTSxJQUFJLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDdkM7QUFDQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3ZCLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUU7QUFDcEIsTUFBTSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ3pDLE1BQU0sTUFBTSxHQUFHLEdBQUcseUJBQXlCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3pELE1BQU0sTUFBTSxHQUFHLENBQUM7QUFDaEIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ3BDLE1BQU0sTUFBTSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRTtBQUNqRCxRQUFRLElBQUksQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFO0FBQ2xDLFVBQVUsT0FBTyx5QkFBeUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxTQUFTLE1BQU07QUFDZixVQUFVLE9BQU8sQ0FBQyxDQUFDO0FBQ25CLFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUs7QUFDTDtBQUNBLElBQUksT0FBTyxNQUFNLENBQUM7QUFDbEIsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLFlBQVksQ0FBQztBQUNuQjtBQUNBLEVBQUUsZUFBZSxLQUFLLEdBQUc7QUFDekIsSUFBSSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDekIsTUFBTSxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUMvQixLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLElBQUksWUFBWSxFQUFFO0FBQ3RCLE1BQU0sT0FBTyxZQUFZLENBQUM7QUFDMUIsS0FBSztBQUNMO0FBQ0EsSUFBSSxZQUFZLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUN6RCxNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxHQUFHLEVBQUU7QUFDbkQ7QUFDQSxRQUFRLFlBQVksQ0FBQyxHQUFHLEVBQUUsaURBQWlELENBQUMsQ0FBQztBQUM3RSxRQUFRLE9BQU8sU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ2pELE9BQU8sTUFBTTtBQUNiLFFBQVEsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ25DLE9BQU87QUFDUCxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDNUI7QUFDQTtBQUNBO0FBQ0EsTUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssR0FBRyxFQUFFO0FBQ25ELFFBQVEsT0FBTyxJQUFJLENBQUM7QUFDcEIsT0FBTztBQUNQLE1BQU0sT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLEtBQUssQ0FBQyxDQUFDO0FBQ1A7QUFDQSxJQUFJLFlBQVksQ0FBQyxLQUFLLENBQUMsWUFBWTtBQUNuQyxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsS0FBSyxDQUFDLENBQUM7QUFDUDtBQUNBLElBQUksT0FBTyxZQUFZLENBQUM7QUFDeEIsR0FBRztBQUNIO0FBQ0EsRUFBRUMsU0FBUSxDQUFDLFlBQVk7QUFDdkIsSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQSxFQUFFLEdBQUcsQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQ3JCO0FBQ0E7QUFDQSxFQUFFLEdBQUcsQ0FBQyxJQUFJLEdBQUcsWUFBWTtBQUN6QixJQUFJLE9BQU8sTUFBTSxDQUFDO0FBQ2xCLEdBQUcsQ0FBQztBQUNKO0FBQ0EsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHRixZQUFVLENBQUMsSUFBSSxFQUFFLGdCQUFnQixRQUFRLEVBQUU7QUFDdEQsSUFBSSxJQUFJLE1BQU0sQ0FBQztBQUNmLElBQUksSUFBSTtBQUNSLE1BQU0sTUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNyRCxNQUFNLE1BQU0sR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNyQyxLQUFLLENBQUMsT0FBTyxHQUFHLEVBQUU7QUFDbEIsTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEVBQUUsSUFBSSxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ3hGLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN6QixHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLE9BQU8sR0FBR0EsWUFBVSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUN0RSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQztBQUN0QixNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsS0FBSztBQUNMLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN2QjtBQUNBLElBQUksTUFBTSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ2xFO0FBQ0EsSUFBSSxTQUFTLElBQUksR0FBRztBQUNwQixNQUFNLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQ25DO0FBQ0E7QUFDQTtBQUNBLFFBQVEsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsZUFBZSxFQUFFO0FBQ3pDLFVBQVUsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3JDLFNBQVMsTUFBTTtBQUNmLFVBQVUsVUFBVSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQyxDQUFDO0FBQ2pELFNBQVM7QUFDVCxPQUFPLENBQUMsQ0FBQztBQUNULEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxFQUFFLENBQUM7QUFDWCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxHQUFHLENBQUMsT0FBTyxHQUFHQyxVQUFjLENBQUMsU0FBUyxFQUFFLFVBQVUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUNwRSxJQUFJLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztBQUN0QjtBQUNBLElBQUksZUFBZSxTQUFTLENBQUMsRUFBRSxFQUFFO0FBQ2pDLE1BQU0sTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3hCLE1BQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO0FBQ3JCLFFBQVEsTUFBTSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDM0IsT0FBTztBQUNQLE1BQU0sSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQzVCO0FBQ0EsUUFBUSxNQUFNLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztBQUNsQyxPQUFPO0FBQ1AsTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDdkIsUUFBUSxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztBQUM3QixPQUFPO0FBQ1AsTUFBTSxJQUFJO0FBQ1YsUUFBUSxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRTtBQUMxRixVQUFVLE1BQU0sRUFBRSxNQUFNO0FBQ3hCLFVBQVUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xELFNBQVMsQ0FBQyxDQUFDO0FBQ1g7QUFDQSxRQUFRLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQzdDLFVBQVUsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3JELFlBQVksR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsNkJBQTZCLENBQUMsQ0FBQztBQUM1RCxXQUFXLENBQUMsQ0FBQztBQUNiLFNBQVM7QUFDVCxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlCLE9BQU8sQ0FBQyxPQUFPLEtBQUssRUFBRTtBQUN0QixRQUFRLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNsQixPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0E7QUFDQSxJQUFJLFNBQVMsYUFBYSxHQUFHO0FBQzdCO0FBQ0EsTUFBTSxNQUFNLFNBQVMsR0FBRyxxQkFBcUIsQ0FBQztBQUM5QyxNQUFNLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLENBQUM7QUFDakUsTUFBTSxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDdEIsTUFBTSxNQUFNLE9BQU8sR0FBRyxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUM1QztBQUNBLE1BQU0sU0FBUyxRQUFRLENBQUMsUUFBUSxFQUFFO0FBQ2xDLFFBQVEsT0FBTyxVQUFVLEdBQUcsRUFBRSxHQUFHLEVBQUU7QUFDbkM7QUFDQSxVQUFVLE9BQU8sQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQzFDLFVBQVUsSUFBSSxFQUFFLE9BQU8sS0FBSyxVQUFVLEVBQUU7QUFDeEMsWUFBWSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDeEQsV0FBVztBQUNYLFNBQVMsQ0FBQztBQUNWLE9BQU87QUFDUDtBQUNBLE1BQU0sS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFVBQVUsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUMzQyxRQUFRLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsYUFBYSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ2hGLFFBQVEsT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsU0FBUztBQUNwRCxVQUFVLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDM0QsUUFBUUUsT0FBVyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEQsT0FBTztBQUNQLEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxJQUFJLE1BQU0sZUFBZSxHQUFHLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3REO0FBQ0E7QUFDQSxJQUFJLElBQUksT0FBTyxlQUFlLEtBQUssU0FBUyxFQUFFO0FBQzlDO0FBQ0EsTUFBTSxTQUFTLENBQUMsVUFBVSxHQUFHLEVBQUUsR0FBRyxFQUFFO0FBQ3BDLFFBQVEsSUFBSSxHQUFHLEVBQUU7QUFDakIsVUFBVSxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDNUMsVUFBVSxZQUFZO0FBQ3RCLFlBQVksR0FBRyxDQUFDLE1BQU07QUFDdEIsWUFBWSwwQ0FBMEM7QUFDdEQsWUFBWSw2QkFBNkI7QUFDekMsV0FBVyxDQUFDO0FBQ1osVUFBVSxhQUFhLEVBQUUsQ0FBQztBQUMxQixTQUFTLE1BQU07QUFDZixVQUFVLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQztBQUMzQyxVQUFVLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDOUIsU0FBUztBQUNULE9BQU8sQ0FBQyxDQUFDO0FBQ1QsS0FBSyxNQUFNLElBQUksZUFBZSxFQUFFO0FBQ2hDLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLEtBQUssTUFBTTtBQUNYLE1BQU0sYUFBYSxFQUFFLENBQUM7QUFDdEIsS0FBSztBQUNMLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFLEdBQUcsQ0FBQyxLQUFLLEdBQUcsZ0JBQWdCLFFBQVEsRUFBRTtBQUN4QyxJQUFJLElBQUk7QUFDUixNQUFNLE1BQU0sS0FBSyxFQUFFLENBQUM7QUFDcEIsTUFBTSxNQUFNLFFBQVEsR0FBRyxNQUFNLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDMUQsTUFBTSxNQUFNLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUN6QyxNQUFNLElBQUksQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNyQyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsS0FBSyxDQUFDLE9BQU8sR0FBRyxFQUFFO0FBQ2xCLE1BQU0sUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3BCLEtBQUs7QUFDTCxHQUFHLENBQUM7QUFDSjtBQUNBLEVBQUUsR0FBRyxDQUFDLEtBQUssR0FBRyxnQkFBZ0IsSUFBSSxFQUFFLE9BQU8sRUFBRTtBQUM3QyxJQUFJLE1BQU0sS0FBSyxFQUFFLENBQUM7QUFDbEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxHQUFHO0FBQzVDLElBQUksSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM3QyxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDekIsSUFBSSxPQUFPLFFBQVEsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDbEMsR0FBRyxDQUFDO0FBQ0o7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFLEdBQUcsQ0FBQyxHQUFHLEdBQUdILFlBQVUsQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQ2xFO0FBQ0EsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUNwQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2hCLEtBQUs7QUFDTCxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkI7QUFDQTtBQUNBLElBQUksTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3RCO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDbkIsTUFBTSxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUN6QixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtBQUN4QixNQUFNLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQzlCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ3JCLE1BQU0sTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7QUFDM0IsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDeEIsTUFBTSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxFQUFFO0FBQ3BDLFFBQVEsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUN4RCxPQUFPO0FBQ1AsTUFBTSxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDeEMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7QUFDbEIsTUFBTSxNQUFNLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDNUIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDeEIsTUFBTSxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDeEMsS0FBSztBQUNMO0FBQ0E7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUN6QixNQUFNLE1BQU0sQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUMxQyxLQUFLO0FBQ0w7QUFDQSxJQUFJLEVBQUUsR0FBRyxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDekI7QUFDQSxJQUFJLFNBQVMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFO0FBQ25DLE1BQU0sTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQztBQUNwQyxNQUFNLE1BQU0sU0FBUyxHQUFHLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xELE1BQU0sSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUU7QUFDdEMsUUFBUSxPQUFPO0FBQ2YsT0FBTztBQUNQO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTSxlQUFlLFNBQVMsQ0FBQyxRQUFRLEVBQUU7QUFDekMsUUFBUSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDbkMsUUFBUSxNQUFNLElBQUksR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxRQUFRLENBQUM7QUFDOUUsWUFBWSxPQUFPLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztBQUMvQjtBQUNBLFFBQVEsTUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzlEO0FBQ0EsUUFBUSxJQUFJLElBQUksQ0FBQztBQUNqQixRQUFRLElBQUksUUFBUSxJQUFJLFFBQVEsRUFBRTtBQUNsQyxVQUFVLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUN6QyxTQUFTLE1BQU07QUFDZjtBQUNBLFVBQVUsSUFBSSxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3ZDLFNBQVM7QUFDVDtBQUNBLFFBQVEsSUFBSSxJQUFJLENBQUM7QUFDakIsUUFBUSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDekIsVUFBVSxNQUFNLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzlGLFVBQVUsSUFBSSxDQUFDLG1CQUFtQixJQUFJLG1CQUFtQixDQUFDLEdBQUcsRUFBRTtBQUMvRCxZQUFZLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLFlBQVksQ0FBQztBQUN6QyxXQUFXO0FBQ1gsVUFBVSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLFNBQVMsTUFBTTtBQUNmLFVBQVUsSUFBSSxHQUFHLE1BQU0sSUFBSSxPQUFPLENBQUMsVUFBVSxPQUFPLEVBQUU7QUFDdEQsWUFBWUQsWUFBZSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMzQyxXQUFXLENBQUMsQ0FBQztBQUNiLFNBQVM7QUFDVDtBQUNBLFFBQVEsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDO0FBQzFCLFFBQVEsR0FBRyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDeEIsT0FBTztBQUNQO0FBQ0EsTUFBTSxNQUFNLGdCQUFnQixHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxRQUFRLEVBQUU7QUFDakUsUUFBUSxPQUFPLFlBQVk7QUFDM0IsVUFBVSxPQUFPLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNyQyxTQUFTLENBQUM7QUFDVixPQUFPLENBQUMsQ0FBQztBQUNUO0FBQ0E7QUFDQTtBQUNBLE1BQU0sT0FBTyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdkMsS0FBSztBQUNMO0FBQ0EsSUFBSSxTQUFTLG1CQUFtQixDQUFDLFNBQVMsRUFBRTtBQUM1QyxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRTtBQUNwQyxRQUFRLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxFQUFFO0FBQ3hELFVBQVUsSUFBSSxHQUFHLENBQUMsRUFBRSxFQUFFO0FBQ3RCLFlBQVksT0FBTyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUMsV0FBVztBQUNYLFNBQVMsQ0FBQyxDQUFDLENBQUM7QUFDWixPQUFPO0FBQ1AsTUFBTSxPQUFPLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3pDLEtBQUs7QUFDTDtBQUNBLElBQUksTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDekQsSUFBSSxJQUFJO0FBQ1IsTUFBTSxNQUFNLEdBQUcsR0FBRyxNQUFNLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QyxNQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUM1QixRQUFRLE1BQU0sbUJBQW1CLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzVDLE9BQU87QUFDUCxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLEtBQUssQ0FBQyxPQUFPLEtBQUssRUFBRTtBQUNwQixNQUFNLEtBQUssQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQ3ZCLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLE1BQU0sR0FBR0MsWUFBVSxDQUFDLFFBQVEsRUFBRSxnQkFBZ0IsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFO0FBQ2xGLElBQUksSUFBSSxHQUFHLENBQUM7QUFDWixJQUFJLElBQUksT0FBTyxTQUFTLEtBQUssUUFBUSxFQUFFO0FBQ3ZDO0FBQ0EsTUFBTSxHQUFHLEdBQUc7QUFDWixRQUFRLEdBQUcsRUFBRSxPQUFPO0FBQ3BCLFFBQVEsSUFBSSxFQUFFLFNBQVM7QUFDdkIsT0FBTyxDQUFDO0FBQ1IsTUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUN0QyxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUM7QUFDbEIsUUFBUSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2xCLE9BQU87QUFDUCxLQUFLLE1BQU07QUFDWDtBQUNBLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQztBQUNwQixNQUFNLElBQUksT0FBTyxTQUFTLEtBQUssVUFBVSxFQUFFO0FBQzNDLFFBQVEsRUFBRSxHQUFHLFNBQVMsQ0FBQztBQUN2QixRQUFRLElBQUksR0FBRyxFQUFFLENBQUM7QUFDbEIsT0FBTyxNQUFNO0FBQ2IsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLFFBQVEsSUFBSSxHQUFHLFNBQVMsQ0FBQztBQUN6QixPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2QyxJQUFJLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sR0FBRyxHQUFHLENBQUM7QUFDckU7QUFDQSxJQUFJLElBQUk7QUFDUixNQUFNLE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzlELE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDNUIsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2hCLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxTQUFTLGtCQUFrQixDQUFDLFlBQVksRUFBRTtBQUM1QyxJQUFJLE9BQU8sWUFBWSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDckUsR0FBRztBQUNIO0FBQ0E7QUFDQSxFQUFFLEdBQUcsQ0FBQyxhQUFhLEdBQUdBLFlBQVUsQ0FBQyxlQUFlLEVBQUUsZ0JBQWdCLEtBQUssRUFBRSxZQUFZO0FBQ3JGLDREQUE0RCxJQUFJLEVBQUUsUUFBUSxFQUFFO0FBQzVFLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7QUFDcEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQztBQUNoQixLQUFLO0FBQ0wsSUFBSSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQztBQUN4RCxJQUFJLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsR0FBRztBQUN4RCxRQUFRLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUNsRCxJQUFJLElBQUksV0FBVyxDQUFDO0FBQ3BCLElBQUksSUFBSTtBQUNSLE1BQU0sTUFBTSxRQUFRLEdBQUcsTUFBTSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDNUQ7QUFDQSxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFO0FBQ3hCLFFBQVEsTUFBTSxRQUFRLENBQUM7QUFDdkIsT0FBTztBQUNQO0FBQ0EsTUFBTSxXQUFXLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7QUFDekQsTUFBTSxJQUFJLElBQUksQ0FBQztBQUNmLE1BQU0sSUFBSSxPQUFPLE9BQU8sS0FBSyxXQUFXLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLE9BQU8sUUFBUSxDQUFDLE1BQU0sS0FBSyxVQUFVLEVBQUU7QUFDdkcsUUFBUSxJQUFJLEdBQUcsTUFBTSxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDdkMsT0FBTyxNQUFNO0FBQ2I7QUFDQSxRQUFRLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNyQyxPQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQU0sSUFBSSxPQUFPLE9BQU8sS0FBSyxXQUFXLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFO0FBQzlELFFBQVEsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUM1RixRQUFRLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxtQkFBbUIsQ0FBQyxHQUFHLEVBQUU7QUFDN0QsVUFBVSxJQUFJLENBQUMsSUFBSSxHQUFHLFdBQVcsQ0FBQztBQUNsQyxTQUFTO0FBQ1QsT0FBTztBQUNQLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUMzQixLQUFLLENBQUMsT0FBTyxHQUFHLEVBQUU7QUFDbEIsTUFBTSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDcEIsS0FBSztBQUNMLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLGdCQUFnQixJQUFJQSxZQUFVLENBQUMsa0JBQWtCLEVBQUU7QUFDekQsSUFBSSxLQUFLO0FBQ1QsSUFBSSxZQUFZO0FBQ2hCLElBQUksR0FBRztBQUNQLElBQUksUUFBUTtBQUNaLElBQUk7QUFDSixJQUFJLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLE9BQU8sR0FBRyxHQUFHLENBQUM7QUFDNUc7QUFDQSxJQUFJLElBQUk7QUFDUixNQUFNLE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzlELE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxHQUFHLENBQUMsYUFBYSxHQUFHQSxZQUFVLENBQUMsZUFBZSxFQUFFO0FBQ2xELElBQUksS0FBSztBQUNULElBQUksWUFBWTtBQUNoQixJQUFJLEdBQUc7QUFDUCxJQUFJLElBQUk7QUFDUixJQUFJLElBQUk7QUFDUixJQUFJLFFBQVE7QUFDWixJQUFJO0FBQ0osSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtBQUNwQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQztBQUNqQixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUM7QUFDakIsS0FBSztBQUNMLElBQUksTUFBTSxFQUFFLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUMzRSxJQUFJLElBQUksR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDakMsSUFBSSxJQUFJLEdBQUcsRUFBRTtBQUNiLE1BQU0sR0FBRyxJQUFJLE9BQU8sR0FBRyxHQUFHLENBQUM7QUFDM0IsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtBQUNsQztBQUNBLE1BQU0sSUFBSSxNQUFNLENBQUM7QUFDakIsTUFBTSxJQUFJO0FBQ1YsUUFBUSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzVCLE9BQU8sQ0FBQyxPQUFPLEdBQUcsRUFBRTtBQUNwQixRQUFRLE9BQU8sUUFBUSxDQUFDLFdBQVcsQ0FBQyxPQUFPO0FBQzNDLHdCQUF3Qix5Q0FBeUMsQ0FBQyxDQUFDLENBQUM7QUFDcEUsT0FBTztBQUNQLE1BQU0sSUFBSSxHQUFHLE1BQU0sR0FBR0ksa0JBQWlCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUMzRCxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUk7QUFDUjtBQUNBLE1BQU0sTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsR0FBRyxFQUFFO0FBQzFDLFFBQVEsT0FBTyxFQUFFLElBQUksT0FBTyxDQUFDLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3BELFFBQVEsTUFBTSxFQUFFLEtBQUs7QUFDckIsUUFBUSxJQUFJLEVBQUUsSUFBSTtBQUNsQixPQUFPLENBQUMsQ0FBQztBQUNULE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLFNBQVMsR0FBRyxnQkFBZ0IsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDdkQ7QUFDQTtBQUNBO0FBQ0EsSUFBSSxHQUFHLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDbkM7QUFDQSxJQUFJLElBQUk7QUFDUixNQUFNLE1BQU0sS0FBSyxFQUFFLENBQUM7QUFDcEIsTUFBTSxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDO0FBQzdEO0FBQ0E7QUFDQSxNQUFNLE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLEVBQUU7QUFDbkUsUUFBUSxNQUFNLEVBQUUsTUFBTTtBQUN0QixRQUFRLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQztBQUNqQyxPQUFPLENBQUMsQ0FBQztBQUNULE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxHQUFHLENBQUM7QUFDSjtBQUNBO0FBQ0EsRUFBRSxHQUFHLENBQUMsSUFBSSxHQUFHLGdCQUFnQixHQUFHLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUNsRCxJQUFJLElBQUk7QUFDUixNQUFNLE1BQU0sS0FBSyxFQUFFLENBQUM7QUFDcEIsTUFBTSxNQUFNLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZDO0FBQ0EsTUFBTSxNQUFNLE1BQU0sR0FBRyxNQUFNLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtBQUMzRSxRQUFRLE1BQU0sRUFBRSxLQUFLO0FBQ3JCLFFBQVEsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDO0FBQ2pDLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNsQyxLQUFLLENBQUMsT0FBTyxLQUFLLEVBQUU7QUFDcEIsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDO0FBQ25DLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxHQUFHLENBQUM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLE9BQU8sR0FBR0osWUFBVSxDQUFDLFNBQVMsRUFBRSxnQkFBZ0IsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUN0RSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQztBQUN0QixNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsS0FBSztBQUNMLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN2QjtBQUNBO0FBQ0EsSUFBSSxNQUFNLE1BQU0sR0FBRyxFQUFFLENBQUM7QUFDdEIsSUFBSSxJQUFJLElBQUksQ0FBQztBQUNiLElBQUksSUFBSSxNQUFNLEdBQUcsS0FBSyxDQUFDO0FBQ3ZCO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDeEIsTUFBTSxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUM5QixLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ3pCLE1BQU0sTUFBTSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7QUFDL0IsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDekIsTUFBTSxNQUFNLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztBQUMvQixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtBQUMzQixNQUFNLE1BQU0sQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO0FBQ2pDLEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDMUIsTUFBTSxNQUFNLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztBQUNoQyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtBQUNsQixNQUFNLE1BQU0sQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDNUMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDeEIsTUFBTSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDckMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7QUFDdkIsTUFBTSxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3RELEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ3RCLE1BQU0sSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQ2pDLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ3JCLE1BQU0sTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNsRCxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksT0FBTyxJQUFJLENBQUMsYUFBYSxLQUFLLFdBQVcsRUFBRTtBQUNuRCxNQUFNLE1BQU0sQ0FBQyxhQUFhLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7QUFDbEQsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxXQUFXLEVBQUU7QUFDM0MsTUFBTSxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFDaEMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLEVBQUU7QUFDMUMsTUFBTSxNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDOUIsS0FBSztBQUNMO0FBQ0EsSUFBSSxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekM7QUFDQSxJQUFJLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRTtBQUMxQyxNQUFNLE1BQU0sR0FBRyxNQUFNLENBQUM7QUFDdEIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQy9CLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSTtBQUNSLE1BQU0sTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxXQUFXLEdBQUcsUUFBUSxDQUFDLEVBQUU7QUFDN0UsUUFBUSxNQUFNLEVBQUUsTUFBTTtBQUN0QixRQUFRLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUNsQyxPQUFPLENBQUMsQ0FBQztBQUNULE1BQU0sSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNoRSxRQUFRLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0FBQ2hFLE9BQU87QUFDUCxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xDLEtBQUssQ0FBQyxPQUFPLEtBQUssRUFBRTtBQUNwQixNQUFNLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN0QixLQUFLO0FBQ0wsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLFFBQVEsR0FBRyxVQUFVLElBQUksRUFBRTtBQUNqQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSSxNQUFNLFNBQVMsR0FBRyxZQUFZLElBQUksSUFBSSxHQUFHLElBQUksQ0FBQyxVQUFVLEdBQUcsa0JBQWtCLENBQUM7QUFDbEY7QUFDQSxJQUFJLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDdkI7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsSUFBSSxFQUFFLFdBQVcsSUFBSSxJQUFJLENBQUMsRUFBRTtBQUNuRCxNQUFNLElBQUksQ0FBQyxTQUFTLEdBQUcsaUJBQWlCLENBQUM7QUFDekMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLGNBQWMsR0FBRyxDQUFDLFNBQVMsSUFBSSxJQUFJLElBQUksSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDO0FBQ3hFO0FBQ0E7QUFDQSxJQUFJLElBQUksU0FBUyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsT0FBTztBQUN6QyxNQUFNLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxPQUFPLElBQUksc0JBQXNCLEVBQUU7QUFDaEUsUUFBUSxjQUFjLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxzQkFBc0IsQ0FBQztBQUMvRCxLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksSUFBSSxXQUFXLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTO0FBQzdDLE9BQU8sQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsSUFBSSxzQkFBc0IsRUFBRTtBQUNuRSxRQUFRLGNBQWMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFHLHNCQUFzQixDQUFDO0FBQ2pFLEtBQUs7QUFDTDtBQUNBLElBQUksTUFBTSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ3RCLElBQUksSUFBSSxTQUFTLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDM0MsTUFBTSxNQUFNLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7QUFDcEMsS0FBSztBQUNMO0FBQ0EsSUFBSSxNQUFNLEtBQUssR0FBRyxDQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7QUFDM0UsSUFBSSxJQUFJLFdBQVcsR0FBRyxLQUFLLENBQUM7QUFDNUI7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNwQixNQUFNLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUNoQyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLE9BQU8sSUFBSSxDQUFDLE1BQU0sS0FBSyxVQUFVLEVBQUU7QUFDL0UsTUFBTSxNQUFNLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztBQUNqQyxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUMxQixNQUFNLE1BQU0sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ3pCLE1BQU0sTUFBTSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7QUFDL0IsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7QUFDM0IsTUFBTSxNQUFNLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7QUFDOUMsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDeEIsTUFBTSxNQUFNLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUM5QixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUN6QixNQUFNLE1BQU0sQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO0FBQy9CLEtBQUs7QUFDTDtBQUNBO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDekIsTUFBTSxNQUFNLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztBQUMvQixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksV0FBVyxJQUFJLElBQUksRUFBRTtBQUM3QjtBQUNBLE1BQU0sSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQzFCLFFBQVEsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQzFDLE9BQU87QUFDUCxLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLEtBQUssUUFBUSxFQUFFO0FBQ3hELE1BQU0sTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ2xDLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDcEQsTUFBTSxNQUFNLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQztBQUM5QixNQUFNLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztBQUM5QixLQUFLO0FBQ0w7QUFDQTtBQUNBO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxZQUFZLElBQUksT0FBTyxJQUFJLENBQUMsWUFBWSxLQUFLLFFBQVEsRUFBRTtBQUNwRSxNQUFNLEtBQUssTUFBTSxVQUFVLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtBQUNsRDtBQUNBLFFBQVEsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsRUFBRTtBQUNqRixVQUFVLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzdELFNBQVM7QUFDVCxPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUM7QUFDdkIsSUFBSSxJQUFJLElBQUksQ0FBQztBQUNiO0FBQ0EsSUFBSSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDdEI7QUFDQTtBQUNBLE1BQU0sTUFBTSxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUM7QUFDakMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3RCLE1BQU0sSUFBSSxHQUFHLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUN0QyxLQUFLO0FBQ0w7QUFDQSxTQUFTLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtBQUM1QjtBQUNBLE1BQU0sTUFBTSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7QUFDbEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQ3RCLE1BQU0sSUFBSSxHQUFHLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUN4QyxLQUFLO0FBQ0w7QUFDQSxJQUFJLE1BQU0sVUFBVSxHQUFHLElBQUksZUFBZSxFQUFFLENBQUM7QUFDN0MsSUFBSSxJQUFJLGNBQWMsQ0FBQztBQUN2QjtBQUNBO0FBQ0E7QUFDQSxJQUFJLE1BQU0sU0FBUyxHQUFHLGdCQUFnQixLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3ZELE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ3hCLFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUCxNQUFNLE1BQU0sQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQzNCO0FBQ0E7QUFDQSxNQUFNLElBQUksT0FBTyxNQUFNLENBQUMsS0FBSyxLQUFLLFFBQVEsRUFBRTtBQUM1QyxRQUFRLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDcEQsT0FBTztBQUNQO0FBQ0EsTUFBTSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDM0IsUUFBUSxJQUFJLEtBQUssRUFBRTtBQUNuQixVQUFVLE1BQU0sQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDO0FBQ3JDLFNBQVM7QUFDVCxPQUFPLE1BQU07QUFDYixRQUFRLE1BQU0sQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssSUFBSSxXQUFXLEdBQUcsU0FBUztBQUN6RCxVQUFVLFNBQVMsR0FBRyxXQUFXLENBQUM7QUFDbEMsT0FBTztBQUNQO0FBQ0E7QUFDQSxNQUFNLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsVUFBVSxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0FBQ25FLE1BQU0sTUFBTSxTQUFTLEdBQUc7QUFDeEIsUUFBUSxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU07QUFDakMsUUFBUSxNQUFNLEVBQUUsTUFBTTtBQUN0QixRQUFRLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUNsQyxPQUFPLENBQUM7QUFDUixNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUM7QUFDN0I7QUFDQTtBQUNBLE1BQU0sSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ3hCLFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUDtBQUNBO0FBQ0EsTUFBTSxJQUFJO0FBQ1YsUUFBUSxNQUFNLEtBQUssRUFBRSxDQUFDO0FBQ3RCLFFBQVEsTUFBTSxNQUFNLEdBQUcsTUFBTSxTQUFTLENBQUMsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ3ZELFFBQVEsUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDcEMsT0FBTyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3RCLFFBQVEsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3hCLE9BQU87QUFDUCxLQUFLLENBQUM7QUFDTjtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUksTUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDbEM7QUFDQSxJQUFJLE1BQU0sT0FBTyxHQUFHLFVBQVUsR0FBRyxFQUFFLEdBQUcsRUFBRTtBQUN4QyxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUN4QixRQUFRLE9BQU87QUFDZixPQUFPO0FBQ1AsTUFBTSxJQUFJLGtCQUFrQixHQUFHLENBQUMsQ0FBQztBQUNqQztBQUNBLE1BQU0sSUFBSSxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sRUFBRTtBQUM5QixRQUFRLGtCQUFrQixHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO0FBQ2hELFFBQVEsT0FBTyxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDO0FBQ3hDLFFBQVEsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQzNCLFFBQVEsSUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQzNCO0FBQ0E7QUFDQSxRQUFRLElBQUksT0FBTyxHQUFHLENBQUMsT0FBTyxLQUFLLFFBQVEsRUFBRTtBQUM3QyxVQUFVLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ2hDLFNBQVM7QUFDVCxRQUFRLElBQUksT0FBTyxPQUFPLENBQUMsUUFBUSxLQUFLLFFBQVEsSUFBSSxPQUFPLE9BQU8sQ0FBQyxRQUFRLEtBQUssUUFBUSxFQUFFO0FBQzFGLFVBQVUsT0FBTyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUM7QUFDckMsU0FBUztBQUdULFFBQW9CLElBQUksQ0FBQyxZQUFZLENBQUM7QUFDdEMsUUFBUSxHQUFHLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ3RELFVBQVUsV0FBVyxFQUFFLENBQUM7QUFDeEIsVUFBVSxNQUFNLEdBQUcsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUMsVUFBVSxJQUFJLEdBQUcsRUFBRTtBQUNuQixZQUFZLElBQUksSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDdEUsY0FBYyw2QkFBNkIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMvQyxhQUFhO0FBQ2IsWUFBWSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDbEMsY0FBYyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0QyxhQUFhO0FBQ2IsWUFBWSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDL0MsV0FBVztBQUNYLFVBQVUsT0FBTyxHQUFHLENBQUM7QUFDckIsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPLE1BQU0sSUFBSSxHQUFHLEVBQUU7QUFDdEI7QUFDQTtBQUNBLFFBQVEsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFDNUIsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzNCLFFBQVEsT0FBTztBQUNmLE9BQU87QUFDUDtBQUNBO0FBQ0E7QUFDQSxNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxRQUFRLEVBQUU7QUFDL0IsUUFBUSxjQUFjLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQztBQUN0QyxPQUFPO0FBQ1A7QUFDQSxNQUFNLE1BQU0sUUFBUSxHQUFHLENBQUMsS0FBSyxJQUFJLFdBQVcsSUFBSSxDQUFDO0FBQ2pELFNBQVMsR0FBRyxJQUFJLGtCQUFrQixHQUFHLFNBQVMsQ0FBQztBQUMvQyxTQUFTLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUMxQjtBQUNBLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksRUFBRSxLQUFLLElBQUksV0FBVyxJQUFJLENBQUMsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFO0FBQzFFO0FBQ0EsUUFBUUUsU0FBUSxDQUFDLFlBQVksRUFBRSxTQUFTLENBQUMsY0FBYyxFQUFFLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RFLE9BQU8sTUFBTTtBQUNiO0FBQ0EsUUFBUSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNyQyxPQUFPO0FBQ1AsS0FBSyxDQUFDO0FBQ047QUFDQSxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUN4QztBQUNBO0FBQ0EsSUFBSSxPQUFPO0FBQ1gsTUFBTSxNQUFNLEVBQUUsWUFBWTtBQUMxQixRQUFRLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0FBQzVCLFFBQVEsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO0FBQzNCLE9BQU87QUFDUCxLQUFLLENBQUM7QUFDTixHQUFHLENBQUM7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsR0FBRyxDQUFDLFFBQVEsR0FBR0YsWUFBVSxDQUFDLFVBQVUsRUFBRSxnQkFBZ0IsR0FBRyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7QUFDN0U7QUFDQSxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO0FBQ3BDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQztBQUN0QixNQUFNLElBQUksR0FBRyxFQUFFLENBQUM7QUFDaEIsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJO0FBQ1I7QUFDQSxNQUFNLE1BQU0sTUFBTSxHQUFHLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLEVBQUU7QUFDbkUsUUFBUSxNQUFNLEVBQUUsTUFBTTtBQUN0QixRQUFRLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQztBQUNqQyxPQUFPLENBQUMsQ0FBQztBQUNULE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEMsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3RCLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxHQUFHLENBQUMsTUFBTSxHQUFHLFVBQVUsUUFBUSxFQUFFO0FBQ25DLElBQUksUUFBUSxFQUFFLENBQUM7QUFDZixHQUFHLENBQUM7QUFDSjtBQUNBLEVBQUUsR0FBRyxDQUFDLFFBQVEsR0FBRyxnQkFBZ0IsT0FBTyxFQUFFLFFBQVEsRUFBRTtBQUNwRCxJQUFJLElBQUk7QUFDUixNQUFNLE1BQU0sSUFBSSxHQUFHLE1BQU0sU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUMzRSxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDM0IsS0FBSyxDQUFDLE9BQU8sS0FBSyxFQUFFO0FBQ3BCLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxLQUFLLEdBQUcsRUFBRTtBQUNoQyxRQUFRLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNuQyxPQUFPLE1BQU07QUFDYixRQUFRLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4QixPQUFPO0FBQ1AsS0FBSztBQUNMLEdBQUcsQ0FBQztBQUNKLENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxDQUFDLEtBQUssR0FBRyxZQUFZO0FBQzlCLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDLENBQUM7QUFDRjtBQUNlLG9CQUFRLEVBQUUsT0FBTyxFQUFFO0FBQ2xDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzVDLEVBQUUsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzdDOzs7OyJ9
