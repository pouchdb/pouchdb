'use strict';

var utils = require('../../utils');
var log = utils.log;
var callbackify = utils.callbackify;

var pouchUpsert = require('pouchdb-upsert');
var abstractMapper = require('./abstract-mapper');
var planQuery = require('./query-planner');
var localUtils = require('./local-utils');
var filterInMemoryFields = require('./in-memory-filter');
var massageSelector = localUtils.massageSelector;
var getValue = localUtils.getValue;
var validateIndex = localUtils.validateIndex;
var massageIndexDef = localUtils.massageIndexDef;
var validateFindRequest = localUtils.validateFindRequest;
var reverseOptions = localUtils.reverseOptions;
var filterInclusiveStart = localUtils.filterInclusiveStart;
var Promise = utils.Promise;

function indexToSignature(index) {
  // remove '_design/'
  return index.ddoc.substring(8) + '/' + index.name;
}

function upsert(db, docId, diffFun) {
  return pouchUpsert.upsert.call(db, docId, diffFun);
}

function createIndex(db, requestDef) {

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
      return {result: viewExists ? 'exists' : 'created'};
    });
  });
}

function find(db, requestDef) {

  if (requestDef.selector) {
    requestDef.selector = massageSelector(requestDef.selector);
  }

  validateFindRequest(requestDef);

  return getIndexes(db).then(function (getIndexesRes) {

    var queryPlan = planQuery(requestDef, getIndexesRes.indexes);

    var indexToUse = queryPlan.index;

    var opts = utils.extend(true, {
      include_docs: true,
      reduce: false
    }, queryPlan.queryOpts);

    var isDescending = requestDef.sort &&
      typeof requestDef.sort[0] !== 'string' &&
      getValue(requestDef.sort[0]) === 'desc';

    if (isDescending) {
      // either all descending or all ascending
      opts.descending = true;
      opts = reverseOptions(opts);
    }

    if (!queryPlan.inMemoryFields.length) {
      // no in-memory filtering necessary, so we can let the
      // database do the limit/skip for us
      if ('limit' in requestDef) {
        opts.limit = requestDef.limit;
      }
      if ('skip' in requestDef) {
        opts.skip = requestDef.skip;
      }
    }

    return Promise.resolve().then(function () {
      if (indexToUse.name === '_all_docs') {
        return db.allDocs(opts);
      } else {
        var signature = indexToSignature(indexToUse);
        return abstractMapper.query.call(db, signature, opts);
      }
    }).then(function (res) {

      if (opts.inclusive_start === false) {
        // may have to manually filter the first one,
        // since couchdb has no true inclusive_start option
        res.rows = filterInclusiveStart(res.rows, opts.startkey);
      }

      if (queryPlan.inMemoryFields.length) {
        // need to filter some stuff in-memory
        res.rows = filterInMemoryFields(res.rows, requestDef, queryPlan.inMemoryFields);

        if ('limit' in requestDef || 'skip' in requestDef) {
          // have to do the limit in-memory
          var skip = requestDef.skip || 0;
          var limit = ('limit' in requestDef ? requestDef.limit : res.rows.length) + skip;
          res.rows = res.rows.slice(skip, limit);
        }
      }

      return {
        docs: res.rows.map(function (row) {
          var doc = row.doc;
          if (requestDef.fields) {
            return utils.pick(doc, requestDef.fields);
          }
          return doc;
        })
      };
    });
  });
}

function getIndexes(db) {
  // just search through all the design docs and filter in-memory.
  // hopefully there aren't that many ddocs.
  return db.allDocs({
    startkey: '_design/',
    endkey: '_design/\uffff',
    include_docs: true
  }).then(function (allDocsRes) {
    var res = {
      indexes: [{
        ddoc: null,
        name: '_all_docs',
        type: 'special',
        def: {
          fields: [{_id: 'asc'}]
        }
      }]
    };

    res.indexes = utils.flatten(res.indexes, allDocsRes.rows.filter(function (row) {
      return row.doc.language === 'query';
    }).map(function (row) {
      var viewNames = Object.keys(row.doc.views);

      return viewNames.map(function (viewName) {
        var view = row.doc.views[viewName];
        return {
          ddoc: row.id,
          name: viewName,
          type: 'json',
          def: massageIndexDef(view.options.def)
        };
      });
    }));

    // these are sorted by view name for some reason
    res.indexes.sort(function (left, right) {
      return utils.compare(left.name, right.name);
    });

    return res;
  });
}

function deleteIndex(db, index) {

  var docId = index.ddoc;

  return db.get(docId).then(function (doc) {
    return db.remove(doc);
  }).then(function () {
    return abstractMapper.viewCleanup.apply(db);
  }).then(function () {
    return {ok: true};
  });
}

exports.createIndex = callbackify(createIndex);
exports.find = callbackify(find);
exports.getIndexes = callbackify(getIndexes);
exports.deleteIndex = callbackify(deleteIndex);