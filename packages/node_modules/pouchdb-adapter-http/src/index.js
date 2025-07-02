'use strict';

import pool from './promise-pool';

import { fetch, Headers } from 'pouchdb-fetch';

import {
  createError,
  BAD_ARG,
  generateErrorFromResponse
} from 'pouchdb-errors';

import {
  pick,
  filterChange,
  adapterFun as coreAdapterFun,
  explainError,
  clone,
  bulkGetShim,
  nextTick
} from 'pouchdb-utils';

import {
  atob,
  btoa,
  binaryStringToBlobOrBuffer as binStringToBluffer,
  base64StringToBlobOrBuffer as b64StringToBluffer,
  blobOrBufferToBase64 as blufferToBase64
} from 'pouchdb-binary-utils';

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
    att.data = b64StringToBluffer(att.data, att.content_type);
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
        blufferToBase64(attachment.data, resolve);
      }).then(function (b64) {
        attachment.data = b64;
      });
    }
  }));
}

function hasUrlPrefix(prefix) {
  if (!prefix) {
    return false;
  }

  const url = URL.parse(prefix);
  return url && (url.protocol === 'http:' || url.protocol === 'https:');
}

// Get all the information you possibly can about the URI given by name and
// return it as a suitable object.
function getHost({ name, prefix }) {
  // encode db name if opts.prefix is a url (#5574)
  if (hasUrlPrefix(prefix)) {
    const dbName = name.substr(prefix.length);
    // Ensure prefix has a trailing slash
    name = prefix.replace(/\/?$/, '/') + encodeURIComponent(dbName);
  }

  const url = URL.parse(name);
  if (!url) {
    return {};
  }

  const host = {
    protocol: url.protocol.replace(/:$/, ''),
    host: url.hostname,
    port: url.port,
  };

  if (url.user || url.password) {
    host.auth = {username: url.username, password: url.password};
  }

  // Split the path part of the URI into parts using '/' as the delimiter
  // after removing any leading '/' and any trailing '/'
  const parts = url.pathname.replace(/(^\/|\/$)/g, '').split('/');

  host.db = parts.pop();
  // Prevent double encoding of URI component
  if (host.db.indexOf('%') === -1) {
    host.db = encodeURIComponent(host.db);
  }

  host.path = parts.join('/');

  return host;
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

  const host = getHost(opts);
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

  function adapterFun(name, fun) {
    return coreAdapterFun(name, function (...args) {
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

  nextTick(function () {
    callback(null, api);
  });

  api._remote = true;

  /* istanbul ignore next */
  api.type = function () {
    return 'http';
  };

  api.id = adapterFun('id', async function (callback) {
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
  api.compact = adapterFun('compact', async function (opts, callback) {
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

  api.bulkGet = coreAdapterFun('bulkGet', function (opts, callback) {
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
            callback(null, {results: results.flat()});
          }
        };
      }

      for (let i = 0; i < numBatches; i++) {
        const subOpts = pick(opts, ['revs', 'attachments', 'binary', 'latest']);
        subOpts.docs = opts.docs.slice(i * batchSize,
          Math.min(opts.docs.length, (i + 1) * batchSize));
        bulkGetShim(self, subOpts, onResult(i));
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
  api.get = adapterFun('get', async function (id, opts, callback) {
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
            blufferToBase64(blob, resolve);
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
  api.remove = adapterFun('remove', async function (docOrId, optsOrRev, opts, cb) {
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
  api.getAttachment = adapterFun('getAttachment', async function (docId, attachmentId,
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
  api.removeAttachment =  adapterFun('removeAttachment', async function (
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
  api.putAttachment = adapterFun('putAttachment', async function (
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
  api.allDocs = adapterFun('allDocs', async function (opts, callback) {
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
        method,
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

    // Get all the changes starting with the one immediately after the
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
        method,
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
        // For each change
        const req = {};
        req.query = opts.query_params;
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
        nextTick(function () { fetchData(lastFetchedSeq, fetched); });
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
  api.revsDiff = adapterFun('revsDiff', async function (req, opts, callback) {
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

export default function (PouchDB) {
  PouchDB.adapter('http', HttpPouch, false);
  PouchDB.adapter('https', HttpPouch, false);
}
