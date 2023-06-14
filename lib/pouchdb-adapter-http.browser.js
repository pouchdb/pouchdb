import { AbortController, Headers, fetch } from './pouchdb-fetch.browser.js';
import { generateErrorFromResponse, createError, BAD_ARG } from './pouchdb-errors.browser.js';
import { a as adapterFun, p as pick, b as bulkGet } from './bulkGetShim-d4877145.js';
import './__node-resolve_empty-5ffda92e.js';
import { i as immediate } from './functionName-9335a350.js';
import { c as clone } from './clone-abfcddc8.js';
import { e as explainError } from './explainError-browser-c025e6c9.js';
import { p as parseUri, f as filterChange } from './parseUri-b061a2c5.js';
import { f as flatten } from './flatten-994f45c6.js';
import { a as thisBtoa, t as thisAtob } from './base64-browser-5f7b6479.js';
import { b as b64ToBluffer } from './base64StringToBlobOrBuffer-browser-ac90e85f.js';
import { a as binStringToBluffer } from './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';
import { b as blobToBase64 } from './blobOrBufferToBase64-browser-cd22f32f.js';
import './spark-md5-2c57e5fc.js';
import './toPromise-9dada06a.js';
import './_commonjsHelpers-24198af3.js';
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
  return genUrl(opts, opts.db + '/' + path);
}

