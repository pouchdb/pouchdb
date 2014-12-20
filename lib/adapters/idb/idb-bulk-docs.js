'use strict';

var utils = require('../../utils');
var idbUtils = require('./idb-utils');
var idbConstants = require('./idb-constants');

var ATTACH_AND_SEQ_STORE = idbConstants.ATTACH_AND_SEQ_STORE;
var ATTACH_STORE = idbConstants.ATTACH_STORE;
var BY_SEQ_STORE = idbConstants.BY_SEQ_STORE;
var DOC_STORE = idbConstants.DOC_STORE;
var LOCAL_STORE = idbConstants.LOCAL_STORE;
var META_STORE = idbConstants.META_STORE;

var compactRevs = idbUtils.compactRevs;
var decodeMetadata = idbUtils.decodeMetadata;
var encodeMetadata = idbUtils.encodeMetadata;
var idbError = idbUtils.idbError;

function IdbBulkDocs(req, opts, api, idb, Changes, callback) {
  this.req = req;
  this.opts = opts;
  this.api = api;
  this.idb = idb;
  this.Changes = Changes;
  this.callback = callback;
  this.init();
}

IdbBulkDocs.prototype.init = function () {
  var self = this;

  self.docInfos = self.req.docs;

  var docInfoError;

  for (var i = 0, len = self.docInfos.length; i < len; i++) {
    var doc = self.docInfos[i];
    if (doc._id && utils.isLocalId(doc._id)) {
      continue;
    }
    doc = self.docInfos[i] = utils.parseDoc(doc, self.opts.new_edits);
    if (doc.error && !docInfoError) {
      docInfoError = doc;
    }
  }

  if (docInfoError) {
    return self.callback(docInfoError);
  }

  self.results = new Array(self.docInfos.length);
  self.fetchedDocs = new utils.Map();
  self.preconditionErrored = false;
  self.blobType = self.api._blobSupport ? 'blob' : 'base64';

  utils.preprocessAttachments(self.docInfos, self.blobType, function (err) {
    if (err) {
      return self.callback(err);
    }
    self.startTransaction();
  });
};

IdbBulkDocs.prototype.startTransaction = function () {
  var self = this;

  var stores = [
    DOC_STORE, BY_SEQ_STORE,
    ATTACH_STORE, META_STORE,
    LOCAL_STORE, ATTACH_AND_SEQ_STORE
  ];
  var txn = self.idb.transaction(stores, 'readwrite');
  txn.onerror = idbError(self.callback);
  txn.ontimeout = idbError(self.callback);
  txn.oncomplete = self.complete.bind(self);
  self.txn = txn;
  self.attachStore = txn.objectStore(ATTACH_STORE);
  self.docStore = txn.objectStore(DOC_STORE);
  self.bySeqStore = txn.objectStore(BY_SEQ_STORE);
  self.attachStore = txn.objectStore(ATTACH_STORE);
  self.attachAndSeqStore = txn.objectStore(ATTACH_AND_SEQ_STORE);

  self.verifyAttachments(function (err) {
    if (err) {
      self.preconditionErrored = true;
      return self.callback(err);
    }
    self.fetchExistingDocs();
  });
};

IdbBulkDocs.prototype.processDocs = function () {
  var self = this;

  utils.processDocs(self.docInfos, self.api, self.fetchedDocs,
    self.txn, self.results, self.writeDoc.bind(self), self.opts);
};

IdbBulkDocs.prototype.fetchExistingDocs = function () {
  var self = this;

  if (!self.docInfos.length) {
    return;
  }

  var numFetched = 0;

  function checkDone() {
    if (++numFetched === self.docInfos.length) {
      self.processDocs();
    }
  }

  function readMetadata(event) {
    var metadata = decodeMetadata(event.target.result);

    if (metadata) {
      self.fetchedDocs.set(metadata.id, metadata);
    }
    checkDone();
  }

  for (var i = 0, len = self.docInfos.length; i < len; i++) {
    var docInfo = self.docInfos[i];
    if (docInfo._id && utils.isLocalId(docInfo._id)) {
      checkDone(); // skip local docs
      continue;
    }
    var req = self.docStore.get(docInfo.metadata.id);
    req.onsuccess = readMetadata;
  }
};

IdbBulkDocs.prototype.complete = function () {
  var self = this;

  if (self.preconditionErrored) {
    return;
  }

  for (var i = 0, len = self.results.length; i < len; i++) {
    var result = self.results[i];
    if (!result.error) {
      // TODO: this should be set in utils.processDocs
      // for local docs
      result.ok = true;
    }
  }

  self.Changes.notify(self.api._name);
  self.api._docCount = -1; // invalidate
  self.callback(null, self.results);
};

IdbBulkDocs.prototype.verifyAttachment = function (digest, callback) {
  var self = this;

  var req = self.attachStore.get(digest);
  req.onsuccess = function (e) {
    if (!e.target.result) {
      var err = new Error('unknown stub attachment with digest ' + digest);
      err.status = 412;
      callback(err);
    } else {
      callback();
    }
  };
};

IdbBulkDocs.prototype.verifyAttachments = function (finish) {
  var self = this;

  var digests = [];
  self.docInfos.forEach(function (docInfo) {
    if (docInfo.data && docInfo.data._attachments) {
      Object.keys(docInfo.data._attachments).forEach(function (filename) {
        var att = docInfo.data._attachments[filename];
        if (att.stub) {
          digests.push(att.digest);
        }
      });
    }
  });
  if (!digests.length) {
    return finish();
  }
  var numDone = 0;
  var err;

  function checkDone() {
    if (++numDone === digests.length) {
      finish(err);
    }
  }
  digests.forEach(function (digest) {
    self.verifyAttachment(digest, function (attErr) {
      if (attErr && !err) {
        err = attErr;
      }
      checkDone();
    });
  });
};

