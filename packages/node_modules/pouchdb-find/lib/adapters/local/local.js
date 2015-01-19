'use strict';

var utils = require('../../utils');
var upsert = require('pouchdb-upsert');
var callbackify = utils.callbackify;
var collate = require('pouchdb-collate');

var abstractMapper = require('./abstract-mapper');

function getKey(obj) {
  return Object.keys(obj)[0];
}

function getValue(obj) {
  return obj[getKey(obj)];
}

function getSize(obj) {
  return Object.keys(obj).length;
}

function putIfNotExists(db, doc) {
  return upsert.putIfNotExists.call(db, doc);
}

function massageIndexDef(indexDef) {
  indexDef.fields = indexDef.fields.map(function (field) {
    if (typeof field === 'string') {
      var obj = {};
      obj[field] = 'asc';
      return obj;
    }
    return field;
  });
  return indexDef;
}

function massageSelector(selector) {
  if (!selector) {
    return null;
  }
  var field = Object.keys(selector)[0];
  var matcher = selector[field];
  if (typeof matcher === 'string') {
    matcher = {$eq: matcher};
  }
  matcher = {
    operator: getKey(matcher),
    value: getValue(matcher)
  };
  return [
    {field: field, matcher: matcher}
  ];
}

function filterInclusiveStart(rows, targetValue) {
  for (var i = 0, len = rows.length; i < len; i++) {
    var row = rows[i];
    if (collate.collate(row.key, targetValue) > 0) {
      if (i > 0) {
        return rows.slice(i);
      } else {
        return rows;
      }
    }
  }
  return rows;
}

function createIndex(db, requestDef) {

  var originalIndexDef = utils.clone(requestDef.index);
  requestDef.index = massageIndexDef(requestDef.index);

  var md5 = utils.MD5(JSON.stringify(requestDef));

  var views = {};

  var viewName = requestDef.name || ('idx-' + md5);

  views[viewName] = {
    map: {
      fields: utils.mergeObjects(requestDef.index.fields)
    },
    reduce: '_count',
    options: {
      def: originalIndexDef
    }
  };

  return putIfNotExists(db, {
    _id: '_design/idx-' + md5,
    views: views,
    language: 'query'
  }).then(function (res) {
    // kick off a build
    // TODO: abstract-pouchdb-mapreduce should support auto-updating
    var signature = 'idx-' + md5 + '/' + viewName;
    return abstractMapper.query.call(db, signature, {
        limit: 0,
        stale: 'update_after',
        reduce: false
    }).then(function () {
      return {result: res.updated ? 'created' : 'exists'};
    });
  });
}

function find(db, requestDef) {

  var selector = massageSelector(requestDef.selector)[0];
  var matcher = selector.matcher;

  return getIndexes(db).then(function (getIndexesRes) {

    var indexToUse;
    if (selector.field === '_id') {
      indexToUse = '_all_docs';
    } else {
      getIndexesRes.indexes.forEach(function (index) {
        if (index.def.fields.length === 1 &&
            getKey(index.def.fields[0]) === selector.field) {
          var ddoc = index.ddoc.substring(8); // remove '_design/'
          indexToUse = ddoc + '/' + index.name;
        }
      });
    }
    if (!indexToUse) {
      throw new Error('couldn\'t find any index to use');
    }

    var opts = {
      include_docs: true,
      reduce: false
    };

    if (requestDef.sort && requestDef.sort.length === 1 &&
        getSize(requestDef.sort[0]) === 1 &&
        getKey(requestDef.sort[0]) === selector.field &&
        getValue(requestDef.sort[0]) === 'desc') {
      opts.descending = true;
    }

    var inclusiveStart = true;

    switch (matcher.operator) {
      case '$eq':
        opts.key = matcher.value;
        break;
      case '$lte':
        if (opts.descending) {
          opts.startkey = matcher.value;
        } else {
          opts.endkey = matcher.value;
        }
        break;
      case '$gte':
        if (opts.descending) {
          opts.endkey = matcher.value;
        } else {
          opts.startkey = matcher.value;
        }
        break;
      case '$lt':
        if (opts.descending) {
          opts.startkey = matcher.value;
          inclusiveStart = false;
        } else {
          opts.endkey = matcher.value;
          opts.inclusive_end = false;
        }
        break;
      case '$gt':
        if (opts.descending) {
          opts.endkey = matcher.value;
          opts.inclusive_end = false;
        } else {
          opts.startkey = matcher.value;
          inclusiveStart = false;
        }
        break;
    }

    return Promise.resolve().then(function () {
      if (indexToUse === '_all_docs') {
        return db.allDocs(opts);
      } else {
        return abstractMapper.query.call(db, indexToUse, opts);
      }
    }).then(function (res) {

      if (!inclusiveStart) {
        // may have to manually filter the first one,
        // since couchdb has no inclusive_start option
        res.rows = filterInclusiveStart(res.rows, matcher.value);
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
  return db.allDocs({
    startkey: '_design/idx-',
    endkey: '_design/idx-\uffff',
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

    res.indexes = utils.flatten(res.indexes, allDocsRes.rows.map(function (row) {
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