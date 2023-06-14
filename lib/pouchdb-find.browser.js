import { t as toPromise } from './toPromise-9dada06a.js';
import './__node-resolve_empty-5ffda92e.js';
import { i as immediate } from './functionName-9335a350.js';
import { generateErrorFromResponse } from './pouchdb-errors.browser.js';
import { i as isRemote } from './isRemote-f9121da9.js';
import './spark-md5-2c57e5fc.js';
import { Headers } from './pouchdb-fetch.browser.js';
import { c as clone } from './clone-abfcddc8.js';
import { parseField, getFieldFromDoc, setFieldInDoc, matchesSelector, massageSelector, getValue, getKey, compare, filterInMemoryFields } from './pouchdb-selector-core.browser.js';
import createAbstractMapReduce from './pouchdb-abstract-mapreduce.browser.js';
import { c as collate } from './index-3a476dad.js';
import { u as upsert } from './upsert-331b6913.js';
import { stringMd5 } from './pouchdb-crypto.browser.js';
import './_commonjsHelpers-24198af3.js';
import './guardedConsole-f54e5a40.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-browser-cdc72594.js';
import './pouchdb-mapreduce-utils.browser.js';

// we restucture the supplied JSON considerably, because the official
// Mango API is very particular about a lot of this stuff, but we like
// to be liberal with what we accept in order to prevent mental
// breakdowns in our users
function massageCreateIndexRequest(requestDef) {
  requestDef = clone(requestDef);

  if (!requestDef.index) {
    requestDef.index = {};
  }

  ['type', 'name', 'ddoc'].forEach(function (key) {
    if (requestDef.index[key]) {
      requestDef[key] = requestDef.index[key];
      delete requestDef.index[key];
    }
  });

  if (requestDef.fields) {
    requestDef.index.fields = requestDef.fields;
    delete requestDef.fields;
  }

  if (!requestDef.type) {
    requestDef.type = 'json';
  }
  return requestDef;
}

// throws if the user is using the wrong query field value type
function checkFieldValueType(name, value, isHttp) {
	var message = '';
	var received = value;
	var addReceived = true;
	if ([ '$in', '$nin', '$or', '$and', '$mod', '$nor', '$all' ].indexOf(name) !== -1) {
		if (!Array.isArray(value)) {
			message = 'Query operator ' + name + ' must be an array.';

		}
	}

	if ([ '$not', '$elemMatch', '$allMatch' ].indexOf(name) !== -1) {
		if (!(!Array.isArray(value) && typeof value === 'object' && value !== null)) {
			message = 'Query operator ' + name + ' must be an object.';
		}
	}

	if (name === '$mod' && Array.isArray(value)) {
		if (value.length !== 2) {
			message = 'Query operator $mod must be in the format [divisor, remainder], ' +
				'where divisor and remainder are both integers.';
		} else {
			var divisor = value[0];
			var mod = value[1];
			if (divisor === 0) {
				message = 'Query operator $mod\'s divisor cannot be 0, cannot divide by zero.';
				addReceived = false;
			}
			if (typeof divisor !== 'number' || parseInt(divisor, 10) !== divisor) {
				message = 'Query operator $mod\'s divisor is not an integer.';
				received = divisor;
			}
			if (parseInt(mod, 10) !== mod) {
				message = 'Query operator $mod\'s remainder is not an integer.';
				received = mod;
			}
		}
	}
	if (name === '$exists') {
		if (typeof value !== 'boolean') {
			message = 'Query operator $exists must be a boolean.';
		}
	}

	if (name === '$type') {
		var allowed = [ 'null', 'boolean', 'number', 'string', 'array', 'object' ];
		var allowedStr = '"' + allowed.slice(0, allowed.length - 1).join('", "') + '", or "' + allowed[allowed.length - 1] + '"';
		if (typeof value !== 'string') {
			message = 'Query operator $type must be a string. Supported values: ' + allowedStr + '.';
		} else if (allowed.indexOf(value) == -1) {
			message = 'Query operator $type must be a string. Supported values: ' + allowedStr + '.';
		}
	}

	if (name === '$size') {
		if (parseInt(value, 10) !== value) {
			message = 'Query operator $size must be a integer.';
		}
	}

	if (name === '$regex') {
		if (typeof value !== 'string') {
			if (isHttp) {
				message = 'Query operator $regex must be a string.';
			} else if (!(value instanceof RegExp)) {
				message = 'Query operator $regex must be a string or an instance ' +
					'of a javascript regular expression.';
			}
		}
	}

	if (message) {
		if (addReceived) {

			var type = received === null
			? ' '
			: Array.isArray(received)
			? ' array'
			: ' ' + typeof received;
			var receivedStr = typeof received === 'object' && received !== null
			?  JSON.stringify(received, null, '\t')
			: received;

			message += ' Received' + type + ': ' + receivedStr;
		}
		throw new Error(message);
	}
}


var requireValidation = [ '$all', '$allMatch', '$and', '$elemMatch', '$exists', '$in', '$mod', '$nin', '$nor', '$not', '$or', '$regex', '$size', '$type' ];

var arrayTypeComparisonOperators = [ '$in', '$nin', '$mod', '$all'];

var equalityOperators = [ '$eq', '$gt', '$gte', '$lt', '$lte' ];

// recursively walks down the a query selector validating any operators
function validateSelector(input, isHttp) {
	if (Array.isArray(input)) {
		for (var entry of input) {
			if (typeof entry === 'object' && value !== null) {
				validateSelector(entry, isHttp);
			}
		}
	} else {
		var fields = Object.keys(input);

		for (var i = 0; i < fields.length; i++) {
			var key = fields[i];
			var value = input[key];

			if (requireValidation.indexOf(key) !== -1) {
				checkFieldValueType(key, value, isHttp);
			}
			if (equalityOperators.indexOf(key) !== -1) {
				// skip, explicit comparison operators can be anything
				continue;
			}
			if (arrayTypeComparisonOperators.indexOf(key) !== -1) {
				// skip, their values are already valid
				continue;
			}
			if (typeof value === 'object' && value !== null) {
				validateSelector(value, isHttp);
			}
		}
	}
}

function dbFetch(db, path, opts, callback) {
  var status, ok;
  opts.headers = new Headers({'Content-type': 'application/json'});
  db.fetch(path, opts).then(function (response) {
    status = response.status;
    ok = response.ok;
    return response.json();
  }).then(function (json) {
    if (!ok) {
      json.status = status;
      var err = generateErrorFromResponse(json);
      callback(err);
    } else {
      callback(null, json);
    }
  }).catch(callback);
}

function createIndex$1(db, requestDef, callback) {
  requestDef = massageCreateIndexRequest(requestDef);
  dbFetch(db, '_index', {
    method: 'POST',
    body: JSON.stringify(requestDef)
  }, callback);
}

function find$1(db, requestDef, callback) {
  validateSelector(requestDef.selector, true);
  dbFetch(db, '_find', {
    method: 'POST',
    body: JSON.stringify(requestDef)
  }, callback);
}

function explain$1(db, requestDef, callback) {
  dbFetch(db, '_explain', {
    method: 'POST',
    body: JSON.stringify(requestDef)
  }, callback);
}

function getIndexes$1(db, callback) {
  dbFetch(db, '_index', {
    method: 'GET'
  }, callback);
}

function deleteIndex$1(db, indexDef, callback) {


  var ddoc = indexDef.ddoc;
  var type = indexDef.type || 'json';
  var name = indexDef.name;

  if (!ddoc) {
    return callback(new Error('you must provide an index\'s ddoc'));
  }

  if (!name) {
    return callback(new Error('you must provide an index\'s name'));
  }

  var url = '_index/' + [ddoc, type, name].map(encodeURIComponent).join('/');

  dbFetch(db, url, {method: 'DELETE'}, callback);
}

function callbackify(fun) {
  return function (...args) {
    var cb = args.pop();
    var promise = fun.apply(this, args);
    promisedCallback(promise, cb);
    return promise;
  };
}

function promisedCallback(promise, callback) {
  promise.then(function (res) {
    immediate(function () {
      callback(null, res);
    });
  }, function (reason) {
    immediate(function () {
      callback(reason);
    });
  });
  return promise;
}

var flatten = function (...args) {
  var res = [];
  for (var i = 0, len = args.length; i < len; i++) {
    var subArr = args[i];
    if (Array.isArray(subArr)) {
      res = res.concat(flatten.apply(null, subArr));
    } else {
      res.push(subArr);
    }
  }
  return res;
};

function mergeObjects(arr) {
  var res = {};
  for (var i = 0, len = arr.length; i < len; i++) {
    res = Object.assign(res, arr[i]);
  }
  return res;
}

// Selects a list of fields defined in dot notation from one doc
// and copies them to a new doc. Like underscore _.pick but supports nesting.
function pick(obj, arr) {
  var res = {};
  for (var i = 0, len = arr.length; i < len; i++) {
    var parsedField = parseField(arr[i]);
    var value = getFieldFromDoc(obj, parsedField);
    if (typeof value !== 'undefined') {
      setFieldInDoc(res, parsedField, value);
    }
  }
  return res;
}