IdbBulkDocs.prototype.writeDoc = function (docInfo, winningRev, deleted,
                                           callback, isUpdate, resultsIdx) {
  var self = this;

  var doc = docInfo.data;
  doc._id = docInfo.metadata.id;
  doc._rev = docInfo.metadata.rev;

  if (deleted) {
    doc._deleted = true;
  }

  var hasAttachments = doc._attachments && Object.keys(doc._attachments).length;
  if (hasAttachments) {
    return self.writeAttachments(docInfo, winningRev, deleted,
      callback, isUpdate, resultsIdx);
  }

  self.finishDoc(docInfo, winningRev, deleted,
    callback, isUpdate, resultsIdx);
};

IdbBulkDocs.prototype.autoCompact = function (docInfo) {
  var self = this;

  var revsToDelete = utils.compactTree(docInfo.metadata);
  compactRevs(revsToDelete, docInfo.metadata.id, self.txn);
};

IdbBulkDocs.prototype.finishDoc = function (docInfo, winningRev, deleted,
                                            callback, isUpdate, resultsIdx) {
  var self = this;

  var doc = docInfo.data;
  var metadata = docInfo.metadata;

  doc._doc_id_rev = metadata.id + '::' + metadata.rev;
  delete doc._id;
  delete doc._rev;

  function afterPutDoc(e) {
    if (isUpdate && self.api.auto_compaction) {
      self.autoCompact(docInfo);
    }
    metadata.seq = e.target.result;
    // Current _rev is calculated from _rev_tree on read
    delete metadata.rev;
    var metadataToStore = encodeMetadata(metadata, winningRev, deleted);
    var metaDataReq = self.docStore.put(metadataToStore);
    metaDataReq.onsuccess = afterPutMetadata;
  }

  function afterPutDocError(e) {
    // ConstraintError, need to update, not put (see #1638 for details)
    e.preventDefault(); // avoid transaction abort
    e.stopPropagation(); // avoid transaction onerror
    var index = self.bySeqStore.index('_doc_id_rev');
    var getKeyReq = index.getKey(doc._doc_id_rev);
    getKeyReq.onsuccess = function (e) {
      var putReq = self.bySeqStore.put(doc, e.target.result);
      putReq.onsuccess = afterPutDoc;
    };
  }

  function afterPutMetadata() {
    self.results[resultsIdx] = {
      ok: true,
      id: metadata.id,
      rev: winningRev
    };
    self.fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
    self.insertAttachmentMappings(docInfo, metadata.seq, callback);
  }

  var putReq = self.bySeqStore.put(doc);

  putReq.onsuccess = afterPutDoc;
  putReq.onerror = afterPutDocError;
};

IdbBulkDocs.prototype.writeAttachments = function (docInfo, winningRev,
                                                   deleted, callback,
                                                   isUpdate, resultsIdx) {
  var self = this;

  var doc = docInfo.data;

  var numDone = 0;
  var attachments = Object.keys(doc._attachments);

  function collectResults() {
    if (numDone === attachments.length) {
      self.finishDoc(docInfo, winningRev, deleted, callback, isUpdate,
        resultsIdx);
    }
  }

  function attachmentSaved() {
    numDone++;
    collectResults();
  }

  attachments.forEach(function (key) {
    var att = docInfo.data._attachments[key];
    if (!att.stub) {
      var data = att.data;
      delete att.data;
      var digest = att.digest;
      self.saveAttachment(digest, data, attachmentSaved);
    } else {
      numDone++;
      collectResults();
    }
  });
};

// map seqs to attachment digests, which
// we will need later during compaction
IdbBulkDocs.prototype.insertAttachmentMappings = function (docInfo, seq,
                                                           callback) {
  var self = this;

  var attsAdded = 0;
  var attsToAdd = Object.keys(docInfo.data._attachments || {});

  if (!attsToAdd.length) {
    return callback();
  }

  function checkDone() {
    if (++attsAdded === attsToAdd.length) {
      callback();
    }
  }

  function add(att) {
    var digest = docInfo.data._attachments[att].digest;
    var req = self.attachAndSeqStore.put({
      seq: seq,
      digestSeq: digest + '::' + seq
    });

    req.onsuccess = checkDone;
    req.onerror = function (e) {
      // this callback is for a constaint error, which we ignore
      // because this docid/rev has already been associated with
      // the digest (e.g. when new_edits == false)
      e.preventDefault(); // avoid transaction abort
      e.stopPropagation(); // avoid transaction onerror
      checkDone();
    };
  }
  for (var i = 0; i < attsToAdd.length; i++) {
    add(attsToAdd[i]); // do in parallel
  }
};

IdbBulkDocs.prototype.saveAttachment = function (digest, data, callback) {
  var self = this;

  var getKeyReq = self.attachStore.count(digest);
  getKeyReq.onsuccess = function(e) {
    var count = e.target.result;
    if (count) {
      return callback(); // already exists
    }
    var newAtt = {
      digest: digest,
      body: data
    };
    var putReq = self.attachStore.put(newAtt);
    putReq.onsuccess = callback;
  };
};

module.exports = IdbBulkDocs;