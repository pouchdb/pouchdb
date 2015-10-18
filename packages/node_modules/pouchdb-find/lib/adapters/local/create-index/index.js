'use strict';

var utils = require('../../../utils');
var log = utils.log;

var pouchUpsert = require('pouchdb-upsert');
var abstractMapper = require('../abstract-mapper');
var localUtils = require('../utils');
var validateIndex = localUtils.validateIndex;
var massageIndexDef = localUtils.massageIndexDef;
var massageCreateIndexRequest = require('../../../massageCreateIndexRequest');

function upsert(db, docId, diffFun) {
  return pouchUpsert.upsert.call(db, docId, diffFun);
}

function createIndex(db, requestDef) {
  requestDef = massageCreateIndexRequest(requestDef);
  var originalIndexDef = utils.clone(requestDef.index);
  requestDef.index = massageIndexDef(requestDef.index);

  validateIndex(requestDef.index);

  var md5 = utils.MD5(JSON.stringify(requestDef));

  var viewName = requestDef.name || ('idx-' + md5);

  var ddocName = requestDef.ddoc || ('idx-' + md5);
  var ddocId = '_design/' + ddocName;

  var hasInvalidLanguage = false;
  var viewExists = false;

  function updateDdoc(doc) {
    if (doc._rev && doc.language !== 'query') {
      hasInvalidLanguage = true;
    }
    doc.language = 'query';
    doc.views = doc.views || {};

    viewExists = !!doc.views[viewName];

    doc.views[viewName] = {
      map: {
        fields: utils.mergeObjects(requestDef.index.fields)
      },
      reduce: '_count',
      options: {
        def: originalIndexDef
      }
    };

    return doc;
  }

  log('creating index', ddocId);

  return upsert(db, ddocId, updateDdoc).then(function () {
    if (hasInvalidLanguage) {
      throw new Error('invalid language for ddoc with id "' +
      ddocId +
      '" (should be "query")');
    }
  }).then(function () {
    // kick off a build
    // TODO: abstract-pouchdb-mapreduce should support auto-updating
    // TODO: should also use update_after, but pouchdb/pouchdb#3415 blocks me
    var signature = ddocName + '/' + viewName;
    return abstractMapper.query.call(db, signature, {
      limit: 0,
      reduce: false
    }).then(function () {
      return {
        id: ddocId,
        name: viewName,
        result: viewExists ? 'exists' : 'created'
      };
    });
  });
}

module.exports = createIndex;