// e.g. ['a'], ['a', 'b'] is true, but ['b'], ['a', 'b'] is false
function oneArrayIsSubArrayOfOther(left, right) {

  for (var i = 0, len = Math.min(left.length, right.length); i < len; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

// e.g.['a', 'b', 'c'], ['a', 'b'] is false
function oneArrayIsStrictSubArrayOfOther(left, right) {

  if (left.length > right.length) {
    return false;
  }

  return oneArrayIsSubArrayOfOther(left, right);
}

// same as above, but treat the left array as an unordered set
// e.g. ['b', 'a'], ['a', 'b', 'c'] is true, but ['c'], ['a', 'b', 'c'] is false
function oneSetIsSubArrayOfOther(left, right) {
  left = left.slice();
  for (var i = 0, len = right.length; i < len; i++) {
    var field = right[i];
    if (!left.length) {
      break;
    }
    var leftIdx = left.indexOf(field);
    if (leftIdx === -1) {
      return false;
    } else {
      left.splice(leftIdx, 1);
    }
  }
  return true;
}

function arrayToObject(arr) {
  var res = {};
  for (var i = 0, len = arr.length; i < len; i++) {
    res[arr[i]] = true;
  }
  return res;
}

function max(arr, fun) {
  var max = null;
  var maxScore = -1;
  for (var i = 0, len = arr.length; i < len; i++) {
    var element = arr[i];
    var score = fun(element);
    if (score > maxScore) {
      maxScore = score;
      max = element;
    }
  }
  return max;
}

function arrayEquals(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (var i = 0, len = arr1.length; i < len; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

function uniq(arr) {
  var obj = {};
  for (var i = 0; i < arr.length; i++) {
    obj['$' + arr[i]] = true;
  }
  return Object.keys(obj).map(function (key) {
    return key.substring(1);
  });
}

//
// One thing about these mappers:
//
// Per the advice of John-David Dalton (http://youtu.be/NthmeLEhDDM),
// what you want to do in this case is optimize for the smallest possible
// function, since that's the thing that gets run over and over again.
//
// This code would be a lot simpler if all the if/elses were inside
// the function, but it would also be a lot less performant.
//


function createDeepMultiMapper(fields, emit, selector) {
  return function (doc) {
    if (selector && !matchesSelector(doc, selector)) { return; }
    var toEmit = [];
    for (var i = 0, iLen = fields.length; i < iLen; i++) {
      var parsedField = parseField(fields[i]);
      var value = doc;
      for (var j = 0, jLen = parsedField.length; j < jLen; j++) {
        var key = parsedField[j];
        value = value[key];
        if (typeof value === 'undefined') {
          return; // don't emit
        }
      }
      toEmit.push(value);
    }
    emit(toEmit);
  };
}

function createDeepSingleMapper(field, emit, selector) {
  var parsedField = parseField(field);
  return function (doc) {
    if (selector && !matchesSelector(doc, selector)) { return; }
    var value = doc;
    for (var i = 0, len = parsedField.length; i < len; i++) {
      var key = parsedField[i];
      value = value[key];
      if (typeof value === 'undefined') {
        return; // do nothing
      }
    }
    emit(value);
  };
}

function createShallowSingleMapper(field, emit, selector) {
  return function (doc) {
    if (selector && !matchesSelector(doc, selector)) { return; }
    emit(doc[field]);
  };
}

function createShallowMultiMapper(fields, emit, selector) {
  return function (doc) {
    if (selector && !matchesSelector(doc, selector)) { return; }
    var toEmit = [];
    for (var i = 0, len = fields.length; i < len; i++) {
      toEmit.push(doc[fields[i]]);
    }
    emit(toEmit);
  };
}

function checkShallow(fields) {
  for (var i = 0, len = fields.length; i < len; i++) {
    var field = fields[i];
    if (field.indexOf('.') !== -1) {
      return false;
    }
  }
  return true;
}

function createMapper(fields, emit, selector) {
  var isShallow = checkShallow(fields);
  var isSingle = fields.length === 1;

  // notice we try to optimize for the most common case,
  // i.e. single shallow indexes
  if (isShallow) {
    if (isSingle) {
      return createShallowSingleMapper(fields[0], emit, selector);
    } else { // multi
      return createShallowMultiMapper(fields, emit, selector);
    }
  } else { // deep
    if (isSingle) {
      return createDeepSingleMapper(fields[0], emit, selector);
    } else { // multi
      return createDeepMultiMapper(fields, emit, selector);
    }
  }
}

function mapper(mapFunDef, emit) {
  // mapFunDef is a list of fields

  const fields = Object.keys(mapFunDef.fields);
  const partialSelector = mapFunDef.partial_filter_selector;

  return createMapper(fields, emit, partialSelector);
}

/* istanbul ignore next */
function reducer(/*reduceFunDef*/) {
  throw new Error('reduce not supported');
}

function ddocValidator(ddoc, viewName) {
  var view = ddoc.views[viewName];
  // This doesn't actually need to be here apparently, but
  // I feel safer keeping it.
  /* istanbul ignore if */
  if (!view.map || !view.map.fields) {
    throw new Error('ddoc ' + ddoc._id +' with view ' + viewName +
      ' doesn\'t have map.fields defined. ' +
      'maybe it wasn\'t created by this plugin?');
  }
}

var abstractMapper = createAbstractMapReduce(
  /* localDocName */ 'indexes',
  mapper,
  reducer,
  ddocValidator
);

function abstractMapper$1 (db) {
  if (db._customFindAbstractMapper) {
    return {
      // Calls the _customFindAbstractMapper, but with a third argument:
      // the standard findAbstractMapper query/viewCleanup.
      // This allows the indexeddb adapter to support partial_filter_selector.
      query: function addQueryFallback(signature, opts) {
        var fallback = abstractMapper.query.bind(this);
        return db._customFindAbstractMapper.query.call(this, signature, opts, fallback);
      },
      viewCleanup: function addViewCleanupFallback() {
        var fallback = abstractMapper.viewCleanup.bind(this);
        return db._customFindAbstractMapper.viewCleanup.call(this, fallback);
      }
    };
  }
  return abstractMapper;
}

// normalize the "sort" value
function massageSort(sort) {
  if (!Array.isArray(sort)) {
    throw new Error('invalid sort json - should be an array');
  }
  return sort.map(function (sorting) {
    if (typeof sorting === 'string') {
      var obj = {};
      obj[sorting] = 'asc';
      return obj;
    } else {
      return sorting;
    }
  });
}

function massageUseIndex(useIndex) {
  var cleanedUseIndex = [];
  if (typeof useIndex === 'string') {
    cleanedUseIndex.push(useIndex);
  } else {
    cleanedUseIndex = useIndex;
  }

  return cleanedUseIndex.map(function (name) {
    return name.replace('_design/', '');
  });
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
  if (indexDef.partial_filter_selector) {
    indexDef.partial_filter_selector = massageSelector(
      indexDef.partial_filter_selector
    );
  }
  return indexDef;
}

function getKeyFromDoc(doc, index) {
  var res = [];
  for (var i = 0; i < index.def.fields.length; i++) {
    var field = getKey(index.def.fields[i]);
    res.push(getFieldFromDoc(doc, parseField(field)));
  }
  return res;
}

// have to do this manually because REASONS. I don't know why
// CouchDB didn't implement inclusive_start
function filterInclusiveStart(rows, targetValue, index) {
  var indexFields = index.def.fields;
  for (var i = 0, len = rows.length; i < len; i++) {
    var row = rows[i];

    // shave off any docs at the beginning that are <= the
    // target value

    var docKey = getKeyFromDoc(row.doc, index);
    if (indexFields.length === 1) {
      docKey = docKey[0]; // only one field, not multi-field
    } else { // more than one field in index
      // in the case where e.g. the user is searching {$gt: {a: 1}}
      // but the index is [a, b], then we need to shorten the doc key
      while (docKey.length > targetValue.length) {
        docKey.pop();
      }
    }
    //ABS as we just looking for values that don't match
    if (Math.abs(collate(docKey, targetValue)) > 0) {
      // no need to filter any further; we're past the key
      break;
    }
  }
  return i > 0 ? rows.slice(i) : rows;
}

function reverseOptions(opts) {
  var newOpts = clone(opts);
  delete newOpts.startkey;
  delete newOpts.endkey;
  delete newOpts.inclusive_start;
  delete newOpts.inclusive_end;

  if ('endkey' in opts) {
    newOpts.startkey = opts.endkey;
  }
  if ('startkey' in opts) {
    newOpts.endkey = opts.startkey;
  }
  if ('inclusive_start' in opts) {
    newOpts.inclusive_end = opts.inclusive_start;
  }
  if ('inclusive_end' in opts) {
    newOpts.inclusive_start = opts.inclusive_end;
  }
  return newOpts;
}

function validateIndex(index) {
  var ascFields = index.fields.filter(function (field) {
    return getValue(field) === 'asc';
  });
  if (ascFields.length !== 0 && ascFields.length !== index.fields.length) {
    throw new Error('unsupported mixed sorting');
  }
}

function validateSort(requestDef, index) {
  if (index.defaultUsed && requestDef.sort) {
    var noneIdSorts = requestDef.sort.filter(function (sortItem) {
      return Object.keys(sortItem)[0] !== '_id';
    }).map(function (sortItem) {
      return Object.keys(sortItem)[0];
    });

    if (noneIdSorts.length > 0) {
      throw new Error('Cannot sort on field(s) "' + noneIdSorts.join(',') +
      '" when using the default index');
    }
  }

  if (index.defaultUsed) {
    return;
  }
}

function validateFindRequest(requestDef) {
  if (typeof requestDef.selector !== 'object') {
    throw new Error('you must provide a selector when you find()');
  }

  /*var selectors = requestDef.selector['$and'] || [requestDef.selector];
  for (var i = 0; i < selectors.length; i++) {
    var selector = selectors[i];
    var keys = Object.keys(selector);
    if (keys.length === 0) {
      throw new Error('invalid empty selector');
    }
    //var selection = selector[keys[0]];
    /*if (Object.keys(selection).length !== 1) {
      throw new Error('invalid selector: ' + JSON.stringify(selection) +
        ' - it must have exactly one key/value');
    }
  }*/
}

// determine the maximum number of fields
// we're going to need to query, e.g. if the user
// has selection ['a'] and sorting ['a', 'b'], then we
// need to use the longer of the two: ['a', 'b']
function getUserFields(selector, sort) {
  var selectorFields = Object.keys(selector);
  var sortFields = sort? sort.map(getKey) : [];
  var userFields;
  if (selectorFields.length >= sortFields.length) {
    userFields = selectorFields;
  } else {
    userFields = sortFields;
  }

  if (sortFields.length === 0) {
    return {
      fields: userFields
    };
  }

  // sort according to the user's preferred sorting
  userFields = userFields.sort(function (left, right) {
    var leftIdx = sortFields.indexOf(left);
    if (leftIdx === -1) {
      leftIdx = Number.MAX_VALUE;
    }
    var rightIdx = sortFields.indexOf(right);
    if (rightIdx === -1) {
      rightIdx = Number.MAX_VALUE;
    }
    return leftIdx < rightIdx ? -1 : leftIdx > rightIdx ? 1 : 0;
  });

  return {
    fields: userFields,
    sortOrder: sort.map(getKey)
  };
}

async function createIndex(db, requestDef) {
  requestDef = massageCreateIndexRequest(requestDef);
  var originalIndexDef = clone(requestDef.index);
  requestDef.index = massageIndexDef(requestDef.index);

  validateIndex(requestDef.index);

  // calculating md5 is expensive - memoize and only
  // run if required
  var md5 = await stringMd5(JSON.stringify(requestDef));
  
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

    if (viewExists) {
      return false;
    }

    doc.views[viewName] = {
      map: {
        fields: mergeObjects(requestDef.index.fields),
        partial_filter_selector: requestDef.index.partial_filter_selector
      },
      reduce: '_count',
      options: {
        def: originalIndexDef
      }
    };

    return doc;
  }

  db.constructor.emit('debug', ['find', 'creating index', ddocId]);

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
    return abstractMapper$1(db).query.call(db, signature, {
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

    res.indexes = flatten(res.indexes, allDocsRes.rows.filter(function (row) {
      return row.doc.language === 'query';
    }).map(function (row) {
      var viewNames = row.doc.views !== undefined ? Object.keys(row.doc.views) : [];

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
      return compare(left.name, right.name);
    });
    res.total_rows = res.indexes.length;
    return res;
  });
}

// couchdb lowest collation value
var COLLATE_LO = null;

// couchdb highest collation value (TODO: well not really, but close enough amirite)
var COLLATE_HI = {"\uffff": {}};

const SHORT_CIRCUIT_QUERY = {
  queryOpts: { limit: 0, startkey: COLLATE_HI, endkey: COLLATE_LO },
  inMemoryFields: [],
};

// couchdb second-lowest collation value

function checkFieldInIndex(index, field) {
  var indexFields = index.def.fields.map(getKey);
  for (var i = 0, len = indexFields.length; i < len; i++) {
    var indexField = indexFields[i];
    if (field === indexField) {
      return true;
    }
  }
  return false;
}

// so when you do e.g. $eq/$eq, we can do it entirely in the database.
// but when you do e.g. $gt/$eq, the first part can be done
// in the database, but the second part has to be done in-memory,
// because $gt has forced us to lose precision.
// so that's what this determines
function userOperatorLosesPrecision(selector, field) {
  var matcher = selector[field];
  var userOperator = getKey(matcher);

  return userOperator !== '$eq';
}

// sort the user fields by their position in the index,
// if they're in the index
function sortFieldsByIndex(userFields, index) {
  var indexFields = index.def.fields.map(getKey);

  return userFields.slice().sort(function (a, b) {
    var aIdx = indexFields.indexOf(a);
    var bIdx = indexFields.indexOf(b);
    if (aIdx === -1) {
      aIdx = Number.MAX_VALUE;
    }
    if (bIdx === -1) {
      bIdx = Number.MAX_VALUE;
    }
    return compare(aIdx, bIdx);
  });
}

// first pass to try to find fields that will need to be sorted in-memory
function getBasicInMemoryFields(index, selector, userFields) {

  userFields = sortFieldsByIndex(userFields, index);

  // check if any of the user selectors lose precision
  var needToFilterInMemory = false;
  for (var i = 0, len = userFields.length; i < len; i++) {
    var field = userFields[i];
    if (needToFilterInMemory || !checkFieldInIndex(index, field)) {
      return userFields.slice(i);
    }
    if (i < len - 1 && userOperatorLosesPrecision(selector, field)) {
      needToFilterInMemory = true;
    }
  }
  return [];
}

function getInMemoryFieldsFromNe(selector) {
  var fields = [];
  Object.keys(selector).forEach(function (field) {
    var matcher = selector[field];
    Object.keys(matcher).forEach(function (operator) {
      if (operator === '$ne') {
        fields.push(field);
      }
    });
  });
  return fields;
}

function getInMemoryFields(coreInMemoryFields, index, selector, userFields) {
  var result = flatten(
    // in-memory fields reported as necessary by the query planner
    coreInMemoryFields,
    // combine with another pass that checks for any we may have missed
    getBasicInMemoryFields(index, selector, userFields),
    // combine with another pass that checks for $ne's
    getInMemoryFieldsFromNe(selector)
  );

  return sortFieldsByIndex(uniq(result), index);
}

// check that at least one field in the user's query is represented
// in the index. order matters in the case of sorts
function checkIndexFieldsMatch(indexFields, sortOrder, fields) {
  if (sortOrder) {
    // array has to be a strict subarray of index array. furthermore,
    // the sortOrder fields need to all be represented in the index
    var sortMatches = oneArrayIsStrictSubArrayOfOther(sortOrder, indexFields);
    var selectorMatches = oneArrayIsSubArrayOfOther(fields, indexFields);

    return sortMatches && selectorMatches;
  }

  // all of the user's specified fields still need to be
  // on the left side of the index array, although the order
  // doesn't matter
  return oneSetIsSubArrayOfOther(fields, indexFields);
}

var logicalMatchers = ['$eq', '$gt', '$gte', '$lt', '$lte'];
function isNonLogicalMatcher(matcher) {
  return logicalMatchers.indexOf(matcher) === -1;
}

// check all the index fields for usages of '$ne'
// e.g. if the user queries {foo: {$ne: 'foo'}, bar: {$eq: 'bar'}},
// then we can neither use an index on ['foo'] nor an index on
// ['foo', 'bar'], but we can use an index on ['bar'] or ['bar', 'foo']
function checkFieldsLogicallySound(indexFields, selector) {
  var firstField = indexFields[0];
  var matcher = selector[firstField];

  if (typeof matcher === 'undefined') {
    /* istanbul ignore next */
    return true;
  }

  var isInvalidNe = Object.keys(matcher).length === 1 &&
    getKey(matcher) === '$ne';

  return !isInvalidNe;
}

function checkIndexMatches(index, sortOrder, fields, selector) {

  var indexFields = index.def.fields.map(getKey);

  var fieldsMatch = checkIndexFieldsMatch(indexFields, sortOrder, fields);

  if (!fieldsMatch) {
    return false;
  }

  return checkFieldsLogicallySound(indexFields, selector);
}

//
// the algorithm is very simple:
// take all the fields the user supplies, and if those fields
// are a strict subset of the fields in some index,
// then use that index
//
//
function findMatchingIndexes(selector, userFields, sortOrder, indexes) {
  return indexes.filter(function (index) {
    return checkIndexMatches(index, sortOrder, userFields, selector);
  });
}

// find the best index, i.e. the one that matches the most fields
// in the user's query
function findBestMatchingIndex(selector, userFields, sortOrder, indexes, useIndex) {

  var matchingIndexes = findMatchingIndexes(selector, userFields, sortOrder, indexes);

  if (matchingIndexes.length === 0) {
    if (useIndex) {
      throw {
        error: "no_usable_index",
        message: "There is no index available for this selector."
      };
    }
    //return `all_docs` as a default index;
    //I'm assuming that _all_docs is always first
    var defaultIndex = indexes[0];
    defaultIndex.defaultUsed = true;
    return defaultIndex;
  }
  if (matchingIndexes.length === 1 && !useIndex) {
    return matchingIndexes[0];
  }

  var userFieldsMap = arrayToObject(userFields);

  function scoreIndex(index) {
    var indexFields = index.def.fields.map(getKey);
    var score = 0;
    for (var i = 0, len = indexFields.length; i < len; i++) {
      var indexField = indexFields[i];
      if (userFieldsMap[indexField]) {
        score++;
      }
    }
    return score;
  }

  if (useIndex) {
    var useIndexDdoc = '_design/' + useIndex[0];
    var useIndexName = useIndex.length === 2 ? useIndex[1] : false;
    var index = matchingIndexes.find(function (index) {
      if (useIndexName && index.ddoc === useIndexDdoc && useIndexName === index.name) {
        return true;
      }

      if (index.ddoc === useIndexDdoc) {
        /* istanbul ignore next */
        return true;
      }

      return false;
    });

    if (!index) {
      throw {
        error: "unknown_error",
        message: "Could not find that index or could not use that index for the query"
      };
    }
    return index;
  }

  return max(matchingIndexes, scoreIndex);
}

function getSingleFieldQueryOptsFor(userOperator, userValue) {
  switch (userOperator) {
    case '$eq':
      return {key: userValue};
    case '$lte':
      return {endkey: userValue};
    case '$gte':
      return {startkey: userValue};
    case '$lt':
      return {
        endkey: userValue,
        inclusive_end: false
      };
    case '$gt':
      return {
        startkey: userValue,
        inclusive_start: false
      };
  }

  return {
    startkey: COLLATE_LO
  };
}

function getSingleFieldCoreQueryPlan(selector, index) {
  var field = getKey(index.def.fields[0]);
  //ignoring this because the test to exercise the branch is skipped at the moment
  /* istanbul ignore next */
  var matcher = selector[field] || {};
  var inMemoryFields = [];

  var userOperators = Object.keys(matcher);

  var combinedOpts;

  userOperators.forEach(function (userOperator) {

    if (isNonLogicalMatcher(userOperator)) {
      inMemoryFields.push(field);
    }

    var userValue = matcher[userOperator];

    var newQueryOpts = getSingleFieldQueryOptsFor(userOperator, userValue);

    if (combinedOpts) {
      combinedOpts = mergeObjects([combinedOpts, newQueryOpts]);
    } else {
      combinedOpts = newQueryOpts;
    }
  });

  return {
    queryOpts: combinedOpts,
    inMemoryFields: inMemoryFields
  };
}

function getMultiFieldCoreQueryPlan(userOperator, userValue) {
  switch (userOperator) {
    case '$eq':
      return {
        startkey: userValue,
        endkey: userValue
      };
    case '$lte':
      return {
        endkey: userValue
      };
    case '$gte':
      return {
        startkey: userValue
      };
    case '$lt':
      return {
        endkey: userValue,
        inclusive_end: false
      };
    case '$gt':
      return {
        startkey: userValue,
        inclusive_start: false
      };
  }
}

function getMultiFieldQueryOpts(selector, index) {

  var indexFields = index.def.fields.map(getKey);

  var inMemoryFields = [];
  var startkey = [];
  var endkey = [];
  var inclusiveStart;
  var inclusiveEnd;


  function finish(i) {

    if (inclusiveStart !== false) {
      startkey.push(COLLATE_LO);
    }
    if (inclusiveEnd !== false) {
      endkey.push(COLLATE_HI);
    }
    // keep track of the fields where we lost specificity,
    // and therefore need to filter in-memory
    inMemoryFields = indexFields.slice(i);
  }

  for (var i = 0, len = indexFields.length; i < len; i++) {
    var indexField = indexFields[i];

    var matcher = selector[indexField];

    if (!matcher || !Object.keys(matcher).length) { // fewer fields in user query than in index
      finish(i);
      break;
    } else if (Object.keys(matcher).some(isNonLogicalMatcher)) { // non-logical are ignored
      finish(i);
      break;
    } else if (i > 0) {
      var usingGtlt = (
        '$gt' in matcher || '$gte' in matcher ||
        '$lt' in matcher || '$lte' in matcher);
      var previousKeys = Object.keys(selector[indexFields[i - 1]]);
      var previousWasEq = arrayEquals(previousKeys, ['$eq']);
      var previousWasSame = arrayEquals(previousKeys, Object.keys(matcher));
      var gtltLostSpecificity = usingGtlt && !previousWasEq && !previousWasSame;
      if (gtltLostSpecificity) {
        finish(i);
        break;
      }
    }

    var userOperators = Object.keys(matcher);

    var combinedOpts = null;

    for (var j = 0; j < userOperators.length; j++) {
      var userOperator = userOperators[j];
      var userValue = matcher[userOperator];

      var newOpts = getMultiFieldCoreQueryPlan(userOperator, userValue);

      if (combinedOpts) {
        combinedOpts = mergeObjects([combinedOpts, newOpts]);
      } else {
        combinedOpts = newOpts;
      }
    }

    startkey.push('startkey' in combinedOpts ? combinedOpts.startkey : COLLATE_LO);
    endkey.push('endkey' in combinedOpts ? combinedOpts.endkey : COLLATE_HI);
    if ('inclusive_start' in combinedOpts) {
      inclusiveStart = combinedOpts.inclusive_start;
    }
    if ('inclusive_end' in combinedOpts) {
      inclusiveEnd = combinedOpts.inclusive_end;
    }
  }

  var res = {
    startkey: startkey,
    endkey: endkey
  };

  if (typeof inclusiveStart !== 'undefined') {
    res.inclusive_start = inclusiveStart;
  }
  if (typeof inclusiveEnd !== 'undefined') {
    res.inclusive_end = inclusiveEnd;
  }

  return {
    queryOpts: res,
    inMemoryFields: inMemoryFields
  };
}

function shouldShortCircuit(selector) {
  // We have a field to select from, but not a valid value
  // this should result in a short circuited query 
  // just like the http adapter (couchdb) and mongodb
  // see tests for issue #7810
  
  // @todo Use 'Object.values' when Node.js v6 support is dropped.
  const values = Object.keys(selector).map(function (key) {
    return selector[key];
  });
  return values.some(function (val) { 
    return typeof val === 'object' && Object.keys(val).length === 0;
});
}

function getDefaultQueryPlan(selector) {
  //using default index, so all fields need to be done in memory
  return {
    queryOpts: {startkey: null},
    inMemoryFields: [Object.keys(selector)]
  };
}

function getCoreQueryPlan(selector, index) {
  if (index.defaultUsed) {
    return getDefaultQueryPlan(selector);
  }

  if (index.def.fields.length === 1) {
    // one field in index, so the value was indexed as a singleton
    return getSingleFieldCoreQueryPlan(selector, index);
  }
  // else index has multiple fields, so the value was indexed as an array
  return getMultiFieldQueryOpts(selector, index);
}

function planQuery(request, indexes) {

  var selector = request.selector;
  var sort = request.sort;

  if (shouldShortCircuit(selector)) {
    return Object.assign({}, SHORT_CIRCUIT_QUERY, { index: indexes[0] });
  }

  var userFieldsRes = getUserFields(selector, sort);

  var userFields = userFieldsRes.fields;
  var sortOrder = userFieldsRes.sortOrder;
  var index = findBestMatchingIndex(selector, userFields, sortOrder, indexes, request.use_index);

  var coreQueryPlan = getCoreQueryPlan(selector, index);
  var queryOpts = coreQueryPlan.queryOpts;
  var coreInMemoryFields = coreQueryPlan.inMemoryFields;

  var inMemoryFields = getInMemoryFields(coreInMemoryFields, index, selector, userFields);

  var res = {
    queryOpts: queryOpts,
    index: index,
    inMemoryFields: inMemoryFields
  };
  return res;
}

function indexToSignature(index) {
  // remove '_design/'
  return index.ddoc.substring(8) + '/' + index.name;
}

function doAllDocs(db, originalOpts) {
  var opts = clone(originalOpts);

  // CouchDB responds in weird ways when you provide a non-string to _id;
  // we mimic the behavior for consistency. See issue66 tests for details.
  if (opts.descending) {
    if ('endkey' in opts && typeof opts.endkey !== 'string') {
      opts.endkey = '';
    }
    if ('startkey' in opts && typeof opts.startkey !== 'string') {
      opts.limit = 0;
    }
  } else {
    if ('startkey' in opts && typeof opts.startkey !== 'string') {
      opts.startkey = '';
    }
    if ('endkey' in opts && typeof opts.endkey !== 'string') {
      opts.limit = 0;
    }
  }
  if ('key' in opts && typeof opts.key !== 'string') {
    opts.limit = 0;
  }

  if (opts.limit > 0 && opts.indexes_count) {
    // brute force and quite naive impl.
    // amp up the limit with the amount of (indexes) design docs
    // or is this too naive? How about skip?
    opts.original_limit = opts.limit;
    opts.limit += opts.indexes_count;
  }

  return db.allDocs(opts)
    .then(function (res) {
      // filter out any design docs that _all_docs might return
      res.rows = res.rows.filter(function (row) {
        return !/^_design\//.test(row.id);
      });
      // put back original limit
      if (opts.original_limit) {
        opts.limit = opts.original_limit;
      }
      // enforce the rows to respect the given limit
      res.rows = res.rows.slice(0, opts.limit);
      return res;
    });
}

function find(db, requestDef, explain) {
  if (requestDef.selector) {
    // must be validated before massaging
    validateSelector(requestDef.selector, false);
    requestDef.selector = massageSelector(requestDef.selector);
  }

  if (requestDef.sort) {
    requestDef.sort = massageSort(requestDef.sort);
  }

  if (requestDef.use_index) {
    requestDef.use_index = massageUseIndex(requestDef.use_index);
  }

  validateFindRequest(requestDef);

  return getIndexes(db).then(function (getIndexesRes) {

    db.constructor.emit('debug', ['find', 'planning query', requestDef]);
    var queryPlan = planQuery(requestDef, getIndexesRes.indexes);
    db.constructor.emit('debug', ['find', 'query plan', queryPlan]);

    var indexToUse = queryPlan.index;

    validateSort(requestDef, indexToUse);

    var opts = Object.assign({
      include_docs: true,
      reduce: false,
      // Add amount of index for doAllDocs to use (related to issue #7810)
      indexes_count: getIndexesRes.total_rows,
    }, queryPlan.queryOpts);

    if ('startkey' in opts && 'endkey' in opts &&
        collate(opts.startkey, opts.endkey) > 0) {
      // can't possibly return any results, startkey > endkey
      /* istanbul ignore next */
      return {docs: []};
    }

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

    if (explain) {
      return Promise.resolve(queryPlan, opts);
    }

    return Promise.resolve().then(function () {
      if (indexToUse.name === '_all_docs') {
        return doAllDocs(db, opts);
      } else {
        var signature = indexToSignature(indexToUse);
        return abstractMapper$1(db).query.call(db, signature, opts);
      }
    }).then(function (res) {
      if (opts.inclusive_start === false) {
        // may have to manually filter the first one,
        // since couchdb has no true inclusive_start option
        res.rows = filterInclusiveStart(res.rows, opts.startkey, indexToUse);
      }

      if (queryPlan.inMemoryFields.length) {
        // need to filter some stuff in-memory
        res.rows = filterInMemoryFields(res.rows, requestDef, queryPlan.inMemoryFields);
      }

      var resp = {
        docs: res.rows.map(function (row) {
          var doc = row.doc;
          if (requestDef.fields) {
            return pick(doc, requestDef.fields);
          }
          return doc;
        })
      };

      if (indexToUse.defaultUsed) {
        resp.warning = 'No matching index found, create an index to optimize query time.';
      }

      return resp;
    });
  });
}

function explain(db, requestDef) {
  return find(db, requestDef, true)
  .then(function (queryPlan) {
    return {
      dbname: db.name,
      index: queryPlan.index,
      selector: requestDef.selector,
      range: {
        start_key: queryPlan.queryOpts.startkey,
        end_key: queryPlan.queryOpts.endkey,
      },
      opts: {
        use_index: requestDef.use_index || [],
        bookmark: "nil", //hardcoded to match CouchDB since its not supported,
        limit: requestDef.limit,
        skip: requestDef.skip,
        sort: requestDef.sort || {},
        fields: requestDef.fields,
        conflicts: false, //hardcoded to match CouchDB since its not supported,
        r: [49], // hardcoded to match CouchDB since its not support
      },
      limit: requestDef.limit,
      skip: requestDef.skip || 0,
      fields: requestDef.fields,
    };
  });
}

function deleteIndex(db, index) {

  if (!index.ddoc) {
    throw new Error('you must supply an index.ddoc when deleting');
  }

  if (!index.name) {
    throw new Error('you must supply an index.name when deleting');
  }

  var docId = index.ddoc;
  var viewName = index.name;

  function deltaFun(doc) {
    if (Object.keys(doc.views).length === 1 && doc.views[viewName]) {
      // only one view in this ddoc, delete the whole ddoc
      return {_id: docId, _deleted: true};
    }
    // more than one view here, just remove the view
    delete doc.views[viewName];
    return doc;
  }

  return upsert(db, docId, deltaFun).then(function () {
    return abstractMapper$1(db).viewCleanup.apply(db);
  }).then(function () {
    return {ok: true};
  });
}

var createIndexAsCallback = callbackify(createIndex);
var findAsCallback = callbackify(find);
var explainAsCallback = callbackify(explain);
var getIndexesAsCallback = callbackify(getIndexes);
var deleteIndexAsCallback = callbackify(deleteIndex);

var plugin = {};
plugin.createIndex = toPromise(function (requestDef, callback) {

  if (typeof requestDef !== 'object') {
    return callback(new Error('you must provide an index to create'));
  }

  var createIndex = isRemote(this) ?
    createIndex$1 : createIndexAsCallback;
  createIndex(this, requestDef, callback);
});

plugin.find = toPromise(function (requestDef, callback) {

  if (typeof callback === 'undefined') {
    callback = requestDef;
    requestDef = undefined;
  }

  if (typeof requestDef !== 'object') {
    return callback(new Error('you must provide search parameters to find()'));
  }

  var find = isRemote(this) ? find$1 : findAsCallback;
  find(this, requestDef, callback);
});

plugin.explain = toPromise(function (requestDef, callback) {

  if (typeof callback === 'undefined') {
    callback = requestDef;
    requestDef = undefined;
  }

  if (typeof requestDef !== 'object') {
    return callback(new Error('you must provide search parameters to explain()'));
  }

  var find = isRemote(this) ? explain$1 : explainAsCallback;
  find(this, requestDef, callback);
});

plugin.getIndexes = toPromise(function (callback) {

  var getIndexes = isRemote(this) ? getIndexes$1 : getIndexesAsCallback;
  getIndexes(this, callback);
});

plugin.deleteIndex = toPromise(function (indexDef, callback) {

  if (typeof indexDef !== 'object') {
    return callback(new Error('you must provide an index to delete'));
  }

  var deleteIndex = isRemote(this) ?
    deleteIndex$1 : deleteIndexAsCallback;
  deleteIndex(this, indexDef, callback);
});

export { plugin as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1maW5kLmJyb3dzZXIuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvdmFsaWRhdGVTZWxlY3Rvci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvaHR0cC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvdXRpbHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2Fic3RyYWN0LW1hcHBlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvdXRpbHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2NyZWF0ZS1pbmRleC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvZ2V0LWluZGV4ZXMvaW5kZXguanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2ZpbmQvcXVlcnktcGxhbm5lci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvZmluZC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvZGVsZXRlLWluZGV4L2luZGV4LmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1maW5kL3NyYy9hZGFwdGVycy9sb2NhbC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2xvbmUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuLy8gd2UgcmVzdHVjdHVyZSB0aGUgc3VwcGxpZWQgSlNPTiBjb25zaWRlcmFibHksIGJlY2F1c2UgdGhlIG9mZmljaWFsXG4vLyBNYW5nbyBBUEkgaXMgdmVyeSBwYXJ0aWN1bGFyIGFib3V0IGEgbG90IG9mIHRoaXMgc3R1ZmYsIGJ1dCB3ZSBsaWtlXG4vLyB0byBiZSBsaWJlcmFsIHdpdGggd2hhdCB3ZSBhY2NlcHQgaW4gb3JkZXIgdG8gcHJldmVudCBtZW50YWxcbi8vIGJyZWFrZG93bnMgaW4gb3VyIHVzZXJzXG5mdW5jdGlvbiBtYXNzYWdlQ3JlYXRlSW5kZXhSZXF1ZXN0KHJlcXVlc3REZWYpIHtcbiAgcmVxdWVzdERlZiA9IGNsb25lKHJlcXVlc3REZWYpO1xuXG4gIGlmICghcmVxdWVzdERlZi5pbmRleCkge1xuICAgIHJlcXVlc3REZWYuaW5kZXggPSB7fTtcbiAgfVxuXG4gIFsndHlwZScsICduYW1lJywgJ2Rkb2MnXS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAocmVxdWVzdERlZi5pbmRleFtrZXldKSB7XG4gICAgICByZXF1ZXN0RGVmW2tleV0gPSByZXF1ZXN0RGVmLmluZGV4W2tleV07XG4gICAgICBkZWxldGUgcmVxdWVzdERlZi5pbmRleFtrZXldO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHJlcXVlc3REZWYuZmllbGRzKSB7XG4gICAgcmVxdWVzdERlZi5pbmRleC5maWVsZHMgPSByZXF1ZXN0RGVmLmZpZWxkcztcbiAgICBkZWxldGUgcmVxdWVzdERlZi5maWVsZHM7XG4gIH1cblxuICBpZiAoIXJlcXVlc3REZWYudHlwZSkge1xuICAgIHJlcXVlc3REZWYudHlwZSA9ICdqc29uJztcbiAgfVxuICByZXR1cm4gcmVxdWVzdERlZjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdDsiLCIvLyB0aHJvd3MgaWYgdGhlIHVzZXIgaXMgdXNpbmcgdGhlIHdyb25nIHF1ZXJ5IGZpZWxkIHZhbHVlIHR5cGVcbmZ1bmN0aW9uIGNoZWNrRmllbGRWYWx1ZVR5cGUobmFtZSwgdmFsdWUsIGlzSHR0cCkge1xuXHR2YXIgbWVzc2FnZSA9ICcnO1xuXHR2YXIgcmVjZWl2ZWQgPSB2YWx1ZTtcblx0dmFyIGFkZFJlY2VpdmVkID0gdHJ1ZTtcblx0aWYgKFsgJyRpbicsICckbmluJywgJyRvcicsICckYW5kJywgJyRtb2QnLCAnJG5vcicsICckYWxsJyBdLmluZGV4T2YobmFtZSkgIT09IC0xKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0bWVzc2FnZSA9ICdRdWVyeSBvcGVyYXRvciAnICsgbmFtZSArICcgbXVzdCBiZSBhbiBhcnJheS4nO1xuXG5cdFx0fVxuXHR9XG5cblx0aWYgKFsgJyRub3QnLCAnJGVsZW1NYXRjaCcsICckYWxsTWF0Y2gnIF0uaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcblx0XHRpZiAoISghQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJyArIG5hbWUgKyAnIG11c3QgYmUgYW4gb2JqZWN0Lic7XG5cdFx0fVxuXHR9XG5cblx0aWYgKG5hbWUgPT09ICckbW9kJyAmJiBBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdGlmICh2YWx1ZS5sZW5ndGggIT09IDIpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJG1vZCBtdXN0IGJlIGluIHRoZSBmb3JtYXQgW2Rpdmlzb3IsIHJlbWFpbmRlcl0sICcgK1xuXHRcdFx0XHQnd2hlcmUgZGl2aXNvciBhbmQgcmVtYWluZGVyIGFyZSBib3RoIGludGVnZXJzLic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBkaXZpc29yID0gdmFsdWVbMF07XG5cdFx0XHR2YXIgbW9kID0gdmFsdWVbMV07XG5cdFx0XHRpZiAoZGl2aXNvciA9PT0gMCkge1xuXHRcdFx0XHRtZXNzYWdlID0gJ1F1ZXJ5IG9wZXJhdG9yICRtb2RcXCdzIGRpdmlzb3IgY2Fubm90IGJlIDAsIGNhbm5vdCBkaXZpZGUgYnkgemVyby4nO1xuXHRcdFx0XHRhZGRSZWNlaXZlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBkaXZpc29yICE9PSAnbnVtYmVyJyB8fCBwYXJzZUludChkaXZpc29yLCAxMCkgIT09IGRpdmlzb3IpIHtcblx0XHRcdFx0bWVzc2FnZSA9ICdRdWVyeSBvcGVyYXRvciAkbW9kXFwncyBkaXZpc29yIGlzIG5vdCBhbiBpbnRlZ2VyLic7XG5cdFx0XHRcdHJlY2VpdmVkID0gZGl2aXNvcjtcblx0XHRcdH1cblx0XHRcdGlmIChwYXJzZUludChtb2QsIDEwKSAhPT0gbW9kKSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJG1vZFxcJ3MgcmVtYWluZGVyIGlzIG5vdCBhbiBpbnRlZ2VyLic7XG5cdFx0XHRcdHJlY2VpdmVkID0gbW9kO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAobmFtZSA9PT0gJyRleGlzdHMnKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRtZXNzYWdlID0gJ1F1ZXJ5IG9wZXJhdG9yICRleGlzdHMgbXVzdCBiZSBhIGJvb2xlYW4uJztcblx0XHR9XG5cdH1cblxuXHRpZiAobmFtZSA9PT0gJyR0eXBlJykge1xuXHRcdHZhciBhbGxvd2VkID0gWyAnbnVsbCcsICdib29sZWFuJywgJ251bWJlcicsICdzdHJpbmcnLCAnYXJyYXknLCAnb2JqZWN0JyBdO1xuXHRcdHZhciBhbGxvd2VkU3RyID0gJ1wiJyArIGFsbG93ZWQuc2xpY2UoMCwgYWxsb3dlZC5sZW5ndGggLSAxKS5qb2luKCdcIiwgXCInKSArICdcIiwgb3IgXCInICsgYWxsb3dlZFthbGxvd2VkLmxlbmd0aCAtIDFdICsgJ1wiJztcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0bWVzc2FnZSA9ICdRdWVyeSBvcGVyYXRvciAkdHlwZSBtdXN0IGJlIGEgc3RyaW5nLiBTdXBwb3J0ZWQgdmFsdWVzOiAnICsgYWxsb3dlZFN0ciArICcuJztcblx0XHR9IGVsc2UgaWYgKGFsbG93ZWQuaW5kZXhPZih2YWx1ZSkgPT0gLTEpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJHR5cGUgbXVzdCBiZSBhIHN0cmluZy4gU3VwcG9ydGVkIHZhbHVlczogJyArIGFsbG93ZWRTdHIgKyAnLic7XG5cdFx0fVxuXHR9XG5cblx0aWYgKG5hbWUgPT09ICckc2l6ZScpIHtcblx0XHRpZiAocGFyc2VJbnQodmFsdWUsIDEwKSAhPT0gdmFsdWUpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJHNpemUgbXVzdCBiZSBhIGludGVnZXIuJztcblx0XHR9XG5cdH1cblxuXHRpZiAobmFtZSA9PT0gJyRyZWdleCcpIHtcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0aWYgKGlzSHR0cCkge1xuXHRcdFx0XHRtZXNzYWdlID0gJ1F1ZXJ5IG9wZXJhdG9yICRyZWdleCBtdXN0IGJlIGEgc3RyaW5nLic7XG5cdFx0XHR9IGVsc2UgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJHJlZ2V4IG11c3QgYmUgYSBzdHJpbmcgb3IgYW4gaW5zdGFuY2UgJyArXG5cdFx0XHRcdFx0J29mIGEgamF2YXNjcmlwdCByZWd1bGFyIGV4cHJlc3Npb24uJztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAobWVzc2FnZSkge1xuXHRcdGlmIChhZGRSZWNlaXZlZCkge1xuXG5cdFx0XHR2YXIgdHlwZSA9IHJlY2VpdmVkID09PSBudWxsXG5cdFx0XHQ/ICcgJ1xuXHRcdFx0OiBBcnJheS5pc0FycmF5KHJlY2VpdmVkKVxuXHRcdFx0PyAnIGFycmF5J1xuXHRcdFx0OiAnICcgKyB0eXBlb2YgcmVjZWl2ZWQ7XG5cdFx0XHR2YXIgcmVjZWl2ZWRTdHIgPSB0eXBlb2YgcmVjZWl2ZWQgPT09ICdvYmplY3QnICYmIHJlY2VpdmVkICE9PSBudWxsXG5cdFx0XHQ/ICBKU09OLnN0cmluZ2lmeShyZWNlaXZlZCwgbnVsbCwgJ1xcdCcpXG5cdFx0XHQ6IHJlY2VpdmVkO1xuXG5cdFx0XHRtZXNzYWdlICs9ICcgUmVjZWl2ZWQnICsgdHlwZSArICc6ICcgKyByZWNlaXZlZFN0cjtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuXHR9XG59XG5cblxudmFyIHJlcXVpcmVWYWxpZGF0aW9uID0gWyAnJGFsbCcsICckYWxsTWF0Y2gnLCAnJGFuZCcsICckZWxlbU1hdGNoJywgJyRleGlzdHMnLCAnJGluJywgJyRtb2QnLCAnJG5pbicsICckbm9yJywgJyRub3QnLCAnJG9yJywgJyRyZWdleCcsICckc2l6ZScsICckdHlwZScgXTtcblxudmFyIGFycmF5VHlwZUNvbXBhcmlzb25PcGVyYXRvcnMgPSBbICckaW4nLCAnJG5pbicsICckbW9kJywgJyRhbGwnXTtcblxudmFyIGVxdWFsaXR5T3BlcmF0b3JzID0gWyAnJGVxJywgJyRndCcsICckZ3RlJywgJyRsdCcsICckbHRlJyBdO1xuXG4vLyByZWN1cnNpdmVseSB3YWxrcyBkb3duIHRoZSBhIHF1ZXJ5IHNlbGVjdG9yIHZhbGlkYXRpbmcgYW55IG9wZXJhdG9yc1xuZnVuY3Rpb24gdmFsaWRhdGVTZWxlY3RvcihpbnB1dCwgaXNIdHRwKSB7XG5cdGlmIChBcnJheS5pc0FycmF5KGlucHV0KSkge1xuXHRcdGZvciAodmFyIGVudHJ5IG9mIGlucHV0KSB7XG5cdFx0XHRpZiAodHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHR2YWxpZGF0ZVNlbGVjdG9yKGVudHJ5LCBpc0h0dHApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR2YXIgZmllbGRzID0gT2JqZWN0LmtleXMoaW5wdXQpO1xuXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBrZXkgPSBmaWVsZHNbaV07XG5cdFx0XHR2YXIgdmFsdWUgPSBpbnB1dFtrZXldO1xuXG5cdFx0XHRpZiAocmVxdWlyZVZhbGlkYXRpb24uaW5kZXhPZihrZXkpICE9PSAtMSkge1xuXHRcdFx0XHRjaGVja0ZpZWxkVmFsdWVUeXBlKGtleSwgdmFsdWUsIGlzSHR0cCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXF1YWxpdHlPcGVyYXRvcnMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuXHRcdFx0XHQvLyBza2lwLCBleHBsaWNpdCBjb21wYXJpc29uIG9wZXJhdG9ycyBjYW4gYmUgYW55dGhpbmdcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYXJyYXlUeXBlQ29tcGFyaXNvbk9wZXJhdG9ycy5pbmRleE9mKGtleSkgIT09IC0xKSB7XG5cdFx0XHRcdC8vIHNraXAsIHRoZWlyIHZhbHVlcyBhcmUgYWxyZWFkeSB2YWxpZFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHRcdHZhbGlkYXRlU2VsZWN0b3IodmFsdWUsIGlzSHR0cCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHZhbGlkYXRlU2VsZWN0b3I7XG4iLCJpbXBvcnQgeyBnZW5lcmF0ZUVycm9yRnJvbVJlc3BvbnNlIH0gZnJvbSAncG91Y2hkYi1lcnJvcnMnO1xuaW1wb3J0IHsgSGVhZGVycyB9IGZyb20gJ3BvdWNoZGItZmV0Y2gnO1xuaW1wb3J0IG1hc3NhZ2VDcmVhdGVJbmRleFJlcXVlc3QgZnJvbSAnLi4vLi4vbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdCc7XG5pbXBvcnQgdmFsaWRhdGVTZWxlY3RvciBmcm9tICcuLi8uLi92YWxpZGF0ZVNlbGVjdG9yJztcblxuZnVuY3Rpb24gZGJGZXRjaChkYiwgcGF0aCwgb3B0cywgY2FsbGJhY2spIHtcbiAgdmFyIHN0YXR1cywgb2s7XG4gIG9wdHMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKHsnQ29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSk7XG4gIGRiLmZldGNoKHBhdGgsIG9wdHMpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgc3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgIG9rID0gcmVzcG9uc2Uub2s7XG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgfSkudGhlbihmdW5jdGlvbiAoanNvbikge1xuICAgIGlmICghb2spIHtcbiAgICAgIGpzb24uc3RhdHVzID0gc3RhdHVzO1xuICAgICAgdmFyIGVyciA9IGdlbmVyYXRlRXJyb3JGcm9tUmVzcG9uc2UoanNvbik7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhudWxsLCBqc29uKTtcbiAgICB9XG4gIH0pLmNhdGNoKGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5kZXgoZGIsIHJlcXVlc3REZWYsIGNhbGxiYWNrKSB7XG4gIHJlcXVlc3REZWYgPSBtYXNzYWdlQ3JlYXRlSW5kZXhSZXF1ZXN0KHJlcXVlc3REZWYpO1xuICBkYkZldGNoKGRiLCAnX2luZGV4Jywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3REZWYpXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZmluZChkYiwgcmVxdWVzdERlZiwgY2FsbGJhY2spIHtcbiAgdmFsaWRhdGVTZWxlY3RvcihyZXF1ZXN0RGVmLnNlbGVjdG9yLCB0cnVlKTtcbiAgZGJGZXRjaChkYiwgJ19maW5kJywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3REZWYpXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZXhwbGFpbihkYiwgcmVxdWVzdERlZiwgY2FsbGJhY2spIHtcbiAgZGJGZXRjaChkYiwgJ19leHBsYWluJywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3REZWYpXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5kZXhlcyhkYiwgY2FsbGJhY2spIHtcbiAgZGJGZXRjaChkYiwgJ19pbmRleCcsIHtcbiAgICBtZXRob2Q6ICdHRVQnXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZGVsZXRlSW5kZXgoZGIsIGluZGV4RGVmLCBjYWxsYmFjaykge1xuXG5cbiAgdmFyIGRkb2MgPSBpbmRleERlZi5kZG9jO1xuICB2YXIgdHlwZSA9IGluZGV4RGVmLnR5cGUgfHwgJ2pzb24nO1xuICB2YXIgbmFtZSA9IGluZGV4RGVmLm5hbWU7XG5cbiAgaWYgKCFkZG9jKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcigneW91IG11c3QgcHJvdmlkZSBhbiBpbmRleFxcJ3MgZGRvYycpKTtcbiAgfVxuXG4gIGlmICghbmFtZSkge1xuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ3lvdSBtdXN0IHByb3ZpZGUgYW4gaW5kZXhcXCdzIG5hbWUnKSk7XG4gIH1cblxuICB2YXIgdXJsID0gJ19pbmRleC8nICsgW2Rkb2MsIHR5cGUsIG5hbWVdLm1hcChlbmNvZGVVUklDb21wb25lbnQpLmpvaW4oJy8nKTtcblxuICBkYkZldGNoKGRiLCB1cmwsIHttZXRob2Q6ICdERUxFVEUnfSwgY2FsbGJhY2spO1xufVxuXG5leHBvcnQge1xuICBjcmVhdGVJbmRleCxcbiAgZmluZCxcbiAgZ2V0SW5kZXhlcyxcbiAgZGVsZXRlSW5kZXgsXG4gIGV4cGxhaW5cbn07XG4iLCJpbXBvcnQge1xuICBnZXRGaWVsZEZyb21Eb2MsXG4gIHNldEZpZWxkSW5Eb2MsXG4gIHBhcnNlRmllbGRcbn0gZnJvbSAncG91Y2hkYi1zZWxlY3Rvci1jb3JlJztcblxuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuZnVuY3Rpb24gb25jZShmdW4pIHtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uY2UgY2FsbGVkICBtb3JlIHRoYW4gb25jZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgZnVuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIHRvUHJvbWlzZShmdW5jKSB7XG4gIC8vY3JlYXRlIHRoZSBmdW5jdGlvbiB3ZSB3aWxsIGJlIHJldHVybmluZ1xuICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHRlbXBDQiA9ICh0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSA/IGFyZ3MucG9wKCkgOiBmYWxzZTtcbiAgICAvLyBpZiB0aGUgbGFzdCBhcmd1bWVudCBpcyBhIGZ1bmN0aW9uLCBhc3N1bWUgaXRzIGEgY2FsbGJhY2tcbiAgICB2YXIgdXNlZENCO1xuICAgIGlmICh0ZW1wQ0IpIHtcbiAgICAgIC8vIGlmIGl0IHdhcyBhIGNhbGxiYWNrLCBjcmVhdGUgYSBuZXcgY2FsbGJhY2sgd2hpY2ggY2FsbHMgaXQsXG4gICAgICAvLyBidXQgZG8gc28gYXN5bmMgc28gd2UgZG9uJ3QgdHJhcCBhbnkgZXJyb3JzXG4gICAgICB1c2VkQ0IgPSBmdW5jdGlvbiAoZXJyLCByZXNwKSB7XG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0ZW1wQ0IoZXJyLCByZXNwKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIH1cbiAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChmdWxmaWxsLCByZWplY3QpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IG9uY2UoZnVuY3Rpb24gKGVyciwgbWVzZykge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmdWxmaWxsKG1lc2cpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNyZWF0ZSBhIGNhbGxiYWNrIGZvciB0aGlzIGludm9jYXRpb25cbiAgICAgICAgLy8gYXBwbHkgdGhlIGZ1bmN0aW9uIGluIHRoZSBvcmlnIGNvbnRleHRcbiAgICAgICAgYXJncy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgZnVuYy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGlmIHRoZXJlIGlzIGEgY2FsbGJhY2ssIGNhbGwgaXQgYmFja1xuICAgIGlmICh1c2VkQ0IpIHtcbiAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgIHVzZWRDQihudWxsLCByZXN1bHQpO1xuICAgICAgfSwgdXNlZENCKTtcbiAgICB9XG4gICAgcHJvbWlzZS5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIHJldHVybiBwcm9taXNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiBjYWxsYmFja2lmeShmdW4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgdmFyIGNiID0gYXJncy5wb3AoKTtcbiAgICB2YXIgcHJvbWlzZSA9IGZ1bi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICBwcm9taXNlZENhbGxiYWNrKHByb21pc2UsIGNiKTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcHJvbWlzZWRDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjaykge1xuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlcyk7XG4gICAgfSk7XG4gIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBjYWxsYmFjayhyZWFzb24pO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbnZhciBmbGF0dGVuID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBzdWJBcnIgPSBhcmdzW2ldO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHN1YkFycikpIHtcbiAgICAgIHJlcyA9IHJlcy5jb25jYXQoZmxhdHRlbi5hcHBseShudWxsLCBzdWJBcnIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzLnB1c2goc3ViQXJyKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG5cbmZ1bmN0aW9uIG1lcmdlT2JqZWN0cyhhcnIpIHtcbiAgdmFyIHJlcyA9IHt9O1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcmVzID0gT2JqZWN0LmFzc2lnbihyZXMsIGFycltpXSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuLy8gU2VsZWN0cyBhIGxpc3Qgb2YgZmllbGRzIGRlZmluZWQgaW4gZG90IG5vdGF0aW9uIGZyb20gb25lIGRvY1xuLy8gYW5kIGNvcGllcyB0aGVtIHRvIGEgbmV3IGRvYy4gTGlrZSB1bmRlcnNjb3JlIF8ucGljayBidXQgc3VwcG9ydHMgbmVzdGluZy5cbmZ1bmN0aW9uIHBpY2sob2JqLCBhcnIpIHtcbiAgdmFyIHJlcyA9IHt9O1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZEZpZWxkID0gcGFyc2VGaWVsZChhcnJbaV0pO1xuICAgIHZhciB2YWx1ZSA9IGdldEZpZWxkRnJvbURvYyhvYmosIHBhcnNlZEZpZWxkKTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgc2V0RmllbGRJbkRvYyhyZXMsIHBhcnNlZEZpZWxkLCB2YWx1ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8vIGUuZy4gWydhJ10sIFsnYScsICdiJ10gaXMgdHJ1ZSwgYnV0IFsnYiddLCBbJ2EnLCAnYiddIGlzIGZhbHNlXG5mdW5jdGlvbiBvbmVBcnJheUlzU3ViQXJyYXlPZk90aGVyKGxlZnQsIHJpZ2h0KSB7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKGxlZnQubGVuZ3RoLCByaWdodC5sZW5ndGgpOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAobGVmdFtpXSAhPT0gcmlnaHRbaV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIGUuZy5bJ2EnLCAnYicsICdjJ10sIFsnYScsICdiJ10gaXMgZmFsc2VcbmZ1bmN0aW9uIG9uZUFycmF5SXNTdHJpY3RTdWJBcnJheU9mT3RoZXIobGVmdCwgcmlnaHQpIHtcblxuICBpZiAobGVmdC5sZW5ndGggPiByaWdodC5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gb25lQXJyYXlJc1N1YkFycmF5T2ZPdGhlcihsZWZ0LCByaWdodCk7XG59XG5cbi8vIHNhbWUgYXMgYWJvdmUsIGJ1dCB0cmVhdCB0aGUgbGVmdCBhcnJheSBhcyBhbiB1bm9yZGVyZWQgc2V0XG4vLyBlLmcuIFsnYicsICdhJ10sIFsnYScsICdiJywgJ2MnXSBpcyB0cnVlLCBidXQgWydjJ10sIFsnYScsICdiJywgJ2MnXSBpcyBmYWxzZVxuZnVuY3Rpb24gb25lU2V0SXNTdWJBcnJheU9mT3RoZXIobGVmdCwgcmlnaHQpIHtcbiAgbGVmdCA9IGxlZnQuc2xpY2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJpZ2h0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGZpZWxkID0gcmlnaHRbaV07XG4gICAgaWYgKCFsZWZ0Lmxlbmd0aCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHZhciBsZWZ0SWR4ID0gbGVmdC5pbmRleE9mKGZpZWxkKTtcbiAgICBpZiAobGVmdElkeCA9PT0gLTEpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGVmdC5zcGxpY2UobGVmdElkeCwgMSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBhcnJheVRvT2JqZWN0KGFycikge1xuICB2YXIgcmVzID0ge307XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICByZXNbYXJyW2ldXSA9IHRydWU7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gbWF4KGFyciwgZnVuKSB7XG4gIHZhciBtYXggPSBudWxsO1xuICB2YXIgbWF4U2NvcmUgPSAtMTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBlbGVtZW50ID0gYXJyW2ldO1xuICAgIHZhciBzY29yZSA9IGZ1bihlbGVtZW50KTtcbiAgICBpZiAoc2NvcmUgPiBtYXhTY29yZSkge1xuICAgICAgbWF4U2NvcmUgPSBzY29yZTtcbiAgICAgIG1heCA9IGVsZW1lbnQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBtYXg7XG59XG5cbmZ1bmN0aW9uIGFycmF5RXF1YWxzKGFycjEsIGFycjIpIHtcbiAgaWYgKGFycjEubGVuZ3RoICE9PSBhcnIyLmxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyMS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChhcnIxW2ldICE9PSBhcnIyW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiB1bmlxKGFycikge1xuICB2YXIgb2JqID0ge307XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgb2JqWyckJyArIGFycltpXV0gPSB0cnVlO1xuICB9XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIGtleS5zdWJzdHJpbmcoMSk7XG4gIH0pO1xufVxuXG5leHBvcnQge1xuICBhcnJheUVxdWFscyxcbiAgYXJyYXlUb09iamVjdCxcbiAgY2FsbGJhY2tpZnksXG4gIGZsYXR0ZW4sXG4gIG1heCxcbiAgbWVyZ2VPYmplY3RzLFxuICBvbmNlLFxuICBvbmVBcnJheUlzU3RyaWN0U3ViQXJyYXlPZk90aGVyLFxuICBvbmVBcnJheUlzU3ViQXJyYXlPZk90aGVyLFxuICBvbmVTZXRJc1N1YkFycmF5T2ZPdGhlcixcbiAgcGljayxcbiAgcHJvbWlzZWRDYWxsYmFjayxcbiAgdG9Qcm9taXNlLFxuICB1bmlxXG59O1xuIiwiaW1wb3J0IGFic3RyYWN0TWFwUmVkdWNlIGZyb20gJ3BvdWNoZGItYWJzdHJhY3QtbWFwcmVkdWNlJztcbmltcG9ydCB7IG1hdGNoZXNTZWxlY3RvciwgcGFyc2VGaWVsZCB9IGZyb20gJ3BvdWNoZGItc2VsZWN0b3ItY29yZSc7XG5cbi8vXG4vLyBPbmUgdGhpbmcgYWJvdXQgdGhlc2UgbWFwcGVyczpcbi8vXG4vLyBQZXIgdGhlIGFkdmljZSBvZiBKb2huLURhdmlkIERhbHRvbiAoaHR0cDovL3lvdXR1LmJlL050aG1lTEVoRERNKSxcbi8vIHdoYXQgeW91IHdhbnQgdG8gZG8gaW4gdGhpcyBjYXNlIGlzIG9wdGltaXplIGZvciB0aGUgc21hbGxlc3QgcG9zc2libGVcbi8vIGZ1bmN0aW9uLCBzaW5jZSB0aGF0J3MgdGhlIHRoaW5nIHRoYXQgZ2V0cyBydW4gb3ZlciBhbmQgb3ZlciBhZ2Fpbi5cbi8vXG4vLyBUaGlzIGNvZGUgd291bGQgYmUgYSBsb3Qgc2ltcGxlciBpZiBhbGwgdGhlIGlmL2Vsc2VzIHdlcmUgaW5zaWRlXG4vLyB0aGUgZnVuY3Rpb24sIGJ1dCBpdCB3b3VsZCBhbHNvIGJlIGEgbG90IGxlc3MgcGVyZm9ybWFudC5cbi8vXG5cblxuZnVuY3Rpb24gY3JlYXRlRGVlcE11bHRpTWFwcGVyKGZpZWxkcywgZW1pdCwgc2VsZWN0b3IpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkb2MpIHtcbiAgICBpZiAoc2VsZWN0b3IgJiYgIW1hdGNoZXNTZWxlY3Rvcihkb2MsIHNlbGVjdG9yKSkgeyByZXR1cm47IH1cbiAgICB2YXIgdG9FbWl0ID0gW107XG4gICAgZm9yICh2YXIgaSA9IDAsIGlMZW4gPSBmaWVsZHMubGVuZ3RoOyBpIDwgaUxlbjsgaSsrKSB7XG4gICAgICB2YXIgcGFyc2VkRmllbGQgPSBwYXJzZUZpZWxkKGZpZWxkc1tpXSk7XG4gICAgICB2YXIgdmFsdWUgPSBkb2M7XG4gICAgICBmb3IgKHZhciBqID0gMCwgakxlbiA9IHBhcnNlZEZpZWxkLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xuICAgICAgICB2YXIga2V5ID0gcGFyc2VkRmllbGRbal07XG4gICAgICAgIHZhbHVlID0gdmFsdWVba2V5XTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXR1cm47IC8vIGRvbid0IGVtaXRcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdG9FbWl0LnB1c2godmFsdWUpO1xuICAgIH1cbiAgICBlbWl0KHRvRW1pdCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURlZXBTaW5nbGVNYXBwZXIoZmllbGQsIGVtaXQsIHNlbGVjdG9yKSB7XG4gIHZhciBwYXJzZWRGaWVsZCA9IHBhcnNlRmllbGQoZmllbGQpO1xuICByZXR1cm4gZnVuY3Rpb24gKGRvYykge1xuICAgIGlmIChzZWxlY3RvciAmJiAhbWF0Y2hlc1NlbGVjdG9yKGRvYywgc2VsZWN0b3IpKSB7IHJldHVybjsgfVxuICAgIHZhciB2YWx1ZSA9IGRvYztcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcGFyc2VkRmllbGQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBwYXJzZWRGaWVsZFtpXTtcbiAgICAgIHZhbHVlID0gdmFsdWVba2V5XTtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjsgLy8gZG8gbm90aGluZ1xuICAgICAgfVxuICAgIH1cbiAgICBlbWl0KHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2hhbGxvd1NpbmdsZU1hcHBlcihmaWVsZCwgZW1pdCwgc2VsZWN0b3IpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkb2MpIHtcbiAgICBpZiAoc2VsZWN0b3IgJiYgIW1hdGNoZXNTZWxlY3Rvcihkb2MsIHNlbGVjdG9yKSkgeyByZXR1cm47IH1cbiAgICBlbWl0KGRvY1tmaWVsZF0pO1xuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTaGFsbG93TXVsdGlNYXBwZXIoZmllbGRzLCBlbWl0LCBzZWxlY3Rvcikge1xuICByZXR1cm4gZnVuY3Rpb24gKGRvYykge1xuICAgIGlmIChzZWxlY3RvciAmJiAhbWF0Y2hlc1NlbGVjdG9yKGRvYywgc2VsZWN0b3IpKSB7IHJldHVybjsgfVxuICAgIHZhciB0b0VtaXQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0b0VtaXQucHVzaChkb2NbZmllbGRzW2ldXSk7XG4gICAgfVxuICAgIGVtaXQodG9FbWl0KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2hlY2tTaGFsbG93KGZpZWxkcykge1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgIGlmIChmaWVsZC5pbmRleE9mKCcuJykgIT09IC0xKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNYXBwZXIoZmllbGRzLCBlbWl0LCBzZWxlY3Rvcikge1xuICB2YXIgaXNTaGFsbG93ID0gY2hlY2tTaGFsbG93KGZpZWxkcyk7XG4gIHZhciBpc1NpbmdsZSA9IGZpZWxkcy5sZW5ndGggPT09IDE7XG5cbiAgLy8gbm90aWNlIHdlIHRyeSB0byBvcHRpbWl6ZSBmb3IgdGhlIG1vc3QgY29tbW9uIGNhc2UsXG4gIC8vIGkuZS4gc2luZ2xlIHNoYWxsb3cgaW5kZXhlc1xuICBpZiAoaXNTaGFsbG93KSB7XG4gICAgaWYgKGlzU2luZ2xlKSB7XG4gICAgICByZXR1cm4gY3JlYXRlU2hhbGxvd1NpbmdsZU1hcHBlcihmaWVsZHNbMF0sIGVtaXQsIHNlbGVjdG9yKTtcbiAgICB9IGVsc2UgeyAvLyBtdWx0aVxuICAgICAgcmV0dXJuIGNyZWF0ZVNoYWxsb3dNdWx0aU1hcHBlcihmaWVsZHMsIGVtaXQsIHNlbGVjdG9yKTtcbiAgICB9XG4gIH0gZWxzZSB7IC8vIGRlZXBcbiAgICBpZiAoaXNTaW5nbGUpIHtcbiAgICAgIHJldHVybiBjcmVhdGVEZWVwU2luZ2xlTWFwcGVyKGZpZWxkc1swXSwgZW1pdCwgc2VsZWN0b3IpO1xuICAgIH0gZWxzZSB7IC8vIG11bHRpXG4gICAgICByZXR1cm4gY3JlYXRlRGVlcE11bHRpTWFwcGVyKGZpZWxkcywgZW1pdCwgc2VsZWN0b3IpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBtYXBwZXIobWFwRnVuRGVmLCBlbWl0KSB7XG4gIC8vIG1hcEZ1bkRlZiBpcyBhIGxpc3Qgb2YgZmllbGRzXG5cbiAgY29uc3QgZmllbGRzID0gT2JqZWN0LmtleXMobWFwRnVuRGVmLmZpZWxkcyk7XG4gIGNvbnN0IHBhcnRpYWxTZWxlY3RvciA9IG1hcEZ1bkRlZi5wYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvcjtcblxuICByZXR1cm4gY3JlYXRlTWFwcGVyKGZpZWxkcywgZW1pdCwgcGFydGlhbFNlbGVjdG9yKTtcbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmZ1bmN0aW9uIHJlZHVjZXIoLypyZWR1Y2VGdW5EZWYqLykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ3JlZHVjZSBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbmZ1bmN0aW9uIGRkb2NWYWxpZGF0b3IoZGRvYywgdmlld05hbWUpIHtcbiAgdmFyIHZpZXcgPSBkZG9jLnZpZXdzW3ZpZXdOYW1lXTtcbiAgLy8gVGhpcyBkb2Vzbid0IGFjdHVhbGx5IG5lZWQgdG8gYmUgaGVyZSBhcHBhcmVudGx5LCBidXRcbiAgLy8gSSBmZWVsIHNhZmVyIGtlZXBpbmcgaXQuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoIXZpZXcubWFwIHx8ICF2aWV3Lm1hcC5maWVsZHMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Rkb2MgJyArIGRkb2MuX2lkICsnIHdpdGggdmlldyAnICsgdmlld05hbWUgK1xuICAgICAgJyBkb2VzblxcJ3QgaGF2ZSBtYXAuZmllbGRzIGRlZmluZWQuICcgK1xuICAgICAgJ21heWJlIGl0IHdhc25cXCd0IGNyZWF0ZWQgYnkgdGhpcyBwbHVnaW4/Jyk7XG4gIH1cbn1cblxudmFyIGFic3RyYWN0TWFwcGVyID0gYWJzdHJhY3RNYXBSZWR1Y2UoXG4gIC8qIGxvY2FsRG9jTmFtZSAqLyAnaW5kZXhlcycsXG4gIG1hcHBlcixcbiAgcmVkdWNlcixcbiAgZGRvY1ZhbGlkYXRvclxuKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGRiKSB7XG4gIGlmIChkYi5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIENhbGxzIHRoZSBfY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyLCBidXQgd2l0aCBhIHRoaXJkIGFyZ3VtZW50OlxuICAgICAgLy8gdGhlIHN0YW5kYXJkIGZpbmRBYnN0cmFjdE1hcHBlciBxdWVyeS92aWV3Q2xlYW51cC5cbiAgICAgIC8vIFRoaXMgYWxsb3dzIHRoZSBpbmRleGVkZGIgYWRhcHRlciB0byBzdXBwb3J0IHBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yLlxuICAgICAgcXVlcnk6IGZ1bmN0aW9uIGFkZFF1ZXJ5RmFsbGJhY2soc2lnbmF0dXJlLCBvcHRzKSB7XG4gICAgICAgIHZhciBmYWxsYmFjayA9IGFic3RyYWN0TWFwcGVyLnF1ZXJ5LmJpbmQodGhpcyk7XG4gICAgICAgIHJldHVybiBkYi5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyLnF1ZXJ5LmNhbGwodGhpcywgc2lnbmF0dXJlLCBvcHRzLCBmYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgdmlld0NsZWFudXA6IGZ1bmN0aW9uIGFkZFZpZXdDbGVhbnVwRmFsbGJhY2soKSB7XG4gICAgICAgIHZhciBmYWxsYmFjayA9IGFic3RyYWN0TWFwcGVyLnZpZXdDbGVhbnVwLmJpbmQodGhpcyk7XG4gICAgICAgIHJldHVybiBkYi5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyLnZpZXdDbGVhbnVwLmNhbGwodGhpcywgZmFsbGJhY2spO1xuICAgICAgfVxuICAgIH07XG4gIH1cbiAgcmV0dXJuIGFic3RyYWN0TWFwcGVyO1xufVxuIiwiaW1wb3J0IHsgY29sbGF0ZSB9IGZyb20gJ3BvdWNoZGItY29sbGF0ZSc7XG5pbXBvcnQgeyBjbG9uZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHsgZ2V0S2V5LCBnZXRWYWx1ZSwgbWFzc2FnZVNlbGVjdG9yLCBwYXJzZUZpZWxkLCBnZXRGaWVsZEZyb21Eb2MgfSBmcm9tICdwb3VjaGRiLXNlbGVjdG9yLWNvcmUnO1xuXG4vLyBub3JtYWxpemUgdGhlIFwic29ydFwiIHZhbHVlXG5mdW5jdGlvbiBtYXNzYWdlU29ydChzb3J0KSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShzb3J0KSkge1xuICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzb3J0IGpzb24gLSBzaG91bGQgYmUgYW4gYXJyYXknKTtcbiAgfVxuICByZXR1cm4gc29ydC5tYXAoZnVuY3Rpb24gKHNvcnRpbmcpIHtcbiAgICBpZiAodHlwZW9mIHNvcnRpbmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICB2YXIgb2JqID0ge307XG4gICAgICBvYmpbc29ydGluZ10gPSAnYXNjJztcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzb3J0aW5nO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1hc3NhZ2VVc2VJbmRleCh1c2VJbmRleCkge1xuICB2YXIgY2xlYW5lZFVzZUluZGV4ID0gW107XG4gIGlmICh0eXBlb2YgdXNlSW5kZXggPT09ICdzdHJpbmcnKSB7XG4gICAgY2xlYW5lZFVzZUluZGV4LnB1c2godXNlSW5kZXgpO1xuICB9IGVsc2Uge1xuICAgIGNsZWFuZWRVc2VJbmRleCA9IHVzZUluZGV4O1xuICB9XG5cbiAgcmV0dXJuIGNsZWFuZWRVc2VJbmRleC5tYXAoZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKCdfZGVzaWduLycsICcnKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1hc3NhZ2VJbmRleERlZihpbmRleERlZikge1xuICBpbmRleERlZi5maWVsZHMgPSBpbmRleERlZi5maWVsZHMubWFwKGZ1bmN0aW9uIChmaWVsZCkge1xuICAgIGlmICh0eXBlb2YgZmllbGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB2YXIgb2JqID0ge307XG4gICAgICBvYmpbZmllbGRdID0gJ2FzYyc7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICByZXR1cm4gZmllbGQ7XG4gIH0pO1xuICBpZiAoaW5kZXhEZWYucGFydGlhbF9maWx0ZXJfc2VsZWN0b3IpIHtcbiAgICBpbmRleERlZi5wYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvciA9IG1hc3NhZ2VTZWxlY3RvcihcbiAgICAgIGluZGV4RGVmLnBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yXG4gICAgKTtcbiAgfVxuICByZXR1cm4gaW5kZXhEZWY7XG59XG5cbmZ1bmN0aW9uIGdldEtleUZyb21Eb2MoZG9jLCBpbmRleCkge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgaW5kZXguZGVmLmZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBmaWVsZCA9IGdldEtleShpbmRleC5kZWYuZmllbGRzW2ldKTtcbiAgICByZXMucHVzaChnZXRGaWVsZEZyb21Eb2MoZG9jLCBwYXJzZUZpZWxkKGZpZWxkKSkpO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8vIGhhdmUgdG8gZG8gdGhpcyBtYW51YWxseSBiZWNhdXNlIFJFQVNPTlMuIEkgZG9uJ3Qga25vdyB3aHlcbi8vIENvdWNoREIgZGlkbid0IGltcGxlbWVudCBpbmNsdXNpdmVfc3RhcnRcbmZ1bmN0aW9uIGZpbHRlckluY2x1c2l2ZVN0YXJ0KHJvd3MsIHRhcmdldFZhbHVlLCBpbmRleCkge1xuICB2YXIgaW5kZXhGaWVsZHMgPSBpbmRleC5kZWYuZmllbGRzO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcm93cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciByb3cgPSByb3dzW2ldO1xuXG4gICAgLy8gc2hhdmUgb2ZmIGFueSBkb2NzIGF0IHRoZSBiZWdpbm5pbmcgdGhhdCBhcmUgPD0gdGhlXG4gICAgLy8gdGFyZ2V0IHZhbHVlXG5cbiAgICB2YXIgZG9jS2V5ID0gZ2V0S2V5RnJvbURvYyhyb3cuZG9jLCBpbmRleCk7XG4gICAgaWYgKGluZGV4RmllbGRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgZG9jS2V5ID0gZG9jS2V5WzBdOyAvLyBvbmx5IG9uZSBmaWVsZCwgbm90IG11bHRpLWZpZWxkXG4gICAgfSBlbHNlIHsgLy8gbW9yZSB0aGFuIG9uZSBmaWVsZCBpbiBpbmRleFxuICAgICAgLy8gaW4gdGhlIGNhc2Ugd2hlcmUgZS5nLiB0aGUgdXNlciBpcyBzZWFyY2hpbmcgeyRndDoge2E6IDF9fVxuICAgICAgLy8gYnV0IHRoZSBpbmRleCBpcyBbYSwgYl0sIHRoZW4gd2UgbmVlZCB0byBzaG9ydGVuIHRoZSBkb2Mga2V5XG4gICAgICB3aGlsZSAoZG9jS2V5Lmxlbmd0aCA+IHRhcmdldFZhbHVlLmxlbmd0aCkge1xuICAgICAgICBkb2NLZXkucG9wKCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vQUJTIGFzIHdlIGp1c3QgbG9va2luZyBmb3IgdmFsdWVzIHRoYXQgZG9uJ3QgbWF0Y2hcbiAgICBpZiAoTWF0aC5hYnMoY29sbGF0ZShkb2NLZXksIHRhcmdldFZhbHVlKSkgPiAwKSB7XG4gICAgICAvLyBubyBuZWVkIHRvIGZpbHRlciBhbnkgZnVydGhlcjsgd2UncmUgcGFzdCB0aGUga2V5XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkgPiAwID8gcm93cy5zbGljZShpKSA6IHJvd3M7XG59XG5cbmZ1bmN0aW9uIHJldmVyc2VPcHRpb25zKG9wdHMpIHtcbiAgdmFyIG5ld09wdHMgPSBjbG9uZShvcHRzKTtcbiAgZGVsZXRlIG5ld09wdHMuc3RhcnRrZXk7XG4gIGRlbGV0ZSBuZXdPcHRzLmVuZGtleTtcbiAgZGVsZXRlIG5ld09wdHMuaW5jbHVzaXZlX3N0YXJ0O1xuICBkZWxldGUgbmV3T3B0cy5pbmNsdXNpdmVfZW5kO1xuXG4gIGlmICgnZW5ka2V5JyBpbiBvcHRzKSB7XG4gICAgbmV3T3B0cy5zdGFydGtleSA9IG9wdHMuZW5ka2V5O1xuICB9XG4gIGlmICgnc3RhcnRrZXknIGluIG9wdHMpIHtcbiAgICBuZXdPcHRzLmVuZGtleSA9IG9wdHMuc3RhcnRrZXk7XG4gIH1cbiAgaWYgKCdpbmNsdXNpdmVfc3RhcnQnIGluIG9wdHMpIHtcbiAgICBuZXdPcHRzLmluY2x1c2l2ZV9lbmQgPSBvcHRzLmluY2x1c2l2ZV9zdGFydDtcbiAgfVxuICBpZiAoJ2luY2x1c2l2ZV9lbmQnIGluIG9wdHMpIHtcbiAgICBuZXdPcHRzLmluY2x1c2l2ZV9zdGFydCA9IG9wdHMuaW5jbHVzaXZlX2VuZDtcbiAgfVxuICByZXR1cm4gbmV3T3B0cztcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVJbmRleChpbmRleCkge1xuICB2YXIgYXNjRmllbGRzID0gaW5kZXguZmllbGRzLmZpbHRlcihmdW5jdGlvbiAoZmllbGQpIHtcbiAgICByZXR1cm4gZ2V0VmFsdWUoZmllbGQpID09PSAnYXNjJztcbiAgfSk7XG4gIGlmIChhc2NGaWVsZHMubGVuZ3RoICE9PSAwICYmIGFzY0ZpZWxkcy5sZW5ndGggIT09IGluZGV4LmZpZWxkcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG1peGVkIHNvcnRpbmcnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVNvcnQocmVxdWVzdERlZiwgaW5kZXgpIHtcbiAgaWYgKGluZGV4LmRlZmF1bHRVc2VkICYmIHJlcXVlc3REZWYuc29ydCkge1xuICAgIHZhciBub25lSWRTb3J0cyA9IHJlcXVlc3REZWYuc29ydC5maWx0ZXIoZnVuY3Rpb24gKHNvcnRJdGVtKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoc29ydEl0ZW0pWzBdICE9PSAnX2lkJztcbiAgICB9KS5tYXAoZnVuY3Rpb24gKHNvcnRJdGVtKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoc29ydEl0ZW0pWzBdO1xuICAgIH0pO1xuXG4gICAgaWYgKG5vbmVJZFNvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNvcnQgb24gZmllbGQocykgXCInICsgbm9uZUlkU29ydHMuam9pbignLCcpICtcbiAgICAgICdcIiB3aGVuIHVzaW5nIHRoZSBkZWZhdWx0IGluZGV4Jyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGluZGV4LmRlZmF1bHRVc2VkKSB7XG4gICAgcmV0dXJuO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRmluZFJlcXVlc3QocmVxdWVzdERlZikge1xuICBpZiAodHlwZW9mIHJlcXVlc3REZWYuc2VsZWN0b3IgIT09ICdvYmplY3QnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd5b3UgbXVzdCBwcm92aWRlIGEgc2VsZWN0b3Igd2hlbiB5b3UgZmluZCgpJyk7XG4gIH1cblxuICAvKnZhciBzZWxlY3RvcnMgPSByZXF1ZXN0RGVmLnNlbGVjdG9yWyckYW5kJ10gfHwgW3JlcXVlc3REZWYuc2VsZWN0b3JdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzZWxlY3RvciA9IHNlbGVjdG9yc1tpXTtcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHNlbGVjdG9yKTtcbiAgICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBlbXB0eSBzZWxlY3RvcicpO1xuICAgIH1cbiAgICAvL3ZhciBzZWxlY3Rpb24gPSBzZWxlY3RvcltrZXlzWzBdXTtcbiAgICAvKmlmIChPYmplY3Qua2V5cyhzZWxlY3Rpb24pLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHNlbGVjdG9yOiAnICsgSlNPTi5zdHJpbmdpZnkoc2VsZWN0aW9uKSArXG4gICAgICAgICcgLSBpdCBtdXN0IGhhdmUgZXhhY3RseSBvbmUga2V5L3ZhbHVlJyk7XG4gICAgfVxuICB9Ki9cbn1cblxuLy8gZGV0ZXJtaW5lIHRoZSBtYXhpbXVtIG51bWJlciBvZiBmaWVsZHNcbi8vIHdlJ3JlIGdvaW5nIHRvIG5lZWQgdG8gcXVlcnksIGUuZy4gaWYgdGhlIHVzZXJcbi8vIGhhcyBzZWxlY3Rpb24gWydhJ10gYW5kIHNvcnRpbmcgWydhJywgJ2InXSwgdGhlbiB3ZVxuLy8gbmVlZCB0byB1c2UgdGhlIGxvbmdlciBvZiB0aGUgdHdvOiBbJ2EnLCAnYiddXG5mdW5jdGlvbiBnZXRVc2VyRmllbGRzKHNlbGVjdG9yLCBzb3J0KSB7XG4gIHZhciBzZWxlY3RvckZpZWxkcyA9IE9iamVjdC5rZXlzKHNlbGVjdG9yKTtcbiAgdmFyIHNvcnRGaWVsZHMgPSBzb3J0PyBzb3J0Lm1hcChnZXRLZXkpIDogW107XG4gIHZhciB1c2VyRmllbGRzO1xuICBpZiAoc2VsZWN0b3JGaWVsZHMubGVuZ3RoID49IHNvcnRGaWVsZHMubGVuZ3RoKSB7XG4gICAgdXNlckZpZWxkcyA9IHNlbGVjdG9yRmllbGRzO1xuICB9IGVsc2Uge1xuICAgIHVzZXJGaWVsZHMgPSBzb3J0RmllbGRzO1xuICB9XG5cbiAgaWYgKHNvcnRGaWVsZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZpZWxkczogdXNlckZpZWxkc1xuICAgIH07XG4gIH1cblxuICAvLyBzb3J0IGFjY29yZGluZyB0byB0aGUgdXNlcidzIHByZWZlcnJlZCBzb3J0aW5nXG4gIHVzZXJGaWVsZHMgPSB1c2VyRmllbGRzLnNvcnQoZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgdmFyIGxlZnRJZHggPSBzb3J0RmllbGRzLmluZGV4T2YobGVmdCk7XG4gICAgaWYgKGxlZnRJZHggPT09IC0xKSB7XG4gICAgICBsZWZ0SWR4ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICB9XG4gICAgdmFyIHJpZ2h0SWR4ID0gc29ydEZpZWxkcy5pbmRleE9mKHJpZ2h0KTtcbiAgICBpZiAocmlnaHRJZHggPT09IC0xKSB7XG4gICAgICByaWdodElkeCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgfVxuICAgIHJldHVybiBsZWZ0SWR4IDwgcmlnaHRJZHggPyAtMSA6IGxlZnRJZHggPiByaWdodElkeCA/IDEgOiAwO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGZpZWxkczogdXNlckZpZWxkcyxcbiAgICBzb3J0T3JkZXI6IHNvcnQubWFwKGdldEtleSlcbiAgfTtcbn1cblxuZXhwb3J0IHtcbiAgbWFzc2FnZVNvcnQsXG4gIHZhbGlkYXRlSW5kZXgsXG4gIHZhbGlkYXRlRmluZFJlcXVlc3QsXG4gIHZhbGlkYXRlU29ydCxcbiAgcmV2ZXJzZU9wdGlvbnMsXG4gIGZpbHRlckluY2x1c2l2ZVN0YXJ0LFxuICBtYXNzYWdlSW5kZXhEZWYsXG4gIGdldFVzZXJGaWVsZHMsXG4gIG1hc3NhZ2VVc2VJbmRleFxufTtcbiIsImltcG9ydCBhYnN0cmFjdE1hcHBlciBmcm9tICcuLi9hYnN0cmFjdC1tYXBwZXInO1xuaW1wb3J0IHsgbWFzc2FnZUluZGV4RGVmLCB2YWxpZGF0ZUluZGV4IH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgY2xvbmUsIHVwc2VydCB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHsgc3RyaW5nTWQ1IH0gZnJvbSAncG91Y2hkYi1jcnlwdG8nO1xuaW1wb3J0IG1hc3NhZ2VDcmVhdGVJbmRleFJlcXVlc3QgZnJvbSAnLi4vLi4vLi4vbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdCc7XG5pbXBvcnQgeyBtZXJnZU9iamVjdHMgfSBmcm9tICcuLi8uLi8uLi91dGlscyc7XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUluZGV4KGRiLCByZXF1ZXN0RGVmKSB7XG4gIHJlcXVlc3REZWYgPSBtYXNzYWdlQ3JlYXRlSW5kZXhSZXF1ZXN0KHJlcXVlc3REZWYpO1xuICB2YXIgb3JpZ2luYWxJbmRleERlZiA9IGNsb25lKHJlcXVlc3REZWYuaW5kZXgpO1xuICByZXF1ZXN0RGVmLmluZGV4ID0gbWFzc2FnZUluZGV4RGVmKHJlcXVlc3REZWYuaW5kZXgpO1xuXG4gIHZhbGlkYXRlSW5kZXgocmVxdWVzdERlZi5pbmRleCk7XG5cbiAgLy8gY2FsY3VsYXRpbmcgbWQ1IGlzIGV4cGVuc2l2ZSAtIG1lbW9pemUgYW5kIG9ubHlcbiAgLy8gcnVuIGlmIHJlcXVpcmVkXG4gIHZhciBtZDUgPSBhd2FpdCBzdHJpbmdNZDUoSlNPTi5zdHJpbmdpZnkocmVxdWVzdERlZikpO1xuICBcbiAgdmFyIHZpZXdOYW1lID0gcmVxdWVzdERlZi5uYW1lIHx8ICgnaWR4LScgKyBtZDUpO1xuXG4gIHZhciBkZG9jTmFtZSA9IHJlcXVlc3REZWYuZGRvYyB8fCAoJ2lkeC0nICsgbWQ1KTtcbiAgdmFyIGRkb2NJZCA9ICdfZGVzaWduLycgKyBkZG9jTmFtZTtcblxuICB2YXIgaGFzSW52YWxpZExhbmd1YWdlID0gZmFsc2U7XG4gIHZhciB2aWV3RXhpc3RzID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gdXBkYXRlRGRvYyhkb2MpIHtcbiAgICBpZiAoZG9jLl9yZXYgJiYgZG9jLmxhbmd1YWdlICE9PSAncXVlcnknKSB7XG4gICAgICBoYXNJbnZhbGlkTGFuZ3VhZ2UgPSB0cnVlO1xuICAgIH1cbiAgICBkb2MubGFuZ3VhZ2UgPSAncXVlcnknO1xuICAgIGRvYy52aWV3cyA9IGRvYy52aWV3cyB8fCB7fTtcblxuICAgIHZpZXdFeGlzdHMgPSAhIWRvYy52aWV3c1t2aWV3TmFtZV07XG5cbiAgICBpZiAodmlld0V4aXN0cykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGRvYy52aWV3c1t2aWV3TmFtZV0gPSB7XG4gICAgICBtYXA6IHtcbiAgICAgICAgZmllbGRzOiBtZXJnZU9iamVjdHMocmVxdWVzdERlZi5pbmRleC5maWVsZHMpLFxuICAgICAgICBwYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvcjogcmVxdWVzdERlZi5pbmRleC5wYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvclxuICAgICAgfSxcbiAgICAgIHJlZHVjZTogJ19jb3VudCcsXG4gICAgICBvcHRpb25zOiB7XG4gICAgICAgIGRlZjogb3JpZ2luYWxJbmRleERlZlxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gZG9jO1xuICB9XG5cbiAgZGIuY29uc3RydWN0b3IuZW1pdCgnZGVidWcnLCBbJ2ZpbmQnLCAnY3JlYXRpbmcgaW5kZXgnLCBkZG9jSWRdKTtcblxuICByZXR1cm4gdXBzZXJ0KGRiLCBkZG9jSWQsIHVwZGF0ZURkb2MpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgIGlmIChoYXNJbnZhbGlkTGFuZ3VhZ2UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBsYW5ndWFnZSBmb3IgZGRvYyB3aXRoIGlkIFwiJyArXG4gICAgICBkZG9jSWQgK1xuICAgICAgJ1wiIChzaG91bGQgYmUgXCJxdWVyeVwiKScpO1xuICAgIH1cbiAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgLy8ga2ljayBvZmYgYSBidWlsZFxuICAgIC8vIFRPRE86IGFic3RyYWN0LXBvdWNoZGItbWFwcmVkdWNlIHNob3VsZCBzdXBwb3J0IGF1dG8tdXBkYXRpbmdcbiAgICAvLyBUT0RPOiBzaG91bGQgYWxzbyB1c2UgdXBkYXRlX2FmdGVyLCBidXQgcG91Y2hkYi9wb3VjaGRiIzM0MTUgYmxvY2tzIG1lXG4gICAgdmFyIHNpZ25hdHVyZSA9IGRkb2NOYW1lICsgJy8nICsgdmlld05hbWU7XG4gICAgcmV0dXJuIGFic3RyYWN0TWFwcGVyKGRiKS5xdWVyeS5jYWxsKGRiLCBzaWduYXR1cmUsIHtcbiAgICAgIGxpbWl0OiAwLFxuICAgICAgcmVkdWNlOiBmYWxzZVxuICAgIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IGRkb2NJZCxcbiAgICAgICAgbmFtZTogdmlld05hbWUsXG4gICAgICAgIHJlc3VsdDogdmlld0V4aXN0cyA/ICdleGlzdHMnIDogJ2NyZWF0ZWQnXG4gICAgICB9O1xuICAgIH0pO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgY3JlYXRlSW5kZXg7XG4iLCJpbXBvcnQgeyBmbGF0dGVuIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHsgbWFzc2FnZUluZGV4RGVmIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgY29tcGFyZSB9IGZyb20gJ3BvdWNoZGItc2VsZWN0b3ItY29yZSc7XG5cbmZ1bmN0aW9uIGdldEluZGV4ZXMoZGIpIHtcbiAgLy8ganVzdCBzZWFyY2ggdGhyb3VnaCBhbGwgdGhlIGRlc2lnbiBkb2NzIGFuZCBmaWx0ZXIgaW4tbWVtb3J5LlxuICAvLyBob3BlZnVsbHkgdGhlcmUgYXJlbid0IHRoYXQgbWFueSBkZG9jcy5cbiAgcmV0dXJuIGRiLmFsbERvY3Moe1xuICAgIHN0YXJ0a2V5OiAnX2Rlc2lnbi8nLFxuICAgIGVuZGtleTogJ19kZXNpZ24vXFx1ZmZmZicsXG4gICAgaW5jbHVkZV9kb2NzOiB0cnVlXG4gIH0pLnRoZW4oZnVuY3Rpb24gKGFsbERvY3NSZXMpIHtcbiAgICB2YXIgcmVzID0ge1xuICAgICAgaW5kZXhlczogW3tcbiAgICAgICAgZGRvYzogbnVsbCxcbiAgICAgICAgbmFtZTogJ19hbGxfZG9jcycsXG4gICAgICAgIHR5cGU6ICdzcGVjaWFsJyxcbiAgICAgICAgZGVmOiB7XG4gICAgICAgICAgZmllbGRzOiBbe19pZDogJ2FzYyd9XVxuICAgICAgICB9XG4gICAgICB9XVxuICAgIH07XG5cbiAgICByZXMuaW5kZXhlcyA9IGZsYXR0ZW4ocmVzLmluZGV4ZXMsIGFsbERvY3NSZXMucm93cy5maWx0ZXIoZnVuY3Rpb24gKHJvdykge1xuICAgICAgcmV0dXJuIHJvdy5kb2MubGFuZ3VhZ2UgPT09ICdxdWVyeSc7XG4gICAgfSkubWFwKGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgIHZhciB2aWV3TmFtZXMgPSByb3cuZG9jLnZpZXdzICE9PSB1bmRlZmluZWQgPyBPYmplY3Qua2V5cyhyb3cuZG9jLnZpZXdzKSA6IFtdO1xuXG4gICAgICByZXR1cm4gdmlld05hbWVzLm1hcChmdW5jdGlvbiAodmlld05hbWUpIHtcbiAgICAgICAgdmFyIHZpZXcgPSByb3cuZG9jLnZpZXdzW3ZpZXdOYW1lXTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBkZG9jOiByb3cuaWQsXG4gICAgICAgICAgbmFtZTogdmlld05hbWUsXG4gICAgICAgICAgdHlwZTogJ2pzb24nLFxuICAgICAgICAgIGRlZjogbWFzc2FnZUluZGV4RGVmKHZpZXcub3B0aW9ucy5kZWYpXG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9KSk7XG5cbiAgICAvLyB0aGVzZSBhcmUgc29ydGVkIGJ5IHZpZXcgbmFtZSBmb3Igc29tZSByZWFzb25cbiAgICByZXMuaW5kZXhlcy5zb3J0KGZ1bmN0aW9uIChsZWZ0LCByaWdodCkge1xuICAgICAgcmV0dXJuIGNvbXBhcmUobGVmdC5uYW1lLCByaWdodC5uYW1lKTtcbiAgICB9KTtcbiAgICByZXMudG90YWxfcm93cyA9IHJlcy5pbmRleGVzLmxlbmd0aDtcbiAgICByZXR1cm4gcmVzO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZ2V0SW5kZXhlcztcbiIsImltcG9ydCB7XG4gIGdldFVzZXJGaWVsZHNcbn0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHtcbiAgZ2V0S2V5LFxuICBjb21wYXJlXG59IGZyb20gJ3BvdWNoZGItc2VsZWN0b3ItY29yZSc7XG5pbXBvcnQge1xuICBhcnJheUVxdWFscyxcbiAgYXJyYXlUb09iamVjdCxcbiAgZmxhdHRlbixcbiAgbWF4LFxuICBtZXJnZU9iamVjdHMsXG4gIG9uZUFycmF5SXNTdHJpY3RTdWJBcnJheU9mT3RoZXIsXG4gIG9uZUFycmF5SXNTdWJBcnJheU9mT3RoZXIsXG4gIG9uZVNldElzU3ViQXJyYXlPZk90aGVyLFxuICB1bmlxXG59IGZyb20gJy4uLy4uLy4uL3V0aWxzJztcblxuLy8gY291Y2hkYiBsb3dlc3QgY29sbGF0aW9uIHZhbHVlXG52YXIgQ09MTEFURV9MTyA9IG51bGw7XG5cbi8vIGNvdWNoZGIgaGlnaGVzdCBjb2xsYXRpb24gdmFsdWUgKFRPRE86IHdlbGwgbm90IHJlYWxseSwgYnV0IGNsb3NlIGVub3VnaCBhbWlyaXRlKVxudmFyIENPTExBVEVfSEkgPSB7XCJcXHVmZmZmXCI6IHt9fTtcblxuY29uc3QgU0hPUlRfQ0lSQ1VJVF9RVUVSWSA9IHtcbiAgcXVlcnlPcHRzOiB7IGxpbWl0OiAwLCBzdGFydGtleTogQ09MTEFURV9ISSwgZW5ka2V5OiBDT0xMQVRFX0xPIH0sXG4gIGluTWVtb3J5RmllbGRzOiBbXSxcbn07XG5cbi8vIGNvdWNoZGIgc2Vjb25kLWxvd2VzdCBjb2xsYXRpb24gdmFsdWVcblxuZnVuY3Rpb24gY2hlY2tGaWVsZEluSW5kZXgoaW5kZXgsIGZpZWxkKSB7XG4gIHZhciBpbmRleEZpZWxkcyA9IGluZGV4LmRlZi5maWVsZHMubWFwKGdldEtleSk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBpbmRleEZpZWxkcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBpbmRleEZpZWxkID0gaW5kZXhGaWVsZHNbaV07XG4gICAgaWYgKGZpZWxkID09PSBpbmRleEZpZWxkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vLyBzbyB3aGVuIHlvdSBkbyBlLmcuICRlcS8kZXEsIHdlIGNhbiBkbyBpdCBlbnRpcmVseSBpbiB0aGUgZGF0YWJhc2UuXG4vLyBidXQgd2hlbiB5b3UgZG8gZS5nLiAkZ3QvJGVxLCB0aGUgZmlyc3QgcGFydCBjYW4gYmUgZG9uZVxuLy8gaW4gdGhlIGRhdGFiYXNlLCBidXQgdGhlIHNlY29uZCBwYXJ0IGhhcyB0byBiZSBkb25lIGluLW1lbW9yeSxcbi8vIGJlY2F1c2UgJGd0IGhhcyBmb3JjZWQgdXMgdG8gbG9zZSBwcmVjaXNpb24uXG4vLyBzbyB0aGF0J3Mgd2hhdCB0aGlzIGRldGVybWluZXNcbmZ1bmN0aW9uIHVzZXJPcGVyYXRvckxvc2VzUHJlY2lzaW9uKHNlbGVjdG9yLCBmaWVsZCkge1xuICB2YXIgbWF0Y2hlciA9IHNlbGVjdG9yW2ZpZWxkXTtcbiAgdmFyIHVzZXJPcGVyYXRvciA9IGdldEtleShtYXRjaGVyKTtcblxuICByZXR1cm4gdXNlck9wZXJhdG9yICE9PSAnJGVxJztcbn1cblxuLy8gc29ydCB0aGUgdXNlciBmaWVsZHMgYnkgdGhlaXIgcG9zaXRpb24gaW4gdGhlIGluZGV4LFxuLy8gaWYgdGhleSdyZSBpbiB0aGUgaW5kZXhcbmZ1bmN0aW9uIHNvcnRGaWVsZHNCeUluZGV4KHVzZXJGaWVsZHMsIGluZGV4KSB7XG4gIHZhciBpbmRleEZpZWxkcyA9IGluZGV4LmRlZi5maWVsZHMubWFwKGdldEtleSk7XG5cbiAgcmV0dXJuIHVzZXJGaWVsZHMuc2xpY2UoKS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgdmFyIGFJZHggPSBpbmRleEZpZWxkcy5pbmRleE9mKGEpO1xuICAgIHZhciBiSWR4ID0gaW5kZXhGaWVsZHMuaW5kZXhPZihiKTtcbiAgICBpZiAoYUlkeCA9PT0gLTEpIHtcbiAgICAgIGFJZHggPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIH1cbiAgICBpZiAoYklkeCA9PT0gLTEpIHtcbiAgICAgIGJJZHggPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgIH1cbiAgICByZXR1cm4gY29tcGFyZShhSWR4LCBiSWR4KTtcbiAgfSk7XG59XG5cbi8vIGZpcnN0IHBhc3MgdG8gdHJ5IHRvIGZpbmQgZmllbGRzIHRoYXQgd2lsbCBuZWVkIHRvIGJlIHNvcnRlZCBpbi1tZW1vcnlcbmZ1bmN0aW9uIGdldEJhc2ljSW5NZW1vcnlGaWVsZHMoaW5kZXgsIHNlbGVjdG9yLCB1c2VyRmllbGRzKSB7XG5cbiAgdXNlckZpZWxkcyA9IHNvcnRGaWVsZHNCeUluZGV4KHVzZXJGaWVsZHMsIGluZGV4KTtcblxuICAvLyBjaGVjayBpZiBhbnkgb2YgdGhlIHVzZXIgc2VsZWN0b3JzIGxvc2UgcHJlY2lzaW9uXG4gIHZhciBuZWVkVG9GaWx0ZXJJbk1lbW9yeSA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gdXNlckZpZWxkcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBmaWVsZCA9IHVzZXJGaWVsZHNbaV07XG4gICAgaWYgKG5lZWRUb0ZpbHRlckluTWVtb3J5IHx8ICFjaGVja0ZpZWxkSW5JbmRleChpbmRleCwgZmllbGQpKSB7XG4gICAgICByZXR1cm4gdXNlckZpZWxkcy5zbGljZShpKTtcbiAgICB9XG4gICAgaWYgKGkgPCBsZW4gLSAxICYmIHVzZXJPcGVyYXRvckxvc2VzUHJlY2lzaW9uKHNlbGVjdG9yLCBmaWVsZCkpIHtcbiAgICAgIG5lZWRUb0ZpbHRlckluTWVtb3J5ID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIFtdO1xufVxuXG5mdW5jdGlvbiBnZXRJbk1lbW9yeUZpZWxkc0Zyb21OZShzZWxlY3Rvcikge1xuICB2YXIgZmllbGRzID0gW107XG4gIE9iamVjdC5rZXlzKHNlbGVjdG9yKS5mb3JFYWNoKGZ1bmN0aW9uIChmaWVsZCkge1xuICAgIHZhciBtYXRjaGVyID0gc2VsZWN0b3JbZmllbGRdO1xuICAgIE9iamVjdC5rZXlzKG1hdGNoZXIpLmZvckVhY2goZnVuY3Rpb24gKG9wZXJhdG9yKSB7XG4gICAgICBpZiAob3BlcmF0b3IgPT09ICckbmUnKSB7XG4gICAgICAgIGZpZWxkcy5wdXNoKGZpZWxkKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG4gIHJldHVybiBmaWVsZHM7XG59XG5cbmZ1bmN0aW9uIGdldEluTWVtb3J5RmllbGRzKGNvcmVJbk1lbW9yeUZpZWxkcywgaW5kZXgsIHNlbGVjdG9yLCB1c2VyRmllbGRzKSB7XG4gIHZhciByZXN1bHQgPSBmbGF0dGVuKFxuICAgIC8vIGluLW1lbW9yeSBmaWVsZHMgcmVwb3J0ZWQgYXMgbmVjZXNzYXJ5IGJ5IHRoZSBxdWVyeSBwbGFubmVyXG4gICAgY29yZUluTWVtb3J5RmllbGRzLFxuICAgIC8vIGNvbWJpbmUgd2l0aCBhbm90aGVyIHBhc3MgdGhhdCBjaGVja3MgZm9yIGFueSB3ZSBtYXkgaGF2ZSBtaXNzZWRcbiAgICBnZXRCYXNpY0luTWVtb3J5RmllbGRzKGluZGV4LCBzZWxlY3RvciwgdXNlckZpZWxkcyksXG4gICAgLy8gY29tYmluZSB3aXRoIGFub3RoZXIgcGFzcyB0aGF0IGNoZWNrcyBmb3IgJG5lJ3NcbiAgICBnZXRJbk1lbW9yeUZpZWxkc0Zyb21OZShzZWxlY3RvcilcbiAgKTtcblxuICByZXR1cm4gc29ydEZpZWxkc0J5SW5kZXgodW5pcShyZXN1bHQpLCBpbmRleCk7XG59XG5cbi8vIGNoZWNrIHRoYXQgYXQgbGVhc3Qgb25lIGZpZWxkIGluIHRoZSB1c2VyJ3MgcXVlcnkgaXMgcmVwcmVzZW50ZWRcbi8vIGluIHRoZSBpbmRleC4gb3JkZXIgbWF0dGVycyBpbiB0aGUgY2FzZSBvZiBzb3J0c1xuZnVuY3Rpb24gY2hlY2tJbmRleEZpZWxkc01hdGNoKGluZGV4RmllbGRzLCBzb3J0T3JkZXIsIGZpZWxkcykge1xuICBpZiAoc29ydE9yZGVyKSB7XG4gICAgLy8gYXJyYXkgaGFzIHRvIGJlIGEgc3RyaWN0IHN1YmFycmF5IG9mIGluZGV4IGFycmF5LiBmdXJ0aGVybW9yZSxcbiAgICAvLyB0aGUgc29ydE9yZGVyIGZpZWxkcyBuZWVkIHRvIGFsbCBiZSByZXByZXNlbnRlZCBpbiB0aGUgaW5kZXhcbiAgICB2YXIgc29ydE1hdGNoZXMgPSBvbmVBcnJheUlzU3RyaWN0U3ViQXJyYXlPZk90aGVyKHNvcnRPcmRlciwgaW5kZXhGaWVsZHMpO1xuICAgIHZhciBzZWxlY3Rvck1hdGNoZXMgPSBvbmVBcnJheUlzU3ViQXJyYXlPZk90aGVyKGZpZWxkcywgaW5kZXhGaWVsZHMpO1xuXG4gICAgcmV0dXJuIHNvcnRNYXRjaGVzICYmIHNlbGVjdG9yTWF0Y2hlcztcbiAgfVxuXG4gIC8vIGFsbCBvZiB0aGUgdXNlcidzIHNwZWNpZmllZCBmaWVsZHMgc3RpbGwgbmVlZCB0byBiZVxuICAvLyBvbiB0aGUgbGVmdCBzaWRlIG9mIHRoZSBpbmRleCBhcnJheSwgYWx0aG91Z2ggdGhlIG9yZGVyXG4gIC8vIGRvZXNuJ3QgbWF0dGVyXG4gIHJldHVybiBvbmVTZXRJc1N1YkFycmF5T2ZPdGhlcihmaWVsZHMsIGluZGV4RmllbGRzKTtcbn1cblxudmFyIGxvZ2ljYWxNYXRjaGVycyA9IFsnJGVxJywgJyRndCcsICckZ3RlJywgJyRsdCcsICckbHRlJ107XG5mdW5jdGlvbiBpc05vbkxvZ2ljYWxNYXRjaGVyKG1hdGNoZXIpIHtcbiAgcmV0dXJuIGxvZ2ljYWxNYXRjaGVycy5pbmRleE9mKG1hdGNoZXIpID09PSAtMTtcbn1cblxuLy8gY2hlY2sgYWxsIHRoZSBpbmRleCBmaWVsZHMgZm9yIHVzYWdlcyBvZiAnJG5lJ1xuLy8gZS5nLiBpZiB0aGUgdXNlciBxdWVyaWVzIHtmb286IHskbmU6ICdmb28nfSwgYmFyOiB7JGVxOiAnYmFyJ319LFxuLy8gdGhlbiB3ZSBjYW4gbmVpdGhlciB1c2UgYW4gaW5kZXggb24gWydmb28nXSBub3IgYW4gaW5kZXggb25cbi8vIFsnZm9vJywgJ2JhciddLCBidXQgd2UgY2FuIHVzZSBhbiBpbmRleCBvbiBbJ2JhciddIG9yIFsnYmFyJywgJ2ZvbyddXG5mdW5jdGlvbiBjaGVja0ZpZWxkc0xvZ2ljYWxseVNvdW5kKGluZGV4RmllbGRzLCBzZWxlY3Rvcikge1xuICB2YXIgZmlyc3RGaWVsZCA9IGluZGV4RmllbGRzWzBdO1xuICB2YXIgbWF0Y2hlciA9IHNlbGVjdG9yW2ZpcnN0RmllbGRdO1xuXG4gIGlmICh0eXBlb2YgbWF0Y2hlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdmFyIGlzSW52YWxpZE5lID0gT2JqZWN0LmtleXMobWF0Y2hlcikubGVuZ3RoID09PSAxICYmXG4gICAgZ2V0S2V5KG1hdGNoZXIpID09PSAnJG5lJztcblxuICByZXR1cm4gIWlzSW52YWxpZE5lO1xufVxuXG5mdW5jdGlvbiBjaGVja0luZGV4TWF0Y2hlcyhpbmRleCwgc29ydE9yZGVyLCBmaWVsZHMsIHNlbGVjdG9yKSB7XG5cbiAgdmFyIGluZGV4RmllbGRzID0gaW5kZXguZGVmLmZpZWxkcy5tYXAoZ2V0S2V5KTtcblxuICB2YXIgZmllbGRzTWF0Y2ggPSBjaGVja0luZGV4RmllbGRzTWF0Y2goaW5kZXhGaWVsZHMsIHNvcnRPcmRlciwgZmllbGRzKTtcblxuICBpZiAoIWZpZWxkc01hdGNoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIGNoZWNrRmllbGRzTG9naWNhbGx5U291bmQoaW5kZXhGaWVsZHMsIHNlbGVjdG9yKTtcbn1cblxuLy9cbi8vIHRoZSBhbGdvcml0aG0gaXMgdmVyeSBzaW1wbGU6XG4vLyB0YWtlIGFsbCB0aGUgZmllbGRzIHRoZSB1c2VyIHN1cHBsaWVzLCBhbmQgaWYgdGhvc2UgZmllbGRzXG4vLyBhcmUgYSBzdHJpY3Qgc3Vic2V0IG9mIHRoZSBmaWVsZHMgaW4gc29tZSBpbmRleCxcbi8vIHRoZW4gdXNlIHRoYXQgaW5kZXhcbi8vXG4vL1xuZnVuY3Rpb24gZmluZE1hdGNoaW5nSW5kZXhlcyhzZWxlY3RvciwgdXNlckZpZWxkcywgc29ydE9yZGVyLCBpbmRleGVzKSB7XG4gIHJldHVybiBpbmRleGVzLmZpbHRlcihmdW5jdGlvbiAoaW5kZXgpIHtcbiAgICByZXR1cm4gY2hlY2tJbmRleE1hdGNoZXMoaW5kZXgsIHNvcnRPcmRlciwgdXNlckZpZWxkcywgc2VsZWN0b3IpO1xuICB9KTtcbn1cblxuLy8gZmluZCB0aGUgYmVzdCBpbmRleCwgaS5lLiB0aGUgb25lIHRoYXQgbWF0Y2hlcyB0aGUgbW9zdCBmaWVsZHNcbi8vIGluIHRoZSB1c2VyJ3MgcXVlcnlcbmZ1bmN0aW9uIGZpbmRCZXN0TWF0Y2hpbmdJbmRleChzZWxlY3RvciwgdXNlckZpZWxkcywgc29ydE9yZGVyLCBpbmRleGVzLCB1c2VJbmRleCkge1xuXG4gIHZhciBtYXRjaGluZ0luZGV4ZXMgPSBmaW5kTWF0Y2hpbmdJbmRleGVzKHNlbGVjdG9yLCB1c2VyRmllbGRzLCBzb3J0T3JkZXIsIGluZGV4ZXMpO1xuXG4gIGlmIChtYXRjaGluZ0luZGV4ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKHVzZUluZGV4KSB7XG4gICAgICB0aHJvdyB7XG4gICAgICAgIGVycm9yOiBcIm5vX3VzYWJsZV9pbmRleFwiLFxuICAgICAgICBtZXNzYWdlOiBcIlRoZXJlIGlzIG5vIGluZGV4IGF2YWlsYWJsZSBmb3IgdGhpcyBzZWxlY3Rvci5cIlxuICAgICAgfTtcbiAgICB9XG4gICAgLy9yZXR1cm4gYGFsbF9kb2NzYCBhcyBhIGRlZmF1bHQgaW5kZXg7XG4gICAgLy9JJ20gYXNzdW1pbmcgdGhhdCBfYWxsX2RvY3MgaXMgYWx3YXlzIGZpcnN0XG4gICAgdmFyIGRlZmF1bHRJbmRleCA9IGluZGV4ZXNbMF07XG4gICAgZGVmYXVsdEluZGV4LmRlZmF1bHRVc2VkID0gdHJ1ZTtcbiAgICByZXR1cm4gZGVmYXVsdEluZGV4O1xuICB9XG4gIGlmIChtYXRjaGluZ0luZGV4ZXMubGVuZ3RoID09PSAxICYmICF1c2VJbmRleCkge1xuICAgIHJldHVybiBtYXRjaGluZ0luZGV4ZXNbMF07XG4gIH1cblxuICB2YXIgdXNlckZpZWxkc01hcCA9IGFycmF5VG9PYmplY3QodXNlckZpZWxkcyk7XG5cbiAgZnVuY3Rpb24gc2NvcmVJbmRleChpbmRleCkge1xuICAgIHZhciBpbmRleEZpZWxkcyA9IGluZGV4LmRlZi5maWVsZHMubWFwKGdldEtleSk7XG4gICAgdmFyIHNjb3JlID0gMDtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gaW5kZXhGaWVsZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBpbmRleEZpZWxkID0gaW5kZXhGaWVsZHNbaV07XG4gICAgICBpZiAodXNlckZpZWxkc01hcFtpbmRleEZpZWxkXSkge1xuICAgICAgICBzY29yZSsrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc2NvcmU7XG4gIH1cblxuICBpZiAodXNlSW5kZXgpIHtcbiAgICB2YXIgdXNlSW5kZXhEZG9jID0gJ19kZXNpZ24vJyArIHVzZUluZGV4WzBdO1xuICAgIHZhciB1c2VJbmRleE5hbWUgPSB1c2VJbmRleC5sZW5ndGggPT09IDIgPyB1c2VJbmRleFsxXSA6IGZhbHNlO1xuICAgIHZhciBpbmRleCA9IG1hdGNoaW5nSW5kZXhlcy5maW5kKGZ1bmN0aW9uIChpbmRleCkge1xuICAgICAgaWYgKHVzZUluZGV4TmFtZSAmJiBpbmRleC5kZG9jID09PSB1c2VJbmRleERkb2MgJiYgdXNlSW5kZXhOYW1lID09PSBpbmRleC5uYW1lKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5kZXguZGRvYyA9PT0gdXNlSW5kZXhEZG9jKSB7XG4gICAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSk7XG5cbiAgICBpZiAoIWluZGV4KSB7XG4gICAgICB0aHJvdyB7XG4gICAgICAgIGVycm9yOiBcInVua25vd25fZXJyb3JcIixcbiAgICAgICAgbWVzc2FnZTogXCJDb3VsZCBub3QgZmluZCB0aGF0IGluZGV4IG9yIGNvdWxkIG5vdCB1c2UgdGhhdCBpbmRleCBmb3IgdGhlIHF1ZXJ5XCJcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBpbmRleDtcbiAgfVxuXG4gIHJldHVybiBtYXgobWF0Y2hpbmdJbmRleGVzLCBzY29yZUluZGV4KTtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xlRmllbGRRdWVyeU9wdHNGb3IodXNlck9wZXJhdG9yLCB1c2VyVmFsdWUpIHtcbiAgc3dpdGNoICh1c2VyT3BlcmF0b3IpIHtcbiAgICBjYXNlICckZXEnOlxuICAgICAgcmV0dXJuIHtrZXk6IHVzZXJWYWx1ZX07XG4gICAgY2FzZSAnJGx0ZSc6XG4gICAgICByZXR1cm4ge2VuZGtleTogdXNlclZhbHVlfTtcbiAgICBjYXNlICckZ3RlJzpcbiAgICAgIHJldHVybiB7c3RhcnRrZXk6IHVzZXJWYWx1ZX07XG4gICAgY2FzZSAnJGx0JzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVuZGtleTogdXNlclZhbHVlLFxuICAgICAgICBpbmNsdXNpdmVfZW5kOiBmYWxzZVxuICAgICAgfTtcbiAgICBjYXNlICckZ3QnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhcnRrZXk6IHVzZXJWYWx1ZSxcbiAgICAgICAgaW5jbHVzaXZlX3N0YXJ0OiBmYWxzZVxuICAgICAgfTtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc3RhcnRrZXk6IENPTExBVEVfTE9cbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0U2luZ2xlRmllbGRDb3JlUXVlcnlQbGFuKHNlbGVjdG9yLCBpbmRleCkge1xuICB2YXIgZmllbGQgPSBnZXRLZXkoaW5kZXguZGVmLmZpZWxkc1swXSk7XG4gIC8vaWdub3JpbmcgdGhpcyBiZWNhdXNlIHRoZSB0ZXN0IHRvIGV4ZXJjaXNlIHRoZSBicmFuY2ggaXMgc2tpcHBlZCBhdCB0aGUgbW9tZW50XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gIHZhciBtYXRjaGVyID0gc2VsZWN0b3JbZmllbGRdIHx8IHt9O1xuICB2YXIgaW5NZW1vcnlGaWVsZHMgPSBbXTtcblxuICB2YXIgdXNlck9wZXJhdG9ycyA9IE9iamVjdC5rZXlzKG1hdGNoZXIpO1xuXG4gIHZhciBjb21iaW5lZE9wdHM7XG5cbiAgdXNlck9wZXJhdG9ycy5mb3JFYWNoKGZ1bmN0aW9uICh1c2VyT3BlcmF0b3IpIHtcblxuICAgIGlmIChpc05vbkxvZ2ljYWxNYXRjaGVyKHVzZXJPcGVyYXRvcikpIHtcbiAgICAgIGluTWVtb3J5RmllbGRzLnB1c2goZmllbGQpO1xuICAgIH1cblxuICAgIHZhciB1c2VyVmFsdWUgPSBtYXRjaGVyW3VzZXJPcGVyYXRvcl07XG5cbiAgICB2YXIgbmV3UXVlcnlPcHRzID0gZ2V0U2luZ2xlRmllbGRRdWVyeU9wdHNGb3IodXNlck9wZXJhdG9yLCB1c2VyVmFsdWUpO1xuXG4gICAgaWYgKGNvbWJpbmVkT3B0cykge1xuICAgICAgY29tYmluZWRPcHRzID0gbWVyZ2VPYmplY3RzKFtjb21iaW5lZE9wdHMsIG5ld1F1ZXJ5T3B0c10pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb21iaW5lZE9wdHMgPSBuZXdRdWVyeU9wdHM7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4ge1xuICAgIHF1ZXJ5T3B0czogY29tYmluZWRPcHRzLFxuICAgIGluTWVtb3J5RmllbGRzOiBpbk1lbW9yeUZpZWxkc1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRNdWx0aUZpZWxkQ29yZVF1ZXJ5UGxhbih1c2VyT3BlcmF0b3IsIHVzZXJWYWx1ZSkge1xuICBzd2l0Y2ggKHVzZXJPcGVyYXRvcikge1xuICAgIGNhc2UgJyRlcSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGFydGtleTogdXNlclZhbHVlLFxuICAgICAgICBlbmRrZXk6IHVzZXJWYWx1ZVxuICAgICAgfTtcbiAgICBjYXNlICckbHRlJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGVuZGtleTogdXNlclZhbHVlXG4gICAgICB9O1xuICAgIGNhc2UgJyRndGUnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhcnRrZXk6IHVzZXJWYWx1ZVxuICAgICAgfTtcbiAgICBjYXNlICckbHQnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5ka2V5OiB1c2VyVmFsdWUsXG4gICAgICAgIGluY2x1c2l2ZV9lbmQ6IGZhbHNlXG4gICAgICB9O1xuICAgIGNhc2UgJyRndCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGFydGtleTogdXNlclZhbHVlLFxuICAgICAgICBpbmNsdXNpdmVfc3RhcnQ6IGZhbHNlXG4gICAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpRmllbGRRdWVyeU9wdHMoc2VsZWN0b3IsIGluZGV4KSB7XG5cbiAgdmFyIGluZGV4RmllbGRzID0gaW5kZXguZGVmLmZpZWxkcy5tYXAoZ2V0S2V5KTtcblxuICB2YXIgaW5NZW1vcnlGaWVsZHMgPSBbXTtcbiAgdmFyIHN0YXJ0a2V5ID0gW107XG4gIHZhciBlbmRrZXkgPSBbXTtcbiAgdmFyIGluY2x1c2l2ZVN0YXJ0O1xuICB2YXIgaW5jbHVzaXZlRW5kO1xuXG5cbiAgZnVuY3Rpb24gZmluaXNoKGkpIHtcblxuICAgIGlmIChpbmNsdXNpdmVTdGFydCAhPT0gZmFsc2UpIHtcbiAgICAgIHN0YXJ0a2V5LnB1c2goQ09MTEFURV9MTyk7XG4gICAgfVxuICAgIGlmIChpbmNsdXNpdmVFbmQgIT09IGZhbHNlKSB7XG4gICAgICBlbmRrZXkucHVzaChDT0xMQVRFX0hJKTtcbiAgICB9XG4gICAgLy8ga2VlcCB0cmFjayBvZiB0aGUgZmllbGRzIHdoZXJlIHdlIGxvc3Qgc3BlY2lmaWNpdHksXG4gICAgLy8gYW5kIHRoZXJlZm9yZSBuZWVkIHRvIGZpbHRlciBpbi1tZW1vcnlcbiAgICBpbk1lbW9yeUZpZWxkcyA9IGluZGV4RmllbGRzLnNsaWNlKGkpO1xuICB9XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGluZGV4RmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGluZGV4RmllbGQgPSBpbmRleEZpZWxkc1tpXTtcblxuICAgIHZhciBtYXRjaGVyID0gc2VsZWN0b3JbaW5kZXhGaWVsZF07XG5cbiAgICBpZiAoIW1hdGNoZXIgfHwgIU9iamVjdC5rZXlzKG1hdGNoZXIpLmxlbmd0aCkgeyAvLyBmZXdlciBmaWVsZHMgaW4gdXNlciBxdWVyeSB0aGFuIGluIGluZGV4XG4gICAgICBmaW5pc2goaSk7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2UgaWYgKE9iamVjdC5rZXlzKG1hdGNoZXIpLnNvbWUoaXNOb25Mb2dpY2FsTWF0Y2hlcikpIHsgLy8gbm9uLWxvZ2ljYWwgYXJlIGlnbm9yZWRcbiAgICAgIGZpbmlzaChpKTtcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoaSA+IDApIHtcbiAgICAgIHZhciB1c2luZ0d0bHQgPSAoXG4gICAgICAgICckZ3QnIGluIG1hdGNoZXIgfHwgJyRndGUnIGluIG1hdGNoZXIgfHxcbiAgICAgICAgJyRsdCcgaW4gbWF0Y2hlciB8fCAnJGx0ZScgaW4gbWF0Y2hlcik7XG4gICAgICB2YXIgcHJldmlvdXNLZXlzID0gT2JqZWN0LmtleXMoc2VsZWN0b3JbaW5kZXhGaWVsZHNbaSAtIDFdXSk7XG4gICAgICB2YXIgcHJldmlvdXNXYXNFcSA9IGFycmF5RXF1YWxzKHByZXZpb3VzS2V5cywgWyckZXEnXSk7XG4gICAgICB2YXIgcHJldmlvdXNXYXNTYW1lID0gYXJyYXlFcXVhbHMocHJldmlvdXNLZXlzLCBPYmplY3Qua2V5cyhtYXRjaGVyKSk7XG4gICAgICB2YXIgZ3RsdExvc3RTcGVjaWZpY2l0eSA9IHVzaW5nR3RsdCAmJiAhcHJldmlvdXNXYXNFcSAmJiAhcHJldmlvdXNXYXNTYW1lO1xuICAgICAgaWYgKGd0bHRMb3N0U3BlY2lmaWNpdHkpIHtcbiAgICAgICAgZmluaXNoKGkpO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgdXNlck9wZXJhdG9ycyA9IE9iamVjdC5rZXlzKG1hdGNoZXIpO1xuXG4gICAgdmFyIGNvbWJpbmVkT3B0cyA9IG51bGw7XG5cbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IHVzZXJPcGVyYXRvcnMubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciB1c2VyT3BlcmF0b3IgPSB1c2VyT3BlcmF0b3JzW2pdO1xuICAgICAgdmFyIHVzZXJWYWx1ZSA9IG1hdGNoZXJbdXNlck9wZXJhdG9yXTtcblxuICAgICAgdmFyIG5ld09wdHMgPSBnZXRNdWx0aUZpZWxkQ29yZVF1ZXJ5UGxhbih1c2VyT3BlcmF0b3IsIHVzZXJWYWx1ZSk7XG5cbiAgICAgIGlmIChjb21iaW5lZE9wdHMpIHtcbiAgICAgICAgY29tYmluZWRPcHRzID0gbWVyZ2VPYmplY3RzKFtjb21iaW5lZE9wdHMsIG5ld09wdHNdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbWJpbmVkT3B0cyA9IG5ld09wdHM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc3RhcnRrZXkucHVzaCgnc3RhcnRrZXknIGluIGNvbWJpbmVkT3B0cyA/IGNvbWJpbmVkT3B0cy5zdGFydGtleSA6IENPTExBVEVfTE8pO1xuICAgIGVuZGtleS5wdXNoKCdlbmRrZXknIGluIGNvbWJpbmVkT3B0cyA/IGNvbWJpbmVkT3B0cy5lbmRrZXkgOiBDT0xMQVRFX0hJKTtcbiAgICBpZiAoJ2luY2x1c2l2ZV9zdGFydCcgaW4gY29tYmluZWRPcHRzKSB7XG4gICAgICBpbmNsdXNpdmVTdGFydCA9IGNvbWJpbmVkT3B0cy5pbmNsdXNpdmVfc3RhcnQ7XG4gICAgfVxuICAgIGlmICgnaW5jbHVzaXZlX2VuZCcgaW4gY29tYmluZWRPcHRzKSB7XG4gICAgICBpbmNsdXNpdmVFbmQgPSBjb21iaW5lZE9wdHMuaW5jbHVzaXZlX2VuZDtcbiAgICB9XG4gIH1cblxuICB2YXIgcmVzID0ge1xuICAgIHN0YXJ0a2V5OiBzdGFydGtleSxcbiAgICBlbmRrZXk6IGVuZGtleVxuICB9O1xuXG4gIGlmICh0eXBlb2YgaW5jbHVzaXZlU3RhcnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmVzLmluY2x1c2l2ZV9zdGFydCA9IGluY2x1c2l2ZVN0YXJ0O1xuICB9XG4gIGlmICh0eXBlb2YgaW5jbHVzaXZlRW5kICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJlcy5pbmNsdXNpdmVfZW5kID0gaW5jbHVzaXZlRW5kO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBxdWVyeU9wdHM6IHJlcyxcbiAgICBpbk1lbW9yeUZpZWxkczogaW5NZW1vcnlGaWVsZHNcbiAgfTtcbn1cblxuZnVuY3Rpb24gc2hvdWxkU2hvcnRDaXJjdWl0KHNlbGVjdG9yKSB7XG4gIC8vIFdlIGhhdmUgYSBmaWVsZCB0byBzZWxlY3QgZnJvbSwgYnV0IG5vdCBhIHZhbGlkIHZhbHVlXG4gIC8vIHRoaXMgc2hvdWxkIHJlc3VsdCBpbiBhIHNob3J0IGNpcmN1aXRlZCBxdWVyeSBcbiAgLy8ganVzdCBsaWtlIHRoZSBodHRwIGFkYXB0ZXIgKGNvdWNoZGIpIGFuZCBtb25nb2RiXG4gIC8vIHNlZSB0ZXN0cyBmb3IgaXNzdWUgIzc4MTBcbiAgXG4gIC8vIEB0b2RvIFVzZSAnT2JqZWN0LnZhbHVlcycgd2hlbiBOb2RlLmpzIHY2IHN1cHBvcnQgaXMgZHJvcHBlZC5cbiAgY29uc3QgdmFsdWVzID0gT2JqZWN0LmtleXMoc2VsZWN0b3IpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIHNlbGVjdG9yW2tleV07XG4gIH0pO1xuICByZXR1cm4gdmFsdWVzLnNvbWUoZnVuY3Rpb24gKHZhbCkgeyBcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcgJiYgT2JqZWN0LmtleXModmFsKS5sZW5ndGggPT09IDA7XG59KTtcbn1cblxuZnVuY3Rpb24gZ2V0RGVmYXVsdFF1ZXJ5UGxhbihzZWxlY3Rvcikge1xuICAvL3VzaW5nIGRlZmF1bHQgaW5kZXgsIHNvIGFsbCBmaWVsZHMgbmVlZCB0byBiZSBkb25lIGluIG1lbW9yeVxuICByZXR1cm4ge1xuICAgIHF1ZXJ5T3B0czoge3N0YXJ0a2V5OiBudWxsfSxcbiAgICBpbk1lbW9yeUZpZWxkczogW09iamVjdC5rZXlzKHNlbGVjdG9yKV1cbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0Q29yZVF1ZXJ5UGxhbihzZWxlY3RvciwgaW5kZXgpIHtcbiAgaWYgKGluZGV4LmRlZmF1bHRVc2VkKSB7XG4gICAgcmV0dXJuIGdldERlZmF1bHRRdWVyeVBsYW4oc2VsZWN0b3IsIGluZGV4KTtcbiAgfVxuXG4gIGlmIChpbmRleC5kZWYuZmllbGRzLmxlbmd0aCA9PT0gMSkge1xuICAgIC8vIG9uZSBmaWVsZCBpbiBpbmRleCwgc28gdGhlIHZhbHVlIHdhcyBpbmRleGVkIGFzIGEgc2luZ2xldG9uXG4gICAgcmV0dXJuIGdldFNpbmdsZUZpZWxkQ29yZVF1ZXJ5UGxhbihzZWxlY3RvciwgaW5kZXgpO1xuICB9XG4gIC8vIGVsc2UgaW5kZXggaGFzIG11bHRpcGxlIGZpZWxkcywgc28gdGhlIHZhbHVlIHdhcyBpbmRleGVkIGFzIGFuIGFycmF5XG4gIHJldHVybiBnZXRNdWx0aUZpZWxkUXVlcnlPcHRzKHNlbGVjdG9yLCBpbmRleCk7XG59XG5cbmZ1bmN0aW9uIHBsYW5RdWVyeShyZXF1ZXN0LCBpbmRleGVzKSB7XG5cbiAgdmFyIHNlbGVjdG9yID0gcmVxdWVzdC5zZWxlY3RvcjtcbiAgdmFyIHNvcnQgPSByZXF1ZXN0LnNvcnQ7XG5cbiAgaWYgKHNob3VsZFNob3J0Q2lyY3VpdChzZWxlY3RvcikpIHtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgU0hPUlRfQ0lSQ1VJVF9RVUVSWSwgeyBpbmRleDogaW5kZXhlc1swXSB9KTtcbiAgfVxuXG4gIHZhciB1c2VyRmllbGRzUmVzID0gZ2V0VXNlckZpZWxkcyhzZWxlY3Rvciwgc29ydCk7XG5cbiAgdmFyIHVzZXJGaWVsZHMgPSB1c2VyRmllbGRzUmVzLmZpZWxkcztcbiAgdmFyIHNvcnRPcmRlciA9IHVzZXJGaWVsZHNSZXMuc29ydE9yZGVyO1xuICB2YXIgaW5kZXggPSBmaW5kQmVzdE1hdGNoaW5nSW5kZXgoc2VsZWN0b3IsIHVzZXJGaWVsZHMsIHNvcnRPcmRlciwgaW5kZXhlcywgcmVxdWVzdC51c2VfaW5kZXgpO1xuXG4gIHZhciBjb3JlUXVlcnlQbGFuID0gZ2V0Q29yZVF1ZXJ5UGxhbihzZWxlY3RvciwgaW5kZXgpO1xuICB2YXIgcXVlcnlPcHRzID0gY29yZVF1ZXJ5UGxhbi5xdWVyeU9wdHM7XG4gIHZhciBjb3JlSW5NZW1vcnlGaWVsZHMgPSBjb3JlUXVlcnlQbGFuLmluTWVtb3J5RmllbGRzO1xuXG4gIHZhciBpbk1lbW9yeUZpZWxkcyA9IGdldEluTWVtb3J5RmllbGRzKGNvcmVJbk1lbW9yeUZpZWxkcywgaW5kZXgsIHNlbGVjdG9yLCB1c2VyRmllbGRzKTtcblxuICB2YXIgcmVzID0ge1xuICAgIHF1ZXJ5T3B0czogcXVlcnlPcHRzLFxuICAgIGluZGV4OiBpbmRleCxcbiAgICBpbk1lbW9yeUZpZWxkczogaW5NZW1vcnlGaWVsZHNcbiAgfTtcbiAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGRlZmF1bHQgcGxhblF1ZXJ5O1xuIiwiaW1wb3J0IHtjbG9uZX0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5pbXBvcnQgZ2V0SW5kZXhlcyBmcm9tICcuLi9nZXQtaW5kZXhlcyc7XG5pbXBvcnQge2NvbGxhdGV9IGZyb20gJ3BvdWNoZGItY29sbGF0ZSc7XG5pbXBvcnQgYWJzdHJhY3RNYXBwZXIgZnJvbSAnLi4vYWJzdHJhY3QtbWFwcGVyJztcbmltcG9ydCBwbGFuUXVlcnkgZnJvbSAnLi9xdWVyeS1wbGFubmVyJztcbmltcG9ydCB7XG4gIG1hc3NhZ2VTZWxlY3RvcixcbiAgZ2V0VmFsdWUsXG4gIGZpbHRlckluTWVtb3J5RmllbGRzXG59IGZyb20gJ3BvdWNoZGItc2VsZWN0b3ItY29yZSc7XG5pbXBvcnQge1xuICBtYXNzYWdlU29ydCxcbiAgdmFsaWRhdGVGaW5kUmVxdWVzdCxcbiAgdmFsaWRhdGVTb3J0LFxuICByZXZlcnNlT3B0aW9ucyxcbiAgZmlsdGVySW5jbHVzaXZlU3RhcnQsXG4gIG1hc3NhZ2VVc2VJbmRleFxufSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQge3BpY2t9IGZyb20gJy4uLy4uLy4uL3V0aWxzJztcbmltcG9ydCB2YWxpZGF0ZVNlbGVjdG9yIGZyb20gJy4uLy4uLy4uL3ZhbGlkYXRlU2VsZWN0b3InO1xuXG5mdW5jdGlvbiBpbmRleFRvU2lnbmF0dXJlKGluZGV4KSB7XG4gIC8vIHJlbW92ZSAnX2Rlc2lnbi8nXG4gIHJldHVybiBpbmRleC5kZG9jLnN1YnN0cmluZyg4KSArICcvJyArIGluZGV4Lm5hbWU7XG59XG5cbmZ1bmN0aW9uIGRvQWxsRG9jcyhkYiwgb3JpZ2luYWxPcHRzKSB7XG4gIHZhciBvcHRzID0gY2xvbmUob3JpZ2luYWxPcHRzKTtcblxuICAvLyBDb3VjaERCIHJlc3BvbmRzIGluIHdlaXJkIHdheXMgd2hlbiB5b3UgcHJvdmlkZSBhIG5vbi1zdHJpbmcgdG8gX2lkO1xuICAvLyB3ZSBtaW1pYyB0aGUgYmVoYXZpb3IgZm9yIGNvbnNpc3RlbmN5LiBTZWUgaXNzdWU2NiB0ZXN0cyBmb3IgZGV0YWlscy5cbiAgaWYgKG9wdHMuZGVzY2VuZGluZykge1xuICAgIGlmICgnZW5ka2V5JyBpbiBvcHRzICYmIHR5cGVvZiBvcHRzLmVuZGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdHMuZW5ka2V5ID0gJyc7XG4gICAgfVxuICAgIGlmICgnc3RhcnRrZXknIGluIG9wdHMgJiYgdHlwZW9mIG9wdHMuc3RhcnRrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRzLmxpbWl0ID0gMDtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKCdzdGFydGtleScgaW4gb3B0cyAmJiB0eXBlb2Ygb3B0cy5zdGFydGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdHMuc3RhcnRrZXkgPSAnJztcbiAgICB9XG4gICAgaWYgKCdlbmRrZXknIGluIG9wdHMgJiYgdHlwZW9mIG9wdHMuZW5ka2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgb3B0cy5saW1pdCA9IDA7XG4gICAgfVxuICB9XG4gIGlmICgna2V5JyBpbiBvcHRzICYmIHR5cGVvZiBvcHRzLmtleSAhPT0gJ3N0cmluZycpIHtcbiAgICBvcHRzLmxpbWl0ID0gMDtcbiAgfVxuXG4gIGlmIChvcHRzLmxpbWl0ID4gMCAmJiBvcHRzLmluZGV4ZXNfY291bnQpIHtcbiAgICAvLyBicnV0ZSBmb3JjZSBhbmQgcXVpdGUgbmFpdmUgaW1wbC5cbiAgICAvLyBhbXAgdXAgdGhlIGxpbWl0IHdpdGggdGhlIGFtb3VudCBvZiAoaW5kZXhlcykgZGVzaWduIGRvY3NcbiAgICAvLyBvciBpcyB0aGlzIHRvbyBuYWl2ZT8gSG93IGFib3V0IHNraXA/XG4gICAgb3B0cy5vcmlnaW5hbF9saW1pdCA9IG9wdHMubGltaXQ7XG4gICAgb3B0cy5saW1pdCArPSBvcHRzLmluZGV4ZXNfY291bnQ7XG4gIH1cblxuICByZXR1cm4gZGIuYWxsRG9jcyhvcHRzKVxuICAgIC50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgIC8vIGZpbHRlciBvdXQgYW55IGRlc2lnbiBkb2NzIHRoYXQgX2FsbF9kb2NzIG1pZ2h0IHJldHVyblxuICAgICAgcmVzLnJvd3MgPSByZXMucm93cy5maWx0ZXIoZnVuY3Rpb24gKHJvdykge1xuICAgICAgICByZXR1cm4gIS9eX2Rlc2lnblxcLy8udGVzdChyb3cuaWQpO1xuICAgICAgfSk7XG4gICAgICAvLyBwdXQgYmFjayBvcmlnaW5hbCBsaW1pdFxuICAgICAgaWYgKG9wdHMub3JpZ2luYWxfbGltaXQpIHtcbiAgICAgICAgb3B0cy5saW1pdCA9IG9wdHMub3JpZ2luYWxfbGltaXQ7XG4gICAgICB9XG4gICAgICAvLyBlbmZvcmNlIHRoZSByb3dzIHRvIHJlc3BlY3QgdGhlIGdpdmVuIGxpbWl0XG4gICAgICByZXMucm93cyA9IHJlcy5yb3dzLnNsaWNlKDAsIG9wdHMubGltaXQpO1xuICAgICAgcmV0dXJuIHJlcztcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gZmluZChkYiwgcmVxdWVzdERlZiwgZXhwbGFpbikge1xuICBpZiAocmVxdWVzdERlZi5zZWxlY3Rvcikge1xuICAgIC8vIG11c3QgYmUgdmFsaWRhdGVkIGJlZm9yZSBtYXNzYWdpbmdcbiAgICB2YWxpZGF0ZVNlbGVjdG9yKHJlcXVlc3REZWYuc2VsZWN0b3IsIGZhbHNlKTtcbiAgICByZXF1ZXN0RGVmLnNlbGVjdG9yID0gbWFzc2FnZVNlbGVjdG9yKHJlcXVlc3REZWYuc2VsZWN0b3IpO1xuICB9XG5cbiAgaWYgKHJlcXVlc3REZWYuc29ydCkge1xuICAgIHJlcXVlc3REZWYuc29ydCA9IG1hc3NhZ2VTb3J0KHJlcXVlc3REZWYuc29ydCk7XG4gIH1cblxuICBpZiAocmVxdWVzdERlZi51c2VfaW5kZXgpIHtcbiAgICByZXF1ZXN0RGVmLnVzZV9pbmRleCA9IG1hc3NhZ2VVc2VJbmRleChyZXF1ZXN0RGVmLnVzZV9pbmRleCk7XG4gIH1cblxuICB2YWxpZGF0ZUZpbmRSZXF1ZXN0KHJlcXVlc3REZWYpO1xuXG4gIHJldHVybiBnZXRJbmRleGVzKGRiKS50aGVuKGZ1bmN0aW9uIChnZXRJbmRleGVzUmVzKSB7XG5cbiAgICBkYi5jb25zdHJ1Y3Rvci5lbWl0KCdkZWJ1ZycsIFsnZmluZCcsICdwbGFubmluZyBxdWVyeScsIHJlcXVlc3REZWZdKTtcbiAgICB2YXIgcXVlcnlQbGFuID0gcGxhblF1ZXJ5KHJlcXVlc3REZWYsIGdldEluZGV4ZXNSZXMuaW5kZXhlcyk7XG4gICAgZGIuY29uc3RydWN0b3IuZW1pdCgnZGVidWcnLCBbJ2ZpbmQnLCAncXVlcnkgcGxhbicsIHF1ZXJ5UGxhbl0pO1xuXG4gICAgdmFyIGluZGV4VG9Vc2UgPSBxdWVyeVBsYW4uaW5kZXg7XG5cbiAgICB2YWxpZGF0ZVNvcnQocmVxdWVzdERlZiwgaW5kZXhUb1VzZSk7XG5cbiAgICB2YXIgb3B0cyA9IE9iamVjdC5hc3NpZ24oe1xuICAgICAgaW5jbHVkZV9kb2NzOiB0cnVlLFxuICAgICAgcmVkdWNlOiBmYWxzZSxcbiAgICAgIC8vIEFkZCBhbW91bnQgb2YgaW5kZXggZm9yIGRvQWxsRG9jcyB0byB1c2UgKHJlbGF0ZWQgdG8gaXNzdWUgIzc4MTApXG4gICAgICBpbmRleGVzX2NvdW50OiBnZXRJbmRleGVzUmVzLnRvdGFsX3Jvd3MsXG4gICAgfSwgcXVlcnlQbGFuLnF1ZXJ5T3B0cyk7XG5cbiAgICBpZiAoJ3N0YXJ0a2V5JyBpbiBvcHRzICYmICdlbmRrZXknIGluIG9wdHMgJiZcbiAgICAgICAgY29sbGF0ZShvcHRzLnN0YXJ0a2V5LCBvcHRzLmVuZGtleSkgPiAwKSB7XG4gICAgICAvLyBjYW4ndCBwb3NzaWJseSByZXR1cm4gYW55IHJlc3VsdHMsIHN0YXJ0a2V5ID4gZW5ka2V5XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgICAgcmV0dXJuIHtkb2NzOiBbXX07XG4gICAgfVxuXG4gICAgdmFyIGlzRGVzY2VuZGluZyA9IHJlcXVlc3REZWYuc29ydCAmJlxuICAgICAgdHlwZW9mIHJlcXVlc3REZWYuc29ydFswXSAhPT0gJ3N0cmluZycgJiZcbiAgICAgIGdldFZhbHVlKHJlcXVlc3REZWYuc29ydFswXSkgPT09ICdkZXNjJztcblxuICAgIGlmIChpc0Rlc2NlbmRpbmcpIHtcbiAgICAgIC8vIGVpdGhlciBhbGwgZGVzY2VuZGluZyBvciBhbGwgYXNjZW5kaW5nXG4gICAgICBvcHRzLmRlc2NlbmRpbmcgPSB0cnVlO1xuICAgICAgb3B0cyA9IHJldmVyc2VPcHRpb25zKG9wdHMpO1xuICAgIH1cblxuICAgIGlmICghcXVlcnlQbGFuLmluTWVtb3J5RmllbGRzLmxlbmd0aCkge1xuICAgICAgLy8gbm8gaW4tbWVtb3J5IGZpbHRlcmluZyBuZWNlc3NhcnksIHNvIHdlIGNhbiBsZXQgdGhlXG4gICAgICAvLyBkYXRhYmFzZSBkbyB0aGUgbGltaXQvc2tpcCBmb3IgdXNcbiAgICAgIGlmICgnbGltaXQnIGluIHJlcXVlc3REZWYpIHtcbiAgICAgICAgb3B0cy5saW1pdCA9IHJlcXVlc3REZWYubGltaXQ7XG4gICAgICB9XG4gICAgICBpZiAoJ3NraXAnIGluIHJlcXVlc3REZWYpIHtcbiAgICAgICAgb3B0cy5za2lwID0gcmVxdWVzdERlZi5za2lwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChleHBsYWluKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHF1ZXJ5UGxhbiwgb3B0cyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKGluZGV4VG9Vc2UubmFtZSA9PT0gJ19hbGxfZG9jcycpIHtcbiAgICAgICAgcmV0dXJuIGRvQWxsRG9jcyhkYiwgb3B0cyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgc2lnbmF0dXJlID0gaW5kZXhUb1NpZ25hdHVyZShpbmRleFRvVXNlKTtcbiAgICAgICAgcmV0dXJuIGFic3RyYWN0TWFwcGVyKGRiKS5xdWVyeS5jYWxsKGRiLCBzaWduYXR1cmUsIG9wdHMpO1xuICAgICAgfVxuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgaWYgKG9wdHMuaW5jbHVzaXZlX3N0YXJ0ID09PSBmYWxzZSkge1xuICAgICAgICAvLyBtYXkgaGF2ZSB0byBtYW51YWxseSBmaWx0ZXIgdGhlIGZpcnN0IG9uZSxcbiAgICAgICAgLy8gc2luY2UgY291Y2hkYiBoYXMgbm8gdHJ1ZSBpbmNsdXNpdmVfc3RhcnQgb3B0aW9uXG4gICAgICAgIHJlcy5yb3dzID0gZmlsdGVySW5jbHVzaXZlU3RhcnQocmVzLnJvd3MsIG9wdHMuc3RhcnRrZXksIGluZGV4VG9Vc2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAocXVlcnlQbGFuLmluTWVtb3J5RmllbGRzLmxlbmd0aCkge1xuICAgICAgICAvLyBuZWVkIHRvIGZpbHRlciBzb21lIHN0dWZmIGluLW1lbW9yeVxuICAgICAgICByZXMucm93cyA9IGZpbHRlckluTWVtb3J5RmllbGRzKHJlcy5yb3dzLCByZXF1ZXN0RGVmLCBxdWVyeVBsYW4uaW5NZW1vcnlGaWVsZHMpO1xuICAgICAgfVxuXG4gICAgICB2YXIgcmVzcCA9IHtcbiAgICAgICAgZG9jczogcmVzLnJvd3MubWFwKGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgICAgICB2YXIgZG9jID0gcm93LmRvYztcbiAgICAgICAgICBpZiAocmVxdWVzdERlZi5maWVsZHMpIHtcbiAgICAgICAgICAgIHJldHVybiBwaWNrKGRvYywgcmVxdWVzdERlZi5maWVsZHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZG9jO1xuICAgICAgICB9KVxuICAgICAgfTtcblxuICAgICAgaWYgKGluZGV4VG9Vc2UuZGVmYXVsdFVzZWQpIHtcbiAgICAgICAgcmVzcC53YXJuaW5nID0gJ05vIG1hdGNoaW5nIGluZGV4IGZvdW5kLCBjcmVhdGUgYW4gaW5kZXggdG8gb3B0aW1pemUgcXVlcnkgdGltZS4nO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzcDtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGV4cGxhaW4oZGIsIHJlcXVlc3REZWYpIHtcbiAgcmV0dXJuIGZpbmQoZGIsIHJlcXVlc3REZWYsIHRydWUpXG4gIC50aGVuKGZ1bmN0aW9uIChxdWVyeVBsYW4pIHtcbiAgICByZXR1cm4ge1xuICAgICAgZGJuYW1lOiBkYi5uYW1lLFxuICAgICAgaW5kZXg6IHF1ZXJ5UGxhbi5pbmRleCxcbiAgICAgIHNlbGVjdG9yOiByZXF1ZXN0RGVmLnNlbGVjdG9yLFxuICAgICAgcmFuZ2U6IHtcbiAgICAgICAgc3RhcnRfa2V5OiBxdWVyeVBsYW4ucXVlcnlPcHRzLnN0YXJ0a2V5LFxuICAgICAgICBlbmRfa2V5OiBxdWVyeVBsYW4ucXVlcnlPcHRzLmVuZGtleSxcbiAgICAgIH0sXG4gICAgICBvcHRzOiB7XG4gICAgICAgIHVzZV9pbmRleDogcmVxdWVzdERlZi51c2VfaW5kZXggfHwgW10sXG4gICAgICAgIGJvb2ttYXJrOiBcIm5pbFwiLCAvL2hhcmRjb2RlZCB0byBtYXRjaCBDb3VjaERCIHNpbmNlIGl0cyBub3Qgc3VwcG9ydGVkLFxuICAgICAgICBsaW1pdDogcmVxdWVzdERlZi5saW1pdCxcbiAgICAgICAgc2tpcDogcmVxdWVzdERlZi5za2lwLFxuICAgICAgICBzb3J0OiByZXF1ZXN0RGVmLnNvcnQgfHwge30sXG4gICAgICAgIGZpZWxkczogcmVxdWVzdERlZi5maWVsZHMsXG4gICAgICAgIGNvbmZsaWN0czogZmFsc2UsIC8vaGFyZGNvZGVkIHRvIG1hdGNoIENvdWNoREIgc2luY2UgaXRzIG5vdCBzdXBwb3J0ZWQsXG4gICAgICAgIHI6IFs0OV0sIC8vIGhhcmRjb2RlZCB0byBtYXRjaCBDb3VjaERCIHNpbmNlIGl0cyBub3Qgc3VwcG9ydFxuICAgICAgfSxcbiAgICAgIGxpbWl0OiByZXF1ZXN0RGVmLmxpbWl0LFxuICAgICAgc2tpcDogcmVxdWVzdERlZi5za2lwIHx8IDAsXG4gICAgICBmaWVsZHM6IHJlcXVlc3REZWYuZmllbGRzLFxuICAgIH07XG4gIH0pO1xufVxuXG5leHBvcnQgeyBmaW5kLCBleHBsYWluIH07XG4iLCJpbXBvcnQgYWJzdHJhY3RNYXBwZXIgZnJvbSAnLi4vYWJzdHJhY3QtbWFwcGVyJztcbmltcG9ydCB7IHVwc2VydCB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuXG5mdW5jdGlvbiBkZWxldGVJbmRleChkYiwgaW5kZXgpIHtcblxuICBpZiAoIWluZGV4LmRkb2MpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3lvdSBtdXN0IHN1cHBseSBhbiBpbmRleC5kZG9jIHdoZW4gZGVsZXRpbmcnKTtcbiAgfVxuXG4gIGlmICghaW5kZXgubmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigneW91IG11c3Qgc3VwcGx5IGFuIGluZGV4Lm5hbWUgd2hlbiBkZWxldGluZycpO1xuICB9XG5cbiAgdmFyIGRvY0lkID0gaW5kZXguZGRvYztcbiAgdmFyIHZpZXdOYW1lID0gaW5kZXgubmFtZTtcblxuICBmdW5jdGlvbiBkZWx0YUZ1bihkb2MpIHtcbiAgICBpZiAoT2JqZWN0LmtleXMoZG9jLnZpZXdzKS5sZW5ndGggPT09IDEgJiYgZG9jLnZpZXdzW3ZpZXdOYW1lXSkge1xuICAgICAgLy8gb25seSBvbmUgdmlldyBpbiB0aGlzIGRkb2MsIGRlbGV0ZSB0aGUgd2hvbGUgZGRvY1xuICAgICAgcmV0dXJuIHtfaWQ6IGRvY0lkLCBfZGVsZXRlZDogdHJ1ZX07XG4gICAgfVxuICAgIC8vIG1vcmUgdGhhbiBvbmUgdmlldyBoZXJlLCBqdXN0IHJlbW92ZSB0aGUgdmlld1xuICAgIGRlbGV0ZSBkb2Mudmlld3Nbdmlld05hbWVdO1xuICAgIHJldHVybiBkb2M7XG4gIH1cblxuICByZXR1cm4gdXBzZXJ0KGRiLCBkb2NJZCwgZGVsdGFGdW4pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhYnN0cmFjdE1hcHBlcihkYikudmlld0NsZWFudXAuYXBwbHkoZGIpO1xuICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge29rOiB0cnVlfTtcbiAgfSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGRlbGV0ZUluZGV4O1xuIiwiaW1wb3J0IHsgY2FsbGJhY2tpZnkgfSBmcm9tICcuLi8uLi91dGlscyc7XG5pbXBvcnQgY3JlYXRlSW5kZXggZnJvbSAnLi9jcmVhdGUtaW5kZXgnO1xuaW1wb3J0IHtmaW5kLCAgZXhwbGFpbiB9IGZyb20gJy4vZmluZCc7XG5pbXBvcnQgZ2V0SW5kZXhlcyBmcm9tICcuL2dldC1pbmRleGVzJztcbmltcG9ydCBkZWxldGVJbmRleCBmcm9tICcuL2RlbGV0ZS1pbmRleCc7XG5cbnZhciBjcmVhdGVJbmRleEFzQ2FsbGJhY2sgPSBjYWxsYmFja2lmeShjcmVhdGVJbmRleCk7XG52YXIgZmluZEFzQ2FsbGJhY2sgPSBjYWxsYmFja2lmeShmaW5kKTtcbnZhciBleHBsYWluQXNDYWxsYmFjayA9IGNhbGxiYWNraWZ5KGV4cGxhaW4pO1xudmFyIGdldEluZGV4ZXNBc0NhbGxiYWNrID0gY2FsbGJhY2tpZnkoZ2V0SW5kZXhlcyk7XG52YXIgZGVsZXRlSW5kZXhBc0NhbGxiYWNrID0gY2FsbGJhY2tpZnkoZGVsZXRlSW5kZXgpO1xuXG5leHBvcnQge1xuICBjcmVhdGVJbmRleEFzQ2FsbGJhY2sgYXMgY3JlYXRlSW5kZXgsXG4gIGZpbmRBc0NhbGxiYWNrIGFzIGZpbmQsXG4gIGdldEluZGV4ZXNBc0NhbGxiYWNrIGFzIGdldEluZGV4ZXMsXG4gIGRlbGV0ZUluZGV4QXNDYWxsYmFjayBhcyBkZWxldGVJbmRleCxcbiAgZXhwbGFpbkFzQ2FsbGJhY2sgYXMgZXhwbGFpblxufTtcbiIsImltcG9ydCB7IHRvUHJvbWlzZSwgaXNSZW1vdGUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCAqIGFzIGh0dHAgZnJvbSAnLi9hZGFwdGVycy9odHRwL2luZGV4JztcbmltcG9ydCAqIGFzIGxvY2FsIGZyb20gJy4vYWRhcHRlcnMvbG9jYWwvaW5kZXgnO1xuXG52YXIgcGx1Z2luID0ge307XG5wbHVnaW4uY3JlYXRlSW5kZXggPSB0b1Byb21pc2UoZnVuY3Rpb24gKHJlcXVlc3REZWYsIGNhbGxiYWNrKSB7XG5cbiAgaWYgKHR5cGVvZiByZXF1ZXN0RGVmICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ3lvdSBtdXN0IHByb3ZpZGUgYW4gaW5kZXggdG8gY3JlYXRlJykpO1xuICB9XG5cbiAgdmFyIGNyZWF0ZUluZGV4ID0gaXNSZW1vdGUodGhpcykgP1xuICAgIGh0dHAuY3JlYXRlSW5kZXggOiBsb2NhbC5jcmVhdGVJbmRleDtcbiAgY3JlYXRlSW5kZXgodGhpcywgcmVxdWVzdERlZiwgY2FsbGJhY2spO1xufSk7XG5cbnBsdWdpbi5maW5kID0gdG9Qcm9taXNlKGZ1bmN0aW9uIChyZXF1ZXN0RGVmLCBjYWxsYmFjaykge1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgY2FsbGJhY2sgPSByZXF1ZXN0RGVmO1xuICAgIHJlcXVlc3REZWYgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAodHlwZW9mIHJlcXVlc3REZWYgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcigneW91IG11c3QgcHJvdmlkZSBzZWFyY2ggcGFyYW1ldGVycyB0byBmaW5kKCknKSk7XG4gIH1cblxuICB2YXIgZmluZCA9IGlzUmVtb3RlKHRoaXMpID8gaHR0cC5maW5kIDogbG9jYWwuZmluZDtcbiAgZmluZCh0aGlzLCByZXF1ZXN0RGVmLCBjYWxsYmFjayk7XG59KTtcblxucGx1Z2luLmV4cGxhaW4gPSB0b1Byb21pc2UoZnVuY3Rpb24gKHJlcXVlc3REZWYsIGNhbGxiYWNrKSB7XG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjYWxsYmFjayA9IHJlcXVlc3REZWY7XG4gICAgcmVxdWVzdERlZiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcmVxdWVzdERlZiAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCd5b3UgbXVzdCBwcm92aWRlIHNlYXJjaCBwYXJhbWV0ZXJzIHRvIGV4cGxhaW4oKScpKTtcbiAgfVxuXG4gIHZhciBmaW5kID0gaXNSZW1vdGUodGhpcykgPyBodHRwLmV4cGxhaW4gOiBsb2NhbC5leHBsYWluO1xuICBmaW5kKHRoaXMsIHJlcXVlc3REZWYsIGNhbGxiYWNrKTtcbn0pO1xuXG5wbHVnaW4uZ2V0SW5kZXhlcyA9IHRvUHJvbWlzZShmdW5jdGlvbiAoY2FsbGJhY2spIHtcblxuICB2YXIgZ2V0SW5kZXhlcyA9IGlzUmVtb3RlKHRoaXMpID8gaHR0cC5nZXRJbmRleGVzIDogbG9jYWwuZ2V0SW5kZXhlcztcbiAgZ2V0SW5kZXhlcyh0aGlzLCBjYWxsYmFjayk7XG59KTtcblxucGx1Z2luLmRlbGV0ZUluZGV4ID0gdG9Qcm9taXNlKGZ1bmN0aW9uIChpbmRleERlZiwgY2FsbGJhY2spIHtcblxuICBpZiAodHlwZW9mIGluZGV4RGVmICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ3lvdSBtdXN0IHByb3ZpZGUgYW4gaW5kZXggdG8gZGVsZXRlJykpO1xuICB9XG5cbiAgdmFyIGRlbGV0ZUluZGV4ID0gaXNSZW1vdGUodGhpcykgP1xuICAgIGh0dHAuZGVsZXRlSW5kZXggOiBsb2NhbC5kZWxldGVJbmRleDtcbiAgZGVsZXRlSW5kZXgodGhpcywgaW5kZXhEZWYsIGNhbGxiYWNrKTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBwbHVnaW47XG4iXSwibmFtZXMiOlsiY3JlYXRlSW5kZXgiLCJmaW5kIiwiZXhwbGFpbiIsImdldEluZGV4ZXMiLCJkZWxldGVJbmRleCIsIm5leHRUaWNrIiwiYWJzdHJhY3RNYXBSZWR1Y2UiLCJhYnN0cmFjdE1hcHBlciIsImh0dHAuY3JlYXRlSW5kZXgiLCJsb2NhbC5jcmVhdGVJbmRleCIsImh0dHAuZmluZCIsImxvY2FsLmZpbmQiLCJodHRwLmV4cGxhaW4iLCJsb2NhbC5leHBsYWluIiwiaHR0cC5nZXRJbmRleGVzIiwibG9jYWwuZ2V0SW5kZXhlcyIsImh0dHAuZGVsZXRlSW5kZXgiLCJsb2NhbC5kZWxldGVJbmRleCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUU7QUFDL0MsRUFBRSxVQUFVLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ2pDO0FBQ0EsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRTtBQUN6QixJQUFJLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO0FBQzFCLEdBQUc7QUFDSDtBQUNBLEVBQUUsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEdBQUcsRUFBRTtBQUNsRCxJQUFJLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUMvQixNQUFNLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzlDLE1BQU0sT0FBTyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ25DLEtBQUs7QUFDTCxHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUU7QUFDekIsSUFBSSxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO0FBQ2hELElBQUksT0FBTyxVQUFVLENBQUMsTUFBTSxDQUFDO0FBQzdCLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUU7QUFDeEIsSUFBSSxVQUFVLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQztBQUM3QixHQUFHO0FBQ0gsRUFBRSxPQUFPLFVBQVUsQ0FBQztBQUNwQjs7QUM3QkE7QUFDQSxT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