// Generate a URL with the host data given by opts and the given path
function genUrl(opts, path) {
  // If the host already has a path, then we need to have a path delimiter
  // Otherwise, the path delimiter is the empty string
  const pathDel = !opts.path ? '' : '/';

  // If the host already has a path, then we need to have a path delimiter
  // Otherwise, the path delimiter is the empty string
  return opts.protocol + '://' + opts.host +
         (opts.port ? (':' + opts.port) : '') +
         '/' + opts.path + pathDel + path;
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
      const token = thisBtoa(unescape(encodeURIComponent(str)));
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
      const response = await ourFetch(genUrl(host, ''));
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
    const dbUrl = genUrl(host, '');
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
    genUrl(host, path.substring(1)) :
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
        binary = thisAtob(blob);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1hZGFwdGVyLWh0dHAuYnJvd3Nlci5qcyIsInNvdXJjZXMiOlsiLi4vcGFja2FnZXMvcG91Y2hkYi1hZGFwdGVyLWh0dHAvc3JjL3Byb21pc2UtcG9vbC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItYWRhcHRlci1odHRwL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBkZWFkIHNpbXBsZSBwcm9taXNlIHBvb2wsIGluc3BpcmVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS90aW1kcC9lczYtcHJvbWlzZS1wb29sXG4vLyBidXQgbXVjaCBzbWFsbGVyIGluIGNvZGUgc2l6ZS4gbGltaXRzIHRoZSBudW1iZXIgb2YgY29uY3VycmVudCBwcm9taXNlcyB0aGF0IGFyZSBleGVjdXRlZFxuXG5cbmZ1bmN0aW9uIHBvb2wocHJvbWlzZUZhY3RvcmllcywgbGltaXQpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICB2YXIgcnVubmluZyA9IDA7XG4gICAgdmFyIGN1cnJlbnQgPSAwO1xuICAgIHZhciBkb25lID0gMDtcbiAgICB2YXIgbGVuID0gcHJvbWlzZUZhY3Rvcmllcy5sZW5ndGg7XG4gICAgdmFyIGVycjtcblxuICAgIGZ1bmN0aW9uIHJ1bk5leHQoKSB7XG4gICAgICBydW5uaW5nKys7XG4gICAgICBwcm9taXNlRmFjdG9yaWVzW2N1cnJlbnQrK10oKS50aGVuKG9uU3VjY2Vzcywgb25FcnJvcik7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZG9OZXh0KCkge1xuICAgICAgaWYgKCsrZG9uZSA9PT0gbGVuKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBydW5OZXh0QmF0Y2goKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvblN1Y2Nlc3MoKSB7XG4gICAgICBydW5uaW5nLS07XG4gICAgICBkb05leHQoKTtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGZ1bmN0aW9uIG9uRXJyb3IodGhpc0Vycikge1xuICAgICAgcnVubmluZy0tO1xuICAgICAgZXJyID0gZXJyIHx8IHRoaXNFcnI7XG4gICAgICBkb05leHQoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBydW5OZXh0QmF0Y2goKSB7XG4gICAgICB3aGlsZSAocnVubmluZyA8IGxpbWl0ICYmIGN1cnJlbnQgPCBsZW4pIHtcbiAgICAgICAgcnVuTmV4dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJ1bk5leHRCYXRjaCgpO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9vbDsiLCIvLyAndXNlIHN0cmljdCc7IGlzIGRlZmF1bHQgd2hlbiBFU01cblxuaW1wb3J0IHBvb2wgZnJvbSAnLi9wcm9taXNlLXBvb2wnO1xuXG5pbXBvcnQgeyBmZXRjaCwgSGVhZGVycywgQWJvcnRDb250cm9sbGVyIH0gZnJvbSAncG91Y2hkYi1mZXRjaCc7XG5cbmltcG9ydCB7XG4gIGNyZWF0ZUVycm9yLFxuICBCQURfQVJHLFxuICBnZW5lcmF0ZUVycm9yRnJvbVJlc3BvbnNlXG59IGZyb20gJ3BvdWNoZGItZXJyb3JzJztcblxuaW1wb3J0IHtcbiAgcGljayxcbiAgZmlsdGVyQ2hhbmdlLFxuICBhZGFwdGVyRnVuIGFzIGNvcmVBZGFwdGVyRnVuLFxuICBleHBsYWluRXJyb3IsXG4gIGNsb25lLFxuICBwYXJzZVVyaSxcbiAgYnVsa0dldFNoaW0sXG4gIGZsYXR0ZW4sXG4gIG5leHRUaWNrXG59IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5pbXBvcnQge1xuICBhdG9iLFxuICBidG9hLFxuICBiaW5hcnlTdHJpbmdUb0Jsb2JPckJ1ZmZlciBhcyBiaW5TdHJpbmdUb0JsdWZmZXIsXG4gIGJhc2U2NFN0cmluZ1RvQmxvYk9yQnVmZmVyIGFzIGI2NFN0cmluZ1RvQmx1ZmZlcixcbiAgYmxvYk9yQnVmZmVyVG9CYXNlNjQgYXMgYmx1ZmZlclRvQmFzZTY0XG59IGZyb20gJ3BvdWNoZGItYmluYXJ5LXV0aWxzJztcblxuY29uc3QgQ0hBTkdFU19CQVRDSF9TSVpFID0gMjU7XG5jb25zdCBNQVhfU0lNVUxUQU5FT1VTX1JFVlMgPSA1MDtcbmNvbnN0IENIQU5HRVNfVElNRU9VVF9CVUZGRVIgPSA1MDAwO1xuY29uc3QgREVGQVVMVF9IRUFSVEJFQVQgPSAxMDAwMDtcblxuY29uc3Qgc3VwcG9ydHNCdWxrR2V0TWFwID0ge307XG5cbmZ1bmN0aW9uIHJlYWRBdHRhY2htZW50c0FzQmxvYk9yQnVmZmVyKHJvdykge1xuICBjb25zdCBkb2MgPSByb3cuZG9jIHx8IHJvdy5vaztcbiAgY29uc3QgYXR0cyA9IGRvYyAmJiBkb2MuX2F0dGFjaG1lbnRzO1xuICBpZiAoIWF0dHMpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgT2JqZWN0LmtleXMoYXR0cykuZm9yRWFjaChmdW5jdGlvbiAoZmlsZW5hbWUpIHtcbiAgICBjb25zdCBhdHQgPSBhdHRzW2ZpbGVuYW1lXTtcbiAgICBhdHQuZGF0YSA9IGI2NFN0cmluZ1RvQmx1ZmZlcihhdHQuZGF0YSwgYXR0LmNvbnRlbnRfdHlwZSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBlbmNvZGVEb2NJZChpZCkge1xuICBpZiAoL15fZGVzaWduLy50ZXN0KGlkKSkge1xuICAgIHJldHVybiAnX2Rlc2lnbi8nICsgZW5jb2RlVVJJQ29tcG9uZW50KGlkLnNsaWNlKDgpKTtcbiAgfVxuICBpZiAoaWQuc3RhcnRzV2l0aCgnX2xvY2FsLycpKSB7XG4gICAgcmV0dXJuICdfbG9jYWwvJyArIGVuY29kZVVSSUNvbXBvbmVudChpZC5zbGljZSg3KSk7XG4gIH1cbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChpZCk7XG59XG5cbmZ1bmN0aW9uIHByZXByb2Nlc3NBdHRhY2htZW50cyhkb2MpIHtcbiAgaWYgKCFkb2MuX2F0dGFjaG1lbnRzIHx8ICFPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKSkge1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIHJldHVybiBQcm9taXNlLmFsbChPYmplY3Qua2V5cyhkb2MuX2F0dGFjaG1lbnRzKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuICAgIGNvbnN0IGF0dGFjaG1lbnQgPSBkb2MuX2F0dGFjaG1lbnRzW2tleV07XG4gICAgaWYgKGF0dGFjaG1lbnQuZGF0YSAmJiB0eXBlb2YgYXR0YWNobWVudC5kYXRhICE9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlKSB7XG4gICAgICAgIGJsdWZmZXJUb0Jhc2U2NChhdHRhY2htZW50LmRhdGEsIHJlc29sdmUpO1xuICAgICAgfSkudGhlbihmdW5jdGlvbiAoYjY0KSB7XG4gICAgICAgIGF0dGFjaG1lbnQuZGF0YSA9IGI2NDtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSkpO1xufVxuXG5mdW5jdGlvbiBoYXNVcmxQcmVmaXgob3B0cykge1xuICBpZiAoIW9wdHMucHJlZml4KSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IHByb3RvY29sID0gcGFyc2VVcmkob3B0cy5wcmVmaXgpLnByb3RvY29sO1xuICByZXR1cm4gcHJvdG9jb2wgPT09ICdodHRwJyB8fCBwcm90b2NvbCA9PT0gJ2h0dHBzJztcbn1cblxuLy8gR2V0IGFsbCB0aGUgaW5mb3JtYXRpb24geW91IHBvc3NpYmx5IGNhbiBhYm91dCB0aGUgVVJJIGdpdmVuIGJ5IG5hbWUgYW5kXG4vLyByZXR1cm4gaXQgYXMgYSBzdWl0YWJsZSBvYmplY3QuXG5mdW5jdGlvbiBnZXRIb3N0KG5hbWUsIG9wdHMpIHtcbiAgLy8gZW5jb2RlIGRiIG5hbWUgaWYgb3B0cy5wcmVmaXggaXMgYSB1cmwgKCM1NTc0KVxuICBpZiAoaGFzVXJsUHJlZml4KG9wdHMpKSB7XG4gICAgY29uc3QgZGJOYW1lID0gb3B0cy5uYW1lLnN1YnN0cihvcHRzLnByZWZpeC5sZW5ndGgpO1xuICAgIC8vIEVuc3VyZSBwcmVmaXggaGFzIGEgdHJhaWxpbmcgc2xhc2hcbiAgICBjb25zdCBwcmVmaXggPSBvcHRzLnByZWZpeC5yZXBsYWNlKC9cXC8/JC8sICcvJyk7XG4gICAgbmFtZSA9IHByZWZpeCArIGVuY29kZVVSSUNvbXBvbmVudChkYk5hbWUpO1xuICB9XG5cbiAgY29uc3QgdXJpID0gcGFyc2VVcmkobmFtZSk7XG4gIGlmICh1cmkudXNlciB8fCB1cmkucGFzc3dvcmQpIHtcbiAgICB1cmkuYXV0aCA9IHt1c2VybmFtZTogdXJpLnVzZXIsIHBhc3N3b3JkOiB1cmkucGFzc3dvcmR9O1xuICB9XG5cbiAgLy8gU3BsaXQgdGhlIHBhdGggcGFydCBvZiB0aGUgVVJJIGludG8gcGFydHMgdXNpbmcgJy8nIGFzIHRoZSBkZWxpbWl0ZXJcbiAgLy8gYWZ0ZXIgcmVtb3ZpbmcgYW55IGxlYWRpbmcgJy8nIGFuZCBhbnkgdHJhaWxpbmcgJy8nXG4gIGNvbnN0IHBhcnRzID0gdXJpLnBhdGgucmVwbGFjZSgvKF5cXC98XFwvJCkvZywgJycpLnNwbGl0KCcvJyk7XG5cbiAgdXJpLmRiID0gcGFydHMucG9wKCk7XG4gIC8vIFByZXZlbnQgZG91YmxlIGVuY29kaW5nIG9mIFVSSSBjb21wb25lbnRcbiAgaWYgKHVyaS5kYi5pbmRleE9mKCclJykgPT09IC0xKSB7XG4gICAgdXJpLmRiID0gZW5jb2RlVVJJQ29tcG9uZW50KHVyaS5kYik7XG4gIH1cblxuICB1cmkucGF0aCA9IHBhcnRzLmpvaW4oJy8nKTtcblxuICByZXR1cm4gdXJpO1xufVxuXG4vLyBHZW5lcmF0ZSBhIFVSTCB3aXRoIHRoZSBob3N0IGRhdGEgZ2l2ZW4gYnkgb3B0cyBhbmQgdGhlIGdpdmVuIHBhdGhcbmZ1bmN0aW9uIGdlbkRCVXJsKG9wdHMsIHBhdGgpIHtcbiAgcmV0dXJuIGdlblVybChvcHRzLCBvcHRzLmRiICsgJy8nICsgcGF0aCk7XG59XG5cbi8vIEdlbmVyYXRlIGEgVVJMIHdpdGggdGhlIGhvc3QgZGF0YSBnaXZlbiBieSBvcHRzIGFuZCB0aGUgZ2l2ZW4gcGF0aFxuZnVuY3Rpb24gZ2VuVXJsKG9wdHMsIHBhdGgpIHtcbiAgLy8gSWYgdGhlIGhvc3QgYWxyZWFkeSBoYXMgYSBwYXRoLCB0aGVuIHdlIG5lZWQgdG8gaGF2ZSBhIHBhdGggZGVsaW1pdGVyXG4gIC8vIE90aGVyd2lzZSwgdGhlIHBhdGggZGVsaW1pdGVyIGlzIHRoZSBlbXB0eSBzdHJpbmdcbiAgY29uc3QgcGF0aERlbCA9ICFvcHRzLnBhdGggPyAnJyA6ICcvJztcblxuICAvLyBJZiB0aGUgaG9zdCBhbHJlYWR5IGhhcyBhIHBhdGgsIHRoZW4gd2UgbmVlZCB0byBoYXZlIGEgcGF0aCBkZWxpbWl0ZXJcbiAgLy8gT3RoZXJ3aXNlLCB0aGUgcGF0aCBkZWxpbWl0ZXIgaXMgdGhlIGVtcHR5IHN0cmluZ1xuICByZXR1cm4gb3B0cy5wcm90b2NvbCArICc6Ly8nICsgb3B0cy5ob3N0ICtcbiAgICAgICAgIChvcHRzLnBvcnQgPyAoJzonICsgb3B0cy5wb3J0KSA6ICcnKSArXG4gICAgICAgICAnLycgKyBvcHRzLnBhdGggKyBwYXRoRGVsICsgcGF0aDtcbn1cblxuZnVuY3Rpb24gcGFyYW1zVG9TdHIocGFyYW1zKSB7XG4gIGNvbnN0IHBhcmFtS2V5cyA9IE9iamVjdC5rZXlzKHBhcmFtcyk7XG4gIGlmIChwYXJhbUtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgcmV0dXJuICc/JyArIHBhcmFtS2V5cy5tYXAoa2V5ID0+IGtleSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudChwYXJhbXNba2V5XSkpLmpvaW4oJyYnKTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkQ2FjaGVCdXN0KG9wdHMpIHtcbiAgY29uc3QgdWEgPSAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCkgP1xuICAgICAgbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpIDogJyc7XG4gIGNvbnN0IGlzSUUgPSB1YS5pbmRleE9mKCdtc2llJykgIT09IC0xO1xuICBjb25zdCBpc1RyaWRlbnQgPSB1YS5pbmRleE9mKCd0cmlkZW50JykgIT09IC0xO1xuICBjb25zdCBpc0VkZ2UgPSB1YS5pbmRleE9mKCdlZGdlJykgIT09IC0xO1xuICBjb25zdCBpc0dFVCA9ICEoJ21ldGhvZCcgaW4gb3B0cykgfHwgb3B0cy5tZXRob2QgPT09ICdHRVQnO1xuICByZXR1cm4gKGlzSUUgfHwgaXNUcmlkZW50IHx8IGlzRWRnZSkgJiYgaXNHRVQ7XG59XG5cbi8vIEltcGxlbWVudHMgdGhlIFBvdWNoREIgQVBJIGZvciBkZWFsaW5nIHdpdGggQ291Y2hEQiBpbnN0YW5jZXMgb3ZlciBIVFRQXG5mdW5jdGlvbiBIdHRwUG91Y2gob3B0cywgY2FsbGJhY2spIHtcblxuICAvLyBUaGUgZnVuY3Rpb25zIHRoYXQgd2lsbCBiZSBwdWJsaWNseSBhdmFpbGFibGUgZm9yIEh0dHBQb3VjaFxuICBjb25zdCBhcGkgPSB0aGlzO1xuXG4gIGNvbnN0IGhvc3QgPSBnZXRIb3N0KG9wdHMubmFtZSwgb3B0cyk7XG4gIGNvbnN0IGRiVXJsID0gZ2VuREJVcmwoaG9zdCwgJycpO1xuXG4gIG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICBjb25zdCBvdXJGZXRjaCA9IGFzeW5jIGZ1bmN0aW9uICh1cmwsIG9wdGlvbnMpIHtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCBuZXcgSGVhZGVycygpO1xuXG4gICAgb3B0aW9ucy5jcmVkZW50aWFscyA9ICdpbmNsdWRlJztcblxuICAgIGlmIChvcHRzLmF1dGggfHwgaG9zdC5hdXRoKSB7XG4gICAgICBjb25zdCBuQXV0aCA9IG9wdHMuYXV0aCB8fCBob3N0LmF1dGg7XG4gICAgICBjb25zdCBzdHIgPSBuQXV0aC51c2VybmFtZSArICc6JyArIG5BdXRoLnBhc3N3b3JkO1xuICAgICAgY29uc3QgdG9rZW4gPSBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChzdHIpKSk7XG4gICAgICBvcHRpb25zLmhlYWRlcnMuc2V0KCdBdXRob3JpemF0aW9uJywgJ0Jhc2ljICcgKyB0b2tlbik7XG4gICAgfVxuXG4gICAgY29uc3QgaGVhZGVycyA9IG9wdHMuaGVhZGVycyB8fCB7fTtcbiAgICBPYmplY3Qua2V5cyhoZWFkZXJzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIG9wdGlvbnMuaGVhZGVycy5hcHBlbmQoa2V5LCBoZWFkZXJzW2tleV0pO1xuICAgIH0pO1xuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHNob3VsZENhY2hlQnVzdChvcHRpb25zKSkge1xuICAgICAgdXJsICs9ICh1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJykgKyAnX25vbmNlPScgKyBEYXRlLm5vdygpO1xuICAgIH1cblxuICAgIGNvbnN0IGZldGNoRnVuID0gb3B0cy5mZXRjaCB8fCBmZXRjaDtcbiAgICByZXR1cm4gYXdhaXQgZmV0Y2hGdW4odXJsLCBvcHRpb25zKTtcbiAgfTtcblxuICBmdW5jdGlvbiBhZGFwdGVyRnVuKG5hbWUsIGZ1bikge1xuICAgIHJldHVybiBjb3JlQWRhcHRlckZ1bihuYW1lLCBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgc2V0dXAoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZ1bi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICB9KTtcbiAgICB9KS5iaW5kKGFwaSk7XG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBmZXRjaEpTT04odXJsLCBvcHRpb25zKSB7XG5cbiAgICBjb25zdCByZXN1bHQgPSB7fTtcblxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIG9wdGlvbnMuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCBuZXcgSGVhZGVycygpO1xuXG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMuZ2V0KCdDb250ZW50LVR5cGUnKSkge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzLnNldCgnQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLmhlYWRlcnMuZ2V0KCdBY2NlcHQnKSkge1xuICAgICAgb3B0aW9ucy5oZWFkZXJzLnNldCgnQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG91ckZldGNoKHVybCwgb3B0aW9ucyk7XG4gICAgcmVzdWx0Lm9rID0gcmVzcG9uc2Uub2s7XG4gICAgcmVzdWx0LnN0YXR1cyA9IHJlc3BvbnNlLnN0YXR1cztcbiAgICBjb25zdCBqc29uID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuXG4gICAgcmVzdWx0LmRhdGEgPSBqc29uO1xuICAgIGlmICghcmVzdWx0Lm9rKSB7XG4gICAgICByZXN1bHQuZGF0YS5zdGF0dXMgPSByZXN1bHQuc3RhdHVzO1xuICAgICAgY29uc3QgZXJyID0gZ2VuZXJhdGVFcnJvckZyb21SZXNwb25zZShyZXN1bHQuZGF0YSk7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0LmRhdGEpKSB7XG4gICAgICByZXN1bHQuZGF0YSA9IHJlc3VsdC5kYXRhLm1hcChmdW5jdGlvbiAodikge1xuICAgICAgICBpZiAodi5lcnJvciB8fCB2Lm1pc3NpbmcpIHtcbiAgICAgICAgICByZXR1cm4gZ2VuZXJhdGVFcnJvckZyb21SZXNwb25zZSh2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gdjtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGxldCBzZXR1cFByb21pc2U7XG5cbiAgYXN5bmMgZnVuY3Rpb24gc2V0dXAoKSB7XG4gICAgaWYgKG9wdHMuc2tpcF9zZXR1cCkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlIGlzIGEgc2V0dXAgaW4gcHJvY2VzcyBvciBwcmV2aW91cyBzdWNjZXNzZnVsIHNldHVwXG4gICAgLy8gZG9uZSB0aGVuIHdlIHdpbGwgdXNlIHRoYXRcbiAgICAvLyBJZiBwcmV2aW91cyBzZXR1cHMgaGF2ZSBiZWVuIHJlamVjdGVkIHdlIHdpbGwgdHJ5IGFnYWluXG4gICAgaWYgKHNldHVwUHJvbWlzZSkge1xuICAgICAgcmV0dXJuIHNldHVwUHJvbWlzZTtcbiAgICB9XG5cbiAgICBzZXR1cFByb21pc2UgPSBmZXRjaEpTT04oZGJVcmwpLmNhdGNoKGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIgJiYgZXJyLnN0YXR1cyAmJiBlcnIuc3RhdHVzID09PSA0MDQpIHtcbiAgICAgICAgLy8gRG9lc250IGV4aXN0LCBjcmVhdGUgaXRcbiAgICAgICAgZXhwbGFpbkVycm9yKDQwNCwgJ1BvdWNoREIgaXMganVzdCBkZXRlY3RpbmcgaWYgdGhlIHJlbW90ZSBleGlzdHMuJyk7XG4gICAgICAgIHJldHVybiBmZXRjaEpTT04oZGJVcmwsIHttZXRob2Q6ICdQVVQnfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgIH1cbiAgICB9KS5jYXRjaChmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAvLyBJZiB3ZSB0cnkgdG8gY3JlYXRlIGEgZGF0YWJhc2UgdGhhdCBhbHJlYWR5IGV4aXN0cywgc2tpcHBlZCBpblxuICAgICAgLy8gaXN0YW5idWwgc2luY2UgaXRzIGNhdGNoaW5nIGEgcmFjZSBjb25kaXRpb24uXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlcnIgJiYgZXJyLnN0YXR1cyAmJiBlcnIuc3RhdHVzID09PSA0MTIpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICB9KTtcblxuICAgIHNldHVwUHJvbWlzZS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICBzZXR1cFByb21pc2UgPSBudWxsO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHNldHVwUHJvbWlzZTtcbiAgfVxuXG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBjYWxsYmFjayhudWxsLCBhcGkpO1xuICB9KTtcblxuICBhcGkuX3JlbW90ZSA9IHRydWU7XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgYXBpLnR5cGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICdodHRwJztcbiAgfTtcblxuICBhcGkuaWQgPSBhZGFwdGVyRnVuKCdpZCcsIGFzeW5jIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgb3VyRmV0Y2goZ2VuVXJsKGhvc3QsICcnKSk7XG4gICAgICByZXN1bHQgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICByZXN1bHQgPSB7fTtcbiAgICB9XG5cbiAgICAvLyBCYWQgcmVzcG9uc2Ugb3IgbWlzc2luZyBgdXVpZGAgc2hvdWxkIG5vdCBwcmV2ZW50IElEIGdlbmVyYXRpb24uXG4gICAgY29uc3QgdXVpZCA9IChyZXN1bHQgJiYgcmVzdWx0LnV1aWQpID8gKHJlc3VsdC51dWlkICsgaG9zdC5kYikgOiBnZW5EQlVybChob3N0LCAnJyk7XG4gICAgY2FsbGJhY2sobnVsbCwgdXVpZCk7XG4gIH0pO1xuXG4gIC8vIFNlbmRzIGEgUE9TVCByZXF1ZXN0IHRvIHRoZSBob3N0IGNhbGxpbmcgdGhlIGNvdWNoZGIgX2NvbXBhY3QgZnVuY3Rpb25cbiAgLy8gICAgdmVyc2lvbjogVGhlIHZlcnNpb24gb2YgQ291Y2hEQiBpdCBpcyBydW5uaW5nXG4gIGFwaS5jb21wYWN0ID0gYWRhcHRlckZ1bignY29tcGFjdCcsIGFzeW5jIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBvcHRzID0gY2xvbmUob3B0cyk7XG5cbiAgICBhd2FpdCBmZXRjaEpTT04oZ2VuREJVcmwoaG9zdCwgJ19jb21wYWN0JyksIHttZXRob2Q6ICdQT1NUJ30pO1xuXG4gICAgZnVuY3Rpb24gcGluZygpIHtcbiAgICAgIGFwaS5pbmZvKGZ1bmN0aW9uIChlcnIsIHJlcykge1xuICAgICAgICAvLyBDb3VjaERCIG1heSBzZW5kIGEgXCJjb21wYWN0X3J1bm5pbmc6dHJ1ZVwiIGlmIGl0J3NcbiAgICAgICAgLy8gYWxyZWFkeSBjb21wYWN0aW5nLiBQb3VjaERCIFNlcnZlciBkb2Vzbid0LlxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgICAgICBpZiAocmVzICYmICFyZXMuY29tcGFjdF9ydW5uaW5nKSB7XG4gICAgICAgICAgY2FsbGJhY2sobnVsbCwge29rOiB0cnVlfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2V0VGltZW91dChwaW5nLCBvcHRzLmludGVydmFsIHx8IDIwMCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBQaW5nIHRoZSBodHRwIGlmIGl0J3MgZmluaXNoZWQgY29tcGFjdGlvblxuICAgIHBpbmcoKTtcbiAgfSk7XG5cbiAgYXBpLmJ1bGtHZXQgPSBjb3JlQWRhcHRlckZ1bignYnVsa0dldCcsIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgYXN5bmMgZnVuY3Rpb24gZG9CdWxrR2V0KGNiKSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSB7fTtcbiAgICAgIGlmIChvcHRzLnJldnMpIHtcbiAgICAgICAgcGFyYW1zLnJldnMgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdHMuYXR0YWNobWVudHMpIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgcGFyYW1zLmF0dGFjaG1lbnRzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRzLmxhdGVzdCkge1xuICAgICAgICBwYXJhbXMubGF0ZXN0ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTihnZW5EQlVybChob3N0LCAnX2J1bGtfZ2V0JyArIHBhcmFtc1RvU3RyKHBhcmFtcykpLCB7XG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBkb2NzOiBvcHRzLmRvY3N9KVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAob3B0cy5hdHRhY2htZW50cyAmJiBvcHRzLmJpbmFyeSkge1xuICAgICAgICAgIHJlc3VsdC5kYXRhLnJlc3VsdHMuZm9yRWFjaChmdW5jdGlvbiAocmVzKSB7XG4gICAgICAgICAgICByZXMuZG9jcy5mb3JFYWNoKHJlYWRBdHRhY2htZW50c0FzQmxvYk9yQnVmZmVyKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYihudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjYihlcnJvcik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICBmdW5jdGlvbiBkb0J1bGtHZXRTaGltKCkge1xuICAgICAgLy8gYXZvaWQgXCJ1cmwgdG9vIGxvbmcgZXJyb3JcIiBieSBzcGxpdHRpbmcgdXAgaW50byBtdWx0aXBsZSByZXF1ZXN0c1xuICAgICAgY29uc3QgYmF0Y2hTaXplID0gTUFYX1NJTVVMVEFORU9VU19SRVZTO1xuICAgICAgY29uc3QgbnVtQmF0Y2hlcyA9IE1hdGguY2VpbChvcHRzLmRvY3MubGVuZ3RoIC8gYmF0Y2hTaXplKTtcbiAgICAgIGxldCBudW1Eb25lID0gMDtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBuZXcgQXJyYXkobnVtQmF0Y2hlcyk7XG5cbiAgICAgIGZ1bmN0aW9uIG9uUmVzdWx0KGJhdGNoTnVtKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoZXJyLCByZXMpIHtcbiAgICAgICAgICAvLyBlcnIgaXMgaW1wb3NzaWJsZSBiZWNhdXNlIHNoaW0gcmV0dXJucyBhIGxpc3Qgb2YgZXJycyBpbiB0aGF0IGNhc2VcbiAgICAgICAgICByZXN1bHRzW2JhdGNoTnVtXSA9IHJlcy5yZXN1bHRzO1xuICAgICAgICAgIGlmICgrK251bURvbmUgPT09IG51bUJhdGNoZXMpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHtyZXN1bHRzOiBmbGF0dGVuKHJlc3VsdHMpfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUJhdGNoZXM7IGkrKykge1xuICAgICAgICBjb25zdCBzdWJPcHRzID0gcGljayhvcHRzLCBbJ3JldnMnLCAnYXR0YWNobWVudHMnLCAnYmluYXJ5JywgJ2xhdGVzdCddKTtcbiAgICAgICAgc3ViT3B0cy5kb2NzID0gb3B0cy5kb2NzLnNsaWNlKGkgKiBiYXRjaFNpemUsXG4gICAgICAgICAgTWF0aC5taW4ob3B0cy5kb2NzLmxlbmd0aCwgKGkgKyAxKSAqIGJhdGNoU2l6ZSkpO1xuICAgICAgICBidWxrR2V0U2hpbShzZWxmLCBzdWJPcHRzLCBvblJlc3VsdChpKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gbWFyayB0aGUgd2hvbGUgZGF0YWJhc2UgYXMgZWl0aGVyIHN1cHBvcnRpbmcgb3Igbm90IHN1cHBvcnRpbmcgX2J1bGtfZ2V0XG4gICAgY29uc3QgZGJVcmwgPSBnZW5VcmwoaG9zdCwgJycpO1xuICAgIGNvbnN0IHN1cHBvcnRzQnVsa0dldCA9IHN1cHBvcnRzQnVsa0dldE1hcFtkYlVybF07XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmICh0eXBlb2Ygc3VwcG9ydHNCdWxrR2V0ICE9PSAnYm9vbGVhbicpIHtcbiAgICAgIC8vIGNoZWNrIGlmIHRoaXMgZGF0YWJhc2Ugc3VwcG9ydHMgX2J1bGtfZ2V0XG4gICAgICBkb0J1bGtHZXQoZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICBzdXBwb3J0c0J1bGtHZXRNYXBbZGJVcmxdID0gZmFsc2U7XG4gICAgICAgICAgZXhwbGFpbkVycm9yKFxuICAgICAgICAgICAgZXJyLnN0YXR1cyxcbiAgICAgICAgICAgICdQb3VjaERCIGlzIGp1c3QgZGV0ZWN0aW5nIGlmIHRoZSByZW1vdGUgJyArXG4gICAgICAgICAgICAnc3VwcG9ydHMgdGhlIF9idWxrX2dldCBBUEkuJ1xuICAgICAgICAgICk7XG4gICAgICAgICAgZG9CdWxrR2V0U2hpbSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN1cHBvcnRzQnVsa0dldE1hcFtkYlVybF0gPSB0cnVlO1xuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoc3VwcG9ydHNCdWxrR2V0KSB7XG4gICAgICBkb0J1bGtHZXQoY2FsbGJhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICBkb0J1bGtHZXRTaGltKCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBDYWxscyBHRVQgb24gdGhlIGhvc3QsIHdoaWNoIGdldHMgYmFjayBhIEpTT04gc3RyaW5nIGNvbnRhaW5pbmdcbiAgLy8gICAgY291Y2hkYjogQSB3ZWxjb21lIHN0cmluZ1xuICAvLyAgICB2ZXJzaW9uOiBUaGUgdmVyc2lvbiBvZiBDb3VjaERCIGl0IGlzIHJ1bm5pbmdcbiAgYXBpLl9pbmZvID0gYXN5bmMgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNldHVwKCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IG91ckZldGNoKGdlbkRCVXJsKGhvc3QsICcnKSk7XG4gICAgICBjb25zdCBpbmZvID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgaW5mby5ob3N0ID0gZ2VuREJVcmwoaG9zdCwgJycpO1xuICAgICAgY2FsbGJhY2sobnVsbCwgaW5mbyk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH1cbiAgfTtcblxuICBhcGkuZmV0Y2ggPSBhc3luYyBmdW5jdGlvbiAocGF0aCwgb3B0aW9ucykge1xuICAgIGF3YWl0IHNldHVwKCk7XG4gICAgY29uc3QgdXJsID0gcGF0aC5zdWJzdHJpbmcoMCwgMSkgPT09ICcvJyA/XG4gICAgZ2VuVXJsKGhvc3QsIHBhdGguc3Vic3RyaW5nKDEpKSA6XG4gICAgZ2VuREJVcmwoaG9zdCwgcGF0aCk7XG4gICAgcmV0dXJuIG91ckZldGNoKHVybCwgb3B0aW9ucyk7XG4gIH07XG5cbiAgLy8gR2V0IHRoZSBkb2N1bWVudCB3aXRoIHRoZSBnaXZlbiBpZCBmcm9tIHRoZSBkYXRhYmFzZSBnaXZlbiBieSBob3N0LlxuICAvLyBUaGUgaWQgY291bGQgYmUgc29sZWx5IHRoZSBfaWQgaW4gdGhlIGRhdGFiYXNlLCBvciBpdCBtYXkgYmUgYVxuICAvLyBfZGVzaWduL0lEIG9yIF9sb2NhbC9JRCBwYXRoXG4gIGFwaS5nZXQgPSBhZGFwdGVyRnVuKCdnZXQnLCBhc3luYyBmdW5jdGlvbiAoaWQsIG9wdHMsIGNhbGxiYWNrKSB7XG4gICAgLy8gSWYgbm8gb3B0aW9ucyB3ZXJlIGdpdmVuLCBzZXQgdGhlIGNhbGxiYWNrIHRvIHRoZSBzZWNvbmQgcGFyYW1ldGVyXG4gICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICBvcHRzID0ge307XG4gICAgfVxuICAgIG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICAgIC8vIExpc3Qgb2YgcGFyYW1ldGVycyB0byBhZGQgdG8gdGhlIEdFVCByZXF1ZXN0XG4gICAgY29uc3QgcGFyYW1zID0ge307XG5cbiAgICBpZiAob3B0cy5yZXZzKSB7XG4gICAgICBwYXJhbXMucmV2cyA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMucmV2c19pbmZvKSB7XG4gICAgICBwYXJhbXMucmV2c19pbmZvID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5sYXRlc3QpIHtcbiAgICAgIHBhcmFtcy5sYXRlc3QgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLm9wZW5fcmV2cykge1xuICAgICAgaWYgKG9wdHMub3Blbl9yZXZzICE9PSBcImFsbFwiKSB7XG4gICAgICAgIG9wdHMub3Blbl9yZXZzID0gSlNPTi5zdHJpbmdpZnkob3B0cy5vcGVuX3JldnMpO1xuICAgICAgfVxuICAgICAgcGFyYW1zLm9wZW5fcmV2cyA9IG9wdHMub3Blbl9yZXZzO1xuICAgIH1cblxuICAgIGlmIChvcHRzLnJldikge1xuICAgICAgcGFyYW1zLnJldiA9IG9wdHMucmV2O1xuICAgIH1cblxuICAgIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgICAgcGFyYW1zLmNvbmZsaWN0cyA9IG9wdHMuY29uZmxpY3RzO1xuICAgIH1cblxuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmIChvcHRzLnVwZGF0ZV9zZXEpIHtcbiAgICAgIHBhcmFtcy51cGRhdGVfc2VxID0gb3B0cy51cGRhdGVfc2VxO1xuICAgIH1cblxuICAgIGlkID0gZW5jb2RlRG9jSWQoaWQpO1xuXG4gICAgZnVuY3Rpb24gZmV0Y2hBdHRhY2htZW50cyhkb2MpIHtcbiAgICAgIGNvbnN0IGF0dHMgPSBkb2MuX2F0dGFjaG1lbnRzO1xuICAgICAgY29uc3QgZmlsZW5hbWVzID0gYXR0cyAmJiBPYmplY3Qua2V5cyhhdHRzKTtcbiAgICAgIGlmICghYXR0cyB8fCAhZmlsZW5hbWVzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyB3ZSBmZXRjaCB0aGVzZSBtYW51YWxseSBpbiBzZXBhcmF0ZSBYSFJzLCBiZWNhdXNlXG4gICAgICAvLyBTeW5jIEdhdGV3YXkgd291bGQgbm9ybWFsbHkgc2VuZCBpdCBiYWNrIGFzIG11bHRpcGFydC9taXhlZCxcbiAgICAgIC8vIHdoaWNoIHdlIGNhbm5vdCBwYXJzZS4gQWxzbywgdGhpcyBpcyBtb3JlIGVmZmljaWVudCB0aGFuXG4gICAgICAvLyByZWNlaXZpbmcgYXR0YWNobWVudHMgYXMgYmFzZTY0LWVuY29kZWQgc3RyaW5ncy5cbiAgICAgIGFzeW5jIGZ1bmN0aW9uIGZldGNoRGF0YShmaWxlbmFtZSkge1xuICAgICAgICBjb25zdCBhdHQgPSBhdHRzW2ZpbGVuYW1lXTtcbiAgICAgICAgY29uc3QgcGF0aCA9IGVuY29kZURvY0lkKGRvYy5faWQpICsgJy8nICsgZW5jb2RlQXR0YWNobWVudElkKGZpbGVuYW1lKSArXG4gICAgICAgICAgICAnP3Jldj0nICsgZG9jLl9yZXY7XG5cbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBvdXJGZXRjaChnZW5EQlVybChob3N0LCBwYXRoKSk7XG5cbiAgICAgICAgbGV0IGJsb2I7XG4gICAgICAgIGlmICgnYnVmZmVyJyBpbiByZXNwb25zZSkge1xuICAgICAgICAgIGJsb2IgPSBhd2FpdCByZXNwb25zZS5idWZmZXIoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgICAgIGJsb2IgPSBhd2FpdCByZXNwb25zZS5ibG9iKCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZGF0YTtcbiAgICAgICAgaWYgKG9wdHMuYmluYXJ5KSB7XG4gICAgICAgICAgY29uc3QgdHlwZUZpZWxkRGVzY3JpcHRvciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoYmxvYi5fX3Byb3RvX18sICd0eXBlJyk7XG4gICAgICAgICAgaWYgKCF0eXBlRmllbGREZXNjcmlwdG9yIHx8IHR5cGVGaWVsZERlc2NyaXB0b3Iuc2V0KSB7XG4gICAgICAgICAgICBibG9iLnR5cGUgPSBhdHQuY29udGVudF90eXBlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBkYXRhID0gYmxvYjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkYXRhID0gYXdhaXQgbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUpIHtcbiAgICAgICAgICAgIGJsdWZmZXJUb0Jhc2U2NChibG9iLCByZXNvbHZlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbGV0ZSBhdHQuc3R1YjtcbiAgICAgICAgZGVsZXRlIGF0dC5sZW5ndGg7XG4gICAgICAgIGF0dC5kYXRhID0gZGF0YTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcHJvbWlzZUZhY3RvcmllcyA9IGZpbGVuYW1lcy5tYXAoZnVuY3Rpb24gKGZpbGVuYW1lKSB7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgcmV0dXJuIGZldGNoRGF0YShmaWxlbmFtZSk7XG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgLy8gVGhpcyBsaW1pdHMgdGhlIG51bWJlciBvZiBwYXJhbGxlbCB4aHIgcmVxdWVzdHMgdG8gNSBhbnkgdGltZVxuICAgICAgLy8gdG8gYXZvaWQgaXNzdWVzIHdpdGggbWF4aW11bSBicm93c2VyIHJlcXVlc3QgbGltaXRzXG4gICAgICByZXR1cm4gcG9vbChwcm9taXNlRmFjdG9yaWVzLCA1KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBmZXRjaEFsbEF0dGFjaG1lbnRzKGRvY09yRG9jcykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZG9jT3JEb2NzKSkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoZG9jT3JEb2NzLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgaWYgKGRvYy5vaykge1xuICAgICAgICAgICAgcmV0dXJuIGZldGNoQXR0YWNobWVudHMoZG9jLm9rKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmZXRjaEF0dGFjaG1lbnRzKGRvY09yRG9jcyk7XG4gICAgfVxuXG4gICAgY29uc3QgdXJsID0gZ2VuREJVcmwoaG9zdCwgaWQgKyBwYXJhbXNUb1N0cihwYXJhbXMpKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2hKU09OKHVybCk7XG4gICAgICBpZiAob3B0cy5hdHRhY2htZW50cykge1xuICAgICAgICBhd2FpdCBmZXRjaEFsbEF0dGFjaG1lbnRzKHJlcy5kYXRhKTtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlcy5kYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgZXJyb3IuZG9jSWQgPSBpZDtcbiAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG5cbiAgLy8gRGVsZXRlIHRoZSBkb2N1bWVudCBnaXZlbiBieSBkb2MgZnJvbSB0aGUgZGF0YWJhc2UgZ2l2ZW4gYnkgaG9zdC5cbiAgYXBpLnJlbW92ZSA9IGFkYXB0ZXJGdW4oJ3JlbW92ZScsIGFzeW5jIGZ1bmN0aW9uIChkb2NPcklkLCBvcHRzT3JSZXYsIG9wdHMsIGNiKSB7XG4gICAgbGV0IGRvYztcbiAgICBpZiAodHlwZW9mIG9wdHNPclJldiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIGlkLCByZXYsIG9wdHMsIGNhbGxiYWNrIHN0eWxlXG4gICAgICBkb2MgPSB7XG4gICAgICAgIF9pZDogZG9jT3JJZCxcbiAgICAgICAgX3Jldjogb3B0c09yUmV2XG4gICAgICB9O1xuICAgICAgaWYgKHR5cGVvZiBvcHRzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgb3B0cyA9IHt9O1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBkb2MsIG9wdHMsIGNhbGxiYWNrIHN0eWxlXG4gICAgICBkb2MgPSBkb2NPcklkO1xuICAgICAgaWYgKHR5cGVvZiBvcHRzT3JSZXYgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgY2IgPSBvcHRzT3JSZXY7XG4gICAgICAgIG9wdHMgPSB7fTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNiID0gb3B0cztcbiAgICAgICAgb3B0cyA9IG9wdHNPclJldjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXYgPSAoZG9jLl9yZXYgfHwgb3B0cy5yZXYpO1xuICAgIGNvbnN0IHVybCA9IGdlbkRCVXJsKGhvc3QsIGVuY29kZURvY0lkKGRvYy5faWQpKSArICc/cmV2PScgKyByZXY7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2hKU09OKHVybCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgICAgIGNiKG51bGwsIHJlc3VsdC5kYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2IoZXJyb3IpO1xuICAgIH1cbiAgfSk7XG5cbiAgZnVuY3Rpb24gZW5jb2RlQXR0YWNobWVudElkKGF0dGFjaG1lbnRJZCkge1xuICAgIHJldHVybiBhdHRhY2htZW50SWQuc3BsaXQoXCIvXCIpLm1hcChlbmNvZGVVUklDb21wb25lbnQpLmpvaW4oXCIvXCIpO1xuICB9XG5cbiAgLy8gR2V0IHRoZSBhdHRhY2htZW50XG4gIGFwaS5nZXRBdHRhY2htZW50ID0gYWRhcHRlckZ1bignZ2V0QXR0YWNobWVudCcsIGFzeW5jIGZ1bmN0aW9uIChkb2NJZCwgYXR0YWNobWVudElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cywgY2FsbGJhY2spIHtcbiAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG4gICAgY29uc3QgcGFyYW1zID0gb3B0cy5yZXYgPyAoJz9yZXY9JyArIG9wdHMucmV2KSA6ICcnO1xuICAgIGNvbnN0IHVybCA9IGdlbkRCVXJsKGhvc3QsIGVuY29kZURvY0lkKGRvY0lkKSkgKyAnLycgK1xuICAgICAgICBlbmNvZGVBdHRhY2htZW50SWQoYXR0YWNobWVudElkKSArIHBhcmFtcztcbiAgICBsZXQgY29udGVudFR5cGU7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgb3VyRmV0Y2godXJsLCB7bWV0aG9kOiAnR0VUJ30pO1xuXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICAgIHRocm93IHJlc3BvbnNlO1xuICAgICAgfVxuXG4gICAgICBjb250ZW50VHlwZSA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdjb250ZW50LXR5cGUnKTtcbiAgICAgIGxldCBibG9iO1xuICAgICAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiAhcHJvY2Vzcy5icm93c2VyICYmIHR5cGVvZiByZXNwb25zZS5idWZmZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgYmxvYiA9IGF3YWl0IHJlc3BvbnNlLmJ1ZmZlcigpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgYmxvYiA9IGF3YWl0IHJlc3BvbnNlLmJsb2IoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVE9ETzogYWxzbyByZW1vdmVcbiAgICAgIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgIXByb2Nlc3MuYnJvd3Nlcikge1xuICAgICAgICBjb25zdCB0eXBlRmllbGREZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihibG9iLl9fcHJvdG9fXywgJ3R5cGUnKTtcbiAgICAgICAgaWYgKCF0eXBlRmllbGREZXNjcmlwdG9yIHx8IHR5cGVGaWVsZERlc2NyaXB0b3Iuc2V0KSB7XG4gICAgICAgICAgYmxvYi50eXBlID0gY29udGVudFR5cGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrKG51bGwsIGJsb2IpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY2FsbGJhY2soZXJyKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFJlbW92ZSB0aGUgYXR0YWNobWVudCBnaXZlbiBieSB0aGUgaWQgYW5kIHJldlxuICBhcGkucmVtb3ZlQXR0YWNobWVudCA9ICBhZGFwdGVyRnVuKCdyZW1vdmVBdHRhY2htZW50JywgYXN5bmMgZnVuY3Rpb24gKFxuICAgIGRvY0lkLFxuICAgIGF0dGFjaG1lbnRJZCxcbiAgICByZXYsXG4gICAgY2FsbGJhY2ssXG4gICkge1xuICAgIGNvbnN0IHVybCA9IGdlbkRCVXJsKGhvc3QsIGVuY29kZURvY0lkKGRvY0lkKSArICcvJyArIGVuY29kZUF0dGFjaG1lbnRJZChhdHRhY2htZW50SWQpKSArICc/cmV2PScgKyByZXY7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2hKU09OKHVybCwge21ldGhvZDogJ0RFTEVURSd9KTtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdC5kYXRhKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQWRkIHRoZSBhdHRhY2htZW50IGdpdmVuIGJ5IGJsb2IgYW5kIGl0cyBjb250ZW50VHlwZSBwcm9wZXJ0eVxuICAvLyB0byB0aGUgZG9jdW1lbnQgd2l0aCB0aGUgZ2l2ZW4gaWQsIHRoZSByZXZpc2lvbiBnaXZlbiBieSByZXYsIGFuZFxuICAvLyBhZGQgaXQgdG8gdGhlIGRhdGFiYXNlIGdpdmVuIGJ5IGhvc3QuXG4gIGFwaS5wdXRBdHRhY2htZW50ID0gYWRhcHRlckZ1bigncHV0QXR0YWNobWVudCcsIGFzeW5jIGZ1bmN0aW9uIChcbiAgICBkb2NJZCxcbiAgICBhdHRhY2htZW50SWQsXG4gICAgcmV2LFxuICAgIGJsb2IsXG4gICAgdHlwZSxcbiAgICBjYWxsYmFjayxcbiAgKSB7XG4gICAgaWYgKHR5cGVvZiB0eXBlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IHR5cGU7XG4gICAgICB0eXBlID0gYmxvYjtcbiAgICAgIGJsb2IgPSByZXY7XG4gICAgICByZXYgPSBudWxsO1xuICAgIH1cbiAgICBjb25zdCBpZCA9IGVuY29kZURvY0lkKGRvY0lkKSArICcvJyArIGVuY29kZUF0dGFjaG1lbnRJZChhdHRhY2htZW50SWQpO1xuICAgIGxldCB1cmwgPSBnZW5EQlVybChob3N0LCBpZCk7XG4gICAgaWYgKHJldikge1xuICAgICAgdXJsICs9ICc/cmV2PScgKyByZXY7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBibG9iID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gaW5wdXQgaXMgYXNzdW1lZCB0byBiZSBhIGJhc2U2NCBzdHJpbmdcbiAgICAgIGxldCBiaW5hcnk7XG4gICAgICB0cnkge1xuICAgICAgICBiaW5hcnkgPSBhdG9iKGJsb2IpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhjcmVhdGVFcnJvcihCQURfQVJHLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0F0dGFjaG1lbnQgaXMgbm90IGEgdmFsaWQgYmFzZTY0IHN0cmluZycpKTtcbiAgICAgIH1cbiAgICAgIGJsb2IgPSBiaW5hcnkgPyBiaW5TdHJpbmdUb0JsdWZmZXIoYmluYXJ5LCB0eXBlKSA6ICcnO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICAvLyBBZGQgdGhlIGF0dGFjaG1lbnRcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTih1cmwsIHtcbiAgICAgICAgaGVhZGVyczogbmV3IEhlYWRlcnMoeydDb250ZW50LVR5cGUnOiB0eXBlfSksXG4gICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgIGJvZHk6IGJsb2JcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICAvLyBVcGRhdGUvY3JlYXRlIG11bHRpcGxlIGRvY3VtZW50cyBnaXZlbiBieSByZXEgaW4gdGhlIGRhdGFiYXNlXG4gIC8vIGdpdmVuIGJ5IGhvc3QuXG4gIGFwaS5fYnVsa0RvY3MgPSBhc3luYyBmdW5jdGlvbiAocmVxLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIC8vIElmIG5ld19lZGl0cz1mYWxzZSB0aGVuIGl0IHByZXZlbnRzIHRoZSBkYXRhYmFzZSBmcm9tIGNyZWF0aW5nXG4gICAgLy8gbmV3IHJldmlzaW9uIG51bWJlcnMgZm9yIHRoZSBkb2N1bWVudHMuIEluc3RlYWQgaXQganVzdCB1c2VzXG4gICAgLy8gdGhlIG9sZCBvbmVzLiBUaGlzIGlzIHVzZWQgaW4gZGF0YWJhc2UgcmVwbGljYXRpb24uXG4gICAgcmVxLm5ld19lZGl0cyA9IG9wdHMubmV3X2VkaXRzO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNldHVwKCk7XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChyZXEuZG9jcy5tYXAocHJlcHJvY2Vzc0F0dGFjaG1lbnRzKSk7XG5cbiAgICAgIC8vIFVwZGF0ZS9jcmVhdGUgdGhlIGRvY3VtZW50c1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2hKU09OKGdlbkRCVXJsKGhvc3QsICdfYnVsa19kb2NzJyksIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcSlcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIC8vIFVwZGF0ZS9jcmVhdGUgZG9jdW1lbnRcbiAgYXBpLl9wdXQgPSBhc3luYyBmdW5jdGlvbiAoZG9jLCBvcHRzLCBjYWxsYmFjaykge1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBzZXR1cCgpO1xuICAgICAgYXdhaXQgcHJlcHJvY2Vzc0F0dGFjaG1lbnRzKGRvYyk7XG5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTihnZW5EQlVybChob3N0LCBlbmNvZGVEb2NJZChkb2MuX2lkKSksIHtcbiAgICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoZG9jKVxuICAgICAgfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGVycm9yLmRvY0lkID0gZG9jICYmIGRvYy5faWQ7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9O1xuXG5cbiAgLy8gR2V0IGEgbGlzdGluZyBvZiB0aGUgZG9jdW1lbnRzIGluIHRoZSBkYXRhYmFzZSBnaXZlblxuICAvLyBieSBob3N0IGFuZCBvcmRlcmVkIGJ5IGluY3JlYXNpbmcgaWQuXG4gIGFwaS5hbGxEb2NzID0gYWRhcHRlckZ1bignYWxsRG9jcycsIGFzeW5jIGZ1bmN0aW9uIChvcHRzLCBjYWxsYmFjaykge1xuICAgIGlmICh0eXBlb2Ygb3B0cyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRzO1xuICAgICAgb3B0cyA9IHt9O1xuICAgIH1cbiAgICBvcHRzID0gY2xvbmUob3B0cyk7XG5cbiAgICAvLyBMaXN0IG9mIHBhcmFtZXRlcnMgdG8gYWRkIHRvIHRoZSBHRVQgcmVxdWVzdFxuICAgIGNvbnN0IHBhcmFtcyA9IHt9O1xuICAgIGxldCBib2R5O1xuICAgIGxldCBtZXRob2QgPSAnR0VUJztcblxuICAgIGlmIChvcHRzLmNvbmZsaWN0cykge1xuICAgICAgcGFyYW1zLmNvbmZsaWN0cyA9IHRydWU7XG4gICAgfVxuXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKG9wdHMudXBkYXRlX3NlcSkge1xuICAgICAgcGFyYW1zLnVwZGF0ZV9zZXEgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAgIHBhcmFtcy5kZXNjZW5kaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5pbmNsdWRlX2RvY3MpIHtcbiAgICAgIHBhcmFtcy5pbmNsdWRlX2RvY3MgPSB0cnVlO1xuICAgIH1cblxuICAgIC8vIGFkZGVkIGluIENvdWNoREIgMS42LjBcbiAgICBpZiAob3B0cy5hdHRhY2htZW50cykge1xuICAgICAgcGFyYW1zLmF0dGFjaG1lbnRzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5rZXkpIHtcbiAgICAgIHBhcmFtcy5rZXkgPSBKU09OLnN0cmluZ2lmeShvcHRzLmtleSk7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuc3RhcnRfa2V5KSB7XG4gICAgICBvcHRzLnN0YXJ0a2V5ID0gb3B0cy5zdGFydF9rZXk7XG4gICAgfVxuXG4gICAgaWYgKG9wdHMuc3RhcnRrZXkpIHtcbiAgICAgIHBhcmFtcy5zdGFydGtleSA9IEpTT04uc3RyaW5naWZ5KG9wdHMuc3RhcnRrZXkpO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmVuZF9rZXkpIHtcbiAgICAgIG9wdHMuZW5ka2V5ID0gb3B0cy5lbmRfa2V5O1xuICAgIH1cblxuICAgIGlmIChvcHRzLmVuZGtleSkge1xuICAgICAgcGFyYW1zLmVuZGtleSA9IEpTT04uc3RyaW5naWZ5KG9wdHMuZW5ka2V5KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdHMuaW5jbHVzaXZlX2VuZCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHBhcmFtcy5pbmNsdXNpdmVfZW5kID0gISFvcHRzLmluY2x1c2l2ZV9lbmQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBvcHRzLmxpbWl0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgcGFyYW1zLmxpbWl0ID0gb3B0cy5saW1pdDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIG9wdHMuc2tpcCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHBhcmFtcy5za2lwID0gb3B0cy5za2lwO1xuICAgIH1cblxuICAgIGNvbnN0IHBhcmFtU3RyID0gcGFyYW1zVG9TdHIocGFyYW1zKTtcblxuICAgIGlmICh0eXBlb2Ygb3B0cy5rZXlzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgbWV0aG9kID0gJ1BPU1QnO1xuICAgICAgYm9keSA9IHtrZXlzOiBvcHRzLmtleXN9O1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBmZXRjaEpTT04oZ2VuREJVcmwoaG9zdCwgJ19hbGxfZG9jcycgKyBwYXJhbVN0ciksIHtcbiAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpXG4gICAgICB9KTtcbiAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcyAmJiBvcHRzLmF0dGFjaG1lbnRzICYmIG9wdHMuYmluYXJ5KSB7XG4gICAgICAgIHJlc3VsdC5kYXRhLnJvd3MuZm9yRWFjaChyZWFkQXR0YWNobWVudHNBc0Jsb2JPckJ1ZmZlcik7XG4gICAgICB9XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQuZGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIEdldCBhIGxpc3Qgb2YgY2hhbmdlcyBtYWRlIHRvIGRvY3VtZW50cyBpbiB0aGUgZGF0YWJhc2UgZ2l2ZW4gYnkgaG9zdC5cbiAgLy8gVE9ETyBBY2NvcmRpbmcgdG8gdGhlIFJFQURNRSwgdGhlcmUgc2hvdWxkIGJlIHR3byBvdGhlciBtZXRob2RzIGhlcmUsXG4gIC8vIGFwaS5jaGFuZ2VzLmFkZExpc3RlbmVyIGFuZCBhcGkuY2hhbmdlcy5yZW1vdmVMaXN0ZW5lci5cbiAgYXBpLl9jaGFuZ2VzID0gZnVuY3Rpb24gKG9wdHMpIHtcblxuICAgIC8vIFdlIGludGVybmFsbHkgcGFnZSB0aGUgcmVzdWx0cyBvZiBhIGNoYW5nZXMgcmVxdWVzdCwgdGhpcyBtZWFuc1xuICAgIC8vIGlmIHRoZXJlIGlzIGEgbGFyZ2Ugc2V0IG9mIGNoYW5nZXMgdG8gYmUgcmV0dXJuZWQgd2UgY2FuIHN0YXJ0XG4gICAgLy8gcHJvY2Vzc2luZyB0aGVtIHF1aWNrZXIgaW5zdGVhZCBvZiB3YWl0aW5nIG9uIHRoZSBlbnRpcmVcbiAgICAvLyBzZXQgb2YgY2hhbmdlcyB0byByZXR1cm4gYW5kIGF0dGVtcHRpbmcgdG8gcHJvY2VzcyB0aGVtIGF0IG9uY2VcbiAgICBjb25zdCBiYXRjaFNpemUgPSAnYmF0Y2hfc2l6ZScgaW4gb3B0cyA/IG9wdHMuYmF0Y2hfc2l6ZSA6IENIQU5HRVNfQkFUQ0hfU0laRTtcblxuICAgIG9wdHMgPSBjbG9uZShvcHRzKTtcblxuICAgIGlmIChvcHRzLmNvbnRpbnVvdXMgJiYgISgnaGVhcnRiZWF0JyBpbiBvcHRzKSkge1xuICAgICAgb3B0cy5oZWFydGJlYXQgPSBERUZBVUxUX0hFQVJUQkVBVDtcbiAgICB9XG5cbiAgICBsZXQgcmVxdWVzdFRpbWVvdXQgPSAoJ3RpbWVvdXQnIGluIG9wdHMpID8gb3B0cy50aW1lb3V0IDogMzAgKiAxMDAwO1xuXG4gICAgLy8gZW5zdXJlIENIQU5HRVNfVElNRU9VVF9CVUZGRVIgYXBwbGllc1xuICAgIGlmICgndGltZW91dCcgaW4gb3B0cyAmJiBvcHRzLnRpbWVvdXQgJiZcbiAgICAgIChyZXF1ZXN0VGltZW91dCAtIG9wdHMudGltZW91dCkgPCBDSEFOR0VTX1RJTUVPVVRfQlVGRkVSKSB7XG4gICAgICAgIHJlcXVlc3RUaW1lb3V0ID0gb3B0cy50aW1lb3V0ICsgQ0hBTkdFU19USU1FT1VUX0JVRkZFUjtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoJ2hlYXJ0YmVhdCcgaW4gb3B0cyAmJiBvcHRzLmhlYXJ0YmVhdCAmJlxuICAgICAgIChyZXF1ZXN0VGltZW91dCAtIG9wdHMuaGVhcnRiZWF0KSA8IENIQU5HRVNfVElNRU9VVF9CVUZGRVIpIHtcbiAgICAgICAgcmVxdWVzdFRpbWVvdXQgPSBvcHRzLmhlYXJ0YmVhdCArIENIQU5HRVNfVElNRU9VVF9CVUZGRVI7XG4gICAgfVxuXG4gICAgY29uc3QgcGFyYW1zID0ge307XG4gICAgaWYgKCd0aW1lb3V0JyBpbiBvcHRzICYmIG9wdHMudGltZW91dCkge1xuICAgICAgcGFyYW1zLnRpbWVvdXQgPSBvcHRzLnRpbWVvdXQ7XG4gICAgfVxuXG4gICAgY29uc3QgbGltaXQgPSAodHlwZW9mIG9wdHMubGltaXQgIT09ICd1bmRlZmluZWQnKSA/IG9wdHMubGltaXQgOiBmYWxzZTtcbiAgICBsZXQgbGVmdFRvRmV0Y2ggPSBsaW1pdDtcblxuICAgIGlmIChvcHRzLnN0eWxlKSB7XG4gICAgICBwYXJhbXMuc3R5bGUgPSBvcHRzLnN0eWxlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcyB8fCBvcHRzLmZpbHRlciAmJiB0eXBlb2Ygb3B0cy5maWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHBhcmFtcy5pbmNsdWRlX2RvY3MgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmF0dGFjaG1lbnRzKSB7XG4gICAgICBwYXJhbXMuYXR0YWNobWVudHMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmNvbnRpbnVvdXMpIHtcbiAgICAgIHBhcmFtcy5mZWVkID0gJ2xvbmdwb2xsJztcbiAgICB9XG5cbiAgICBpZiAob3B0cy5zZXFfaW50ZXJ2YWwpIHtcbiAgICAgIHBhcmFtcy5zZXFfaW50ZXJ2YWwgPSBvcHRzLnNlcV9pbnRlcnZhbDtcbiAgICB9XG5cbiAgICBpZiAob3B0cy5jb25mbGljdHMpIHtcbiAgICAgIHBhcmFtcy5jb25mbGljdHMgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmIChvcHRzLmRlc2NlbmRpbmcpIHtcbiAgICAgIHBhcmFtcy5kZXNjZW5kaW5nID0gdHJ1ZTtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAob3B0cy51cGRhdGVfc2VxKSB7XG4gICAgICBwYXJhbXMudXBkYXRlX3NlcSA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKCdoZWFydGJlYXQnIGluIG9wdHMpIHtcbiAgICAgIC8vIElmIHRoZSBoZWFydGJlYXQgdmFsdWUgaXMgZmFsc2UsIGl0IGRpc2FibGVzIHRoZSBkZWZhdWx0IGhlYXJ0YmVhdFxuICAgICAgaWYgKG9wdHMuaGVhcnRiZWF0KSB7XG4gICAgICAgIHBhcmFtcy5oZWFydGJlYXQgPSBvcHRzLmhlYXJ0YmVhdDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAob3B0cy5maWx0ZXIgJiYgdHlwZW9mIG9wdHMuZmlsdGVyID09PSAnc3RyaW5nJykge1xuICAgICAgcGFyYW1zLmZpbHRlciA9IG9wdHMuZmlsdGVyO1xuICAgIH1cblxuICAgIGlmIChvcHRzLnZpZXcgJiYgdHlwZW9mIG9wdHMudmlldyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHBhcmFtcy5maWx0ZXIgPSAnX3ZpZXcnO1xuICAgICAgcGFyYW1zLnZpZXcgPSBvcHRzLnZpZXc7XG4gICAgfVxuXG4gICAgLy8gSWYgb3B0cy5xdWVyeV9wYXJhbXMgZXhpc3RzLCBwYXNzIGl0IHRocm91Z2ggdG8gdGhlIGNoYW5nZXMgcmVxdWVzdC5cbiAgICAvLyBUaGVzZSBwYXJhbWV0ZXJzIG1heSBiZSB1c2VkIGJ5IHRoZSBmaWx0ZXIgb24gdGhlIHNvdXJjZSBkYXRhYmFzZS5cbiAgICBpZiAob3B0cy5xdWVyeV9wYXJhbXMgJiYgdHlwZW9mIG9wdHMucXVlcnlfcGFyYW1zID09PSAnb2JqZWN0Jykge1xuICAgICAgZm9yIChjb25zdCBwYXJhbV9uYW1lIGluIG9wdHMucXVlcnlfcGFyYW1zKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob3B0cy5xdWVyeV9wYXJhbXMsIHBhcmFtX25hbWUpKSB7XG4gICAgICAgICAgcGFyYW1zW3BhcmFtX25hbWVdID0gb3B0cy5xdWVyeV9wYXJhbXNbcGFyYW1fbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgbWV0aG9kID0gJ0dFVCc7XG4gICAgbGV0IGJvZHk7XG5cbiAgICBpZiAob3B0cy5kb2NfaWRzKSB7XG4gICAgICAvLyBzZXQgdGhpcyBhdXRvbWFnaWNhbGx5IGZvciB0aGUgdXNlcjsgaXQncyBhbm5veWluZyB0aGF0IGNvdWNoZGJcbiAgICAgIC8vIHJlcXVpcmVzIGJvdGggYSBcImZpbHRlclwiIGFuZCBhIFwiZG9jX2lkc1wiIHBhcmFtLlxuICAgICAgcGFyYW1zLmZpbHRlciA9ICdfZG9jX2lkcyc7XG4gICAgICBtZXRob2QgPSAnUE9TVCc7XG4gICAgICBib2R5ID0ge2RvY19pZHM6IG9wdHMuZG9jX2lkcyB9O1xuICAgIH1cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGVsc2UgaWYgKG9wdHMuc2VsZWN0b3IpIHtcbiAgICAgIC8vIHNldCB0aGlzIGF1dG9tYWdpY2FsbHkgZm9yIHRoZSB1c2VyLCBzaW1pbGFyIHRvIGFib3ZlXG4gICAgICBwYXJhbXMuZmlsdGVyID0gJ19zZWxlY3Rvcic7XG4gICAgICBtZXRob2QgPSAnUE9TVCc7XG4gICAgICBib2R5ID0ge3NlbGVjdG9yOiBvcHRzLnNlbGVjdG9yIH07XG4gICAgfVxuXG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBsZXQgbGFzdEZldGNoZWRTZXE7XG5cbiAgICAvLyBHZXQgYWxsIHRoZSBjaGFuZ2VzIHN0YXJ0aW5nIHd0aWggdGhlIG9uZSBpbW1lZGlhdGVseSBhZnRlciB0aGVcbiAgICAvLyBzZXF1ZW5jZSBudW1iZXIgZ2l2ZW4gYnkgc2luY2UuXG4gICAgY29uc3QgZmV0Y2hEYXRhID0gYXN5bmMgZnVuY3Rpb24gKHNpbmNlLCBjYWxsYmFjaykge1xuICAgICAgaWYgKG9wdHMuYWJvcnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBwYXJhbXMuc2luY2UgPSBzaW5jZTtcbiAgICAgIC8vIFwic2luY2VcIiBjYW4gYmUgYW55IGtpbmQgb2YganNvbiBvYmplY3QgaW4gQ2xvdWRhbnQvQ291Y2hEQiAyLnhcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICBpZiAodHlwZW9mIHBhcmFtcy5zaW5jZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBwYXJhbXMuc2luY2UgPSBKU09OLnN0cmluZ2lmeShwYXJhbXMuc2luY2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAob3B0cy5kZXNjZW5kaW5nKSB7XG4gICAgICAgIGlmIChsaW1pdCkge1xuICAgICAgICAgIHBhcmFtcy5saW1pdCA9IGxlZnRUb0ZldGNoO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJhbXMubGltaXQgPSAoIWxpbWl0IHx8IGxlZnRUb0ZldGNoID4gYmF0Y2hTaXplKSA/XG4gICAgICAgICAgYmF0Y2hTaXplIDogbGVmdFRvRmV0Y2g7XG4gICAgICB9XG5cbiAgICAgIC8vIFNldCB0aGUgb3B0aW9ucyBmb3IgdGhlIGFqYXggY2FsbFxuICAgICAgY29uc3QgdXJsID0gZ2VuREJVcmwoaG9zdCwgJ19jaGFuZ2VzJyArIHBhcmFtc1RvU3RyKHBhcmFtcykpO1xuICAgICAgY29uc3QgZmV0Y2hPcHRzID0ge1xuICAgICAgICBzaWduYWw6IGNvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSlcbiAgICAgIH07XG4gICAgICBsYXN0RmV0Y2hlZFNlcSA9IHNpbmNlO1xuXG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChvcHRzLmFib3J0ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIGNoYW5nZXNcbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHNldHVwKCk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoSlNPTih1cmwsIGZldGNoT3B0cyk7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdC5kYXRhKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gSWYgb3B0cy5zaW5jZSBleGlzdHMsIGdldCBhbGwgdGhlIGNoYW5nZXMgZnJvbSB0aGUgc2VxdWVuY2VcbiAgICAvLyBudW1iZXIgZ2l2ZW4gYnkgb3B0cy5zaW5jZS4gT3RoZXJ3aXNlLCBnZXQgYWxsIHRoZSBjaGFuZ2VzXG4gICAgLy8gZnJvbSB0aGUgc2VxdWVuY2UgbnVtYmVyIDAuXG4gICAgY29uc3QgcmVzdWx0cyA9IHtyZXN1bHRzOiBbXX07XG5cbiAgICBjb25zdCBmZXRjaGVkID0gZnVuY3Rpb24gKGVyciwgcmVzKSB7XG4gICAgICBpZiAob3B0cy5hYm9ydGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGxldCByYXdfcmVzdWx0c19sZW5ndGggPSAwO1xuICAgICAgLy8gSWYgdGhlIHJlc3VsdCBvZiB0aGUgYWpheCBjYWxsIChyZXMpIGNvbnRhaW5zIGNoYW5nZXMgKHJlcy5yZXN1bHRzKVxuICAgICAgaWYgKHJlcyAmJiByZXMucmVzdWx0cykge1xuICAgICAgICByYXdfcmVzdWx0c19sZW5ndGggPSByZXMucmVzdWx0cy5sZW5ndGg7XG4gICAgICAgIHJlc3VsdHMubGFzdF9zZXEgPSByZXMubGFzdF9zZXE7XG4gICAgICAgIGxldCBwZW5kaW5nID0gbnVsbDtcbiAgICAgICAgbGV0IGxhc3RTZXEgPSBudWxsO1xuICAgICAgICAvLyBBdHRhY2ggJ3BlbmRpbmcnIHByb3BlcnR5IGlmIHNlcnZlciBzdXBwb3J0cyBpdCAoQ291Y2hEQiAyLjArKVxuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKHR5cGVvZiByZXMucGVuZGluZyA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBwZW5kaW5nID0gcmVzLnBlbmRpbmc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiByZXN1bHRzLmxhc3Rfc2VxID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgcmVzdWx0cy5sYXN0X3NlcSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgICBsYXN0U2VxID0gcmVzdWx0cy5sYXN0X3NlcTtcbiAgICAgICAgfVxuICAgICAgICAvLyBGb3IgZWFjaCBjaGFuZ2VcbiAgICAgICAgY29uc3QgcmVxID0ge307XG4gICAgICAgIHJlcS5xdWVyeSA9IG9wdHMucXVlcnlfcGFyYW1zO1xuICAgICAgICByZXMucmVzdWx0cyA9IHJlcy5yZXN1bHRzLmZpbHRlcihmdW5jdGlvbiAoYykge1xuICAgICAgICAgIGxlZnRUb0ZldGNoLS07XG4gICAgICAgICAgY29uc3QgcmV0ID0gZmlsdGVyQ2hhbmdlKG9wdHMpKGMpO1xuICAgICAgICAgIGlmIChyZXQpIHtcbiAgICAgICAgICAgIGlmIChvcHRzLmluY2x1ZGVfZG9jcyAmJiBvcHRzLmF0dGFjaG1lbnRzICYmIG9wdHMuYmluYXJ5KSB7XG4gICAgICAgICAgICAgIHJlYWRBdHRhY2htZW50c0FzQmxvYk9yQnVmZmVyKGMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG9wdHMucmV0dXJuX2RvY3MpIHtcbiAgICAgICAgICAgICAgcmVzdWx0cy5yZXN1bHRzLnB1c2goYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvcHRzLm9uQ2hhbmdlKGMsIHBlbmRpbmcsIGxhc3RTZXEpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmV0O1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoZXJyKSB7XG4gICAgICAgIC8vIEluIGNhc2Ugb2YgYW4gZXJyb3IsIHN0b3AgbGlzdGVuaW5nIGZvciBjaGFuZ2VzIGFuZCBjYWxsXG4gICAgICAgIC8vIG9wdHMuY29tcGxldGVcbiAgICAgICAgb3B0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgICAgb3B0cy5jb21wbGV0ZShlcnIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIFRoZSBjaGFuZ2VzIGZlZWQgbWF5IGhhdmUgdGltZWQgb3V0IHdpdGggbm8gcmVzdWx0c1xuICAgICAgLy8gaWYgc28gcmV1c2UgbGFzdCB1cGRhdGUgc2VxdWVuY2VcbiAgICAgIGlmIChyZXMgJiYgcmVzLmxhc3Rfc2VxKSB7XG4gICAgICAgIGxhc3RGZXRjaGVkU2VxID0gcmVzLmxhc3Rfc2VxO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBmaW5pc2hlZCA9IChsaW1pdCAmJiBsZWZ0VG9GZXRjaCA8PSAwKSB8fFxuICAgICAgICAocmVzICYmIHJhd19yZXN1bHRzX2xlbmd0aCA8IGJhdGNoU2l6ZSkgfHxcbiAgICAgICAgKG9wdHMuZGVzY2VuZGluZyk7XG5cbiAgICAgIGlmICgob3B0cy5jb250aW51b3VzICYmICEobGltaXQgJiYgbGVmdFRvRmV0Y2ggPD0gMCkpIHx8ICFmaW5pc2hlZCkge1xuICAgICAgICAvLyBRdWV1ZSBhIGNhbGwgdG8gZmV0Y2ggYWdhaW4gd2l0aCB0aGUgbmV3ZXN0IHNlcXVlbmNlIG51bWJlclxuICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7IGZldGNoRGF0YShsYXN0RmV0Y2hlZFNlcSwgZmV0Y2hlZCk7IH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2UncmUgZG9uZSwgY2FsbCB0aGUgY2FsbGJhY2tcbiAgICAgICAgb3B0cy5jb21wbGV0ZShudWxsLCByZXN1bHRzKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgZmV0Y2hEYXRhKG9wdHMuc2luY2UgfHwgMCwgZmV0Y2hlZCk7XG5cbiAgICAvLyBSZXR1cm4gYSBtZXRob2QgdG8gY2FuY2VsIHRoaXMgbWV0aG9kIGZyb20gcHJvY2Vzc2luZyBhbnkgbW9yZVxuICAgIHJldHVybiB7XG4gICAgICBjYW5jZWw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgb3B0cy5hYm9ydGVkID0gdHJ1ZTtcbiAgICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgICAgfVxuICAgIH07XG4gIH07XG5cbiAgLy8gR2l2ZW4gYSBzZXQgb2YgZG9jdW1lbnQvcmV2aXNpb24gSURzIChnaXZlbiBieSByZXEpLCB0ZXRzIHRoZSBzdWJzZXQgb2ZcbiAgLy8gdGhvc2UgdGhhdCBkbyBOT1QgY29ycmVzcG9uZCB0byByZXZpc2lvbnMgc3RvcmVkIGluIHRoZSBkYXRhYmFzZS5cbiAgLy8gU2VlIGh0dHA6Ly93aWtpLmFwYWNoZS5vcmcvY291Y2hkYi9IdHRwUG9zdFJldnNEaWZmXG4gIGFwaS5yZXZzRGlmZiA9IGFkYXB0ZXJGdW4oJ3JldnNEaWZmJywgYXN5bmMgZnVuY3Rpb24gKHJlcSwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAvLyBJZiBubyBvcHRpb25zIHdlcmUgZ2l2ZW4sIHNldCB0aGUgY2FsbGJhY2sgdG8gYmUgdGhlIHNlY29uZCBwYXJhbWV0ZXJcbiAgICBpZiAodHlwZW9mIG9wdHMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0cztcbiAgICAgIG9wdHMgPSB7fTtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgLy8gR2V0IHRoZSBtaXNzaW5nIGRvY3VtZW50L3JldmlzaW9uIElEc1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2hKU09OKGdlbkRCVXJsKGhvc3QsICdfcmV2c19kaWZmJyksIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcSlcbiAgICAgIH0pO1xuICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0LmRhdGEpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjYWxsYmFjayhlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBhcGkuX2Nsb3NlID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgY2FsbGJhY2soKTtcbiAgfTtcblxuICBhcGkuX2Rlc3Ryb3kgPSBhc3luYyBmdW5jdGlvbiAob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICB0cnkge1xuICAgICAgY29uc3QganNvbiA9IGF3YWl0IGZldGNoSlNPTihnZW5EQlVybChob3N0LCAnJyksIHttZXRob2Q6ICdERUxFVEUnfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCBqc29uKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgaWYgKGVycm9yLnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHtvazogdHJ1ZX0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuLy8gSHR0cFBvdWNoIGlzIGEgdmFsaWQgYWRhcHRlci5cbkh0dHBQb3VjaC52YWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAoUG91Y2hEQikge1xuICBQb3VjaERCLmFkYXB0ZXIoJ2h0dHAnLCBIdHRwUG91Y2gsIGZhbHNlKTtcbiAgUG91Y2hEQi5hZGFwdGVyKCdodHRwcycsIEh0dHBQb3VjaCwgZmFsc2UpO1xufVxuIl0sIm5hbWVzIjpbImI2NFN0cmluZ1RvQmx1ZmZlciIsImJsdWZmZXJUb0Jhc2U2NCIsImJ0b2EiLCJhZGFwdGVyRnVuIiwiY29yZUFkYXB0ZXJGdW4iLCJuZXh0VGljayIsImJ1bGtHZXRTaGltIiwiYXRvYiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxFQUFFO0FBQ3ZDLEVBQUUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDaEQsSUFBSSxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDcEIsSUFBSSxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFDcEIsSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLENBQUM7QUFDakIsSUFBSSxJQUFJLEdBQUcsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7QUFDdEMsSUFBSSxJQUFJLEdBQUcsQ0FBQztBQUNaO0FBQ0EsSUFBSSxTQUFTLE9BQU8sR0FBRztBQUN2QixNQUFNLE9BQU8sRUFBRSxDQUFDO0FBQ2hCLE1BQU0sZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDN0QsS0FBSztBQUNMO0FBQ0EsSUFBSSxTQUFTLE1BQU0sR0FBRztBQUN0QixNQUFNLElBQUksRUFBRSxJQUFJLEtBQUssR0FBRyxFQUFFO0FBQzFCO0FBQ0EsUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUNqQixVQUFVLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN0QixTQUFTLE1BQU07QUFDZixVQUFVLE9BQU8sRUFBRSxDQUFDO0FBQ3BCLFNBQVM7QUFDVCxPQUFPLE1BQU07QUFDYixRQUFRLFlBQVksRUFBRSxDQUFDO0FBQ3ZCLE9BQU87QUFDUCxLQUFLO0FBQ0w7QUFDQSxJ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
