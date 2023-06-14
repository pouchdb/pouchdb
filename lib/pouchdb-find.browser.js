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
import { s as stringMd5 } from './stringMd5-browser-5aecd2bd.js';
import './_commonjsHelpers-24198af3.js';
import './guardedConsole-f54e5a40.js';
import './flatten-994f45c6.js';
import './base64StringToBlobOrBuffer-browser-ac90e85f.js';
import './base64-browser-5f7b6479.js';
import './binaryStringToBlobOrBuffer-browser-7dc25c1d.js';
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

function createIndex(db, requestDef) {
  requestDef = massageCreateIndexRequest(requestDef);
  var originalIndexDef = clone(requestDef.index);
  requestDef.index = massageIndexDef(requestDef.index);

  validateIndex(requestDef.index);

  // calculating md5 is expensive - memoize and only
  // run if required
  var md5;
  function getMd5() {
    return md5 || (md5 = stringMd5(JSON.stringify(requestDef)));
  }

  var viewName = requestDef.name || ('idx-' + getMd5());

  var ddocName = requestDef.ddoc || ('idx-' + getMd5());
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1maW5kLmJyb3dzZXIuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvdmFsaWRhdGVTZWxlY3Rvci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvaHR0cC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvdXRpbHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2Fic3RyYWN0LW1hcHBlci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvdXRpbHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2NyZWF0ZS1pbmRleC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvZ2V0LWluZGV4ZXMvaW5kZXguanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLWZpbmQvc3JjL2FkYXB0ZXJzL2xvY2FsL2ZpbmQvcXVlcnktcGxhbm5lci5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvZmluZC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvYWRhcHRlcnMvbG9jYWwvZGVsZXRlLWluZGV4L2luZGV4LmpzIiwiLi4vcGFja2FnZXMvcG91Y2hkYi1maW5kL3NyYy9hZGFwdGVycy9sb2NhbC9pbmRleC5qcyIsIi4uL3BhY2thZ2VzL3BvdWNoZGItZmluZC9zcmMvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2xvbmUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuLy8gd2UgcmVzdHVjdHVyZSB0aGUgc3VwcGxpZWQgSlNPTiBjb25zaWRlcmFibHksIGJlY2F1c2UgdGhlIG9mZmljaWFsXG4vLyBNYW5nbyBBUEkgaXMgdmVyeSBwYXJ0aWN1bGFyIGFib3V0IGEgbG90IG9mIHRoaXMgc3R1ZmYsIGJ1dCB3ZSBsaWtlXG4vLyB0byBiZSBsaWJlcmFsIHdpdGggd2hhdCB3ZSBhY2NlcHQgaW4gb3JkZXIgdG8gcHJldmVudCBtZW50YWxcbi8vIGJyZWFrZG93bnMgaW4gb3VyIHVzZXJzXG5mdW5jdGlvbiBtYXNzYWdlQ3JlYXRlSW5kZXhSZXF1ZXN0KHJlcXVlc3REZWYpIHtcbiAgcmVxdWVzdERlZiA9IGNsb25lKHJlcXVlc3REZWYpO1xuXG4gIGlmICghcmVxdWVzdERlZi5pbmRleCkge1xuICAgIHJlcXVlc3REZWYuaW5kZXggPSB7fTtcbiAgfVxuXG4gIFsndHlwZScsICduYW1lJywgJ2Rkb2MnXS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAocmVxdWVzdERlZi5pbmRleFtrZXldKSB7XG4gICAgICByZXF1ZXN0RGVmW2tleV0gPSByZXF1ZXN0RGVmLmluZGV4W2tleV07XG4gICAgICBkZWxldGUgcmVxdWVzdERlZi5pbmRleFtrZXldO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKHJlcXVlc3REZWYuZmllbGRzKSB7XG4gICAgcmVxdWVzdERlZi5pbmRleC5maWVsZHMgPSByZXF1ZXN0RGVmLmZpZWxkcztcbiAgICBkZWxldGUgcmVxdWVzdERlZi5maWVsZHM7XG4gIH1cblxuICBpZiAoIXJlcXVlc3REZWYudHlwZSkge1xuICAgIHJlcXVlc3REZWYudHlwZSA9ICdqc29uJztcbiAgfVxuICByZXR1cm4gcmVxdWVzdERlZjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdDsiLCIvLyB0aHJvd3MgaWYgdGhlIHVzZXIgaXMgdXNpbmcgdGhlIHdyb25nIHF1ZXJ5IGZpZWxkIHZhbHVlIHR5cGVcbmZ1bmN0aW9uIGNoZWNrRmllbGRWYWx1ZVR5cGUobmFtZSwgdmFsdWUsIGlzSHR0cCkge1xuXHR2YXIgbWVzc2FnZSA9ICcnO1xuXHR2YXIgcmVjZWl2ZWQgPSB2YWx1ZTtcblx0dmFyIGFkZFJlY2VpdmVkID0gdHJ1ZTtcblx0aWYgKFsgJyRpbicsICckbmluJywgJyRvcicsICckYW5kJywgJyRtb2QnLCAnJG5vcicsICckYWxsJyBdLmluZGV4T2YobmFtZSkgIT09IC0xKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0bWVzc2FnZSA9ICdRdWVyeSBvcGVyYXRvciAnICsgbmFtZSArICcgbXVzdCBiZSBhbiBhcnJheS4nO1xuXG5cdFx0fVxuXHR9XG5cblx0aWYgKFsgJyRub3QnLCAnJGVsZW1NYXRjaCcsICckYWxsTWF0Y2gnIF0uaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcblx0XHRpZiAoISghQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJyArIG5hbWUgKyAnIG11c3QgYmUgYW4gb2JqZWN0Lic7XG5cdFx0fVxuXHR9XG5cblx0aWYgKG5hbWUgPT09ICckbW9kJyAmJiBBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdGlmICh2YWx1ZS5sZW5ndGggIT09IDIpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJG1vZCBtdXN0IGJlIGluIHRoZSBmb3JtYXQgW2Rpdmlzb3IsIHJlbWFpbmRlcl0sICcgK1xuXHRcdFx0XHQnd2hlcmUgZGl2aXNvciBhbmQgcmVtYWluZGVyIGFyZSBib3RoIGludGVnZXJzLic7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBkaXZpc29yID0gdmFsdWVbMF07XG5cdFx0XHR2YXIgbW9kID0gdmFsdWVbMV07XG5cdFx0XHRpZiAoZGl2aXNvciA9PT0gMCkge1xuXHRcdFx0XHRtZXNzYWdlID0gJ1F1ZXJ5IG9wZXJhdG9yICRtb2RcXCdzIGRpdmlzb3IgY2Fubm90IGJlIDAsIGNhbm5vdCBkaXZpZGUgYnkgemVyby4nO1xuXHRcdFx0XHRhZGRSZWNlaXZlZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBkaXZpc29yICE9PSAnbnVtYmVyJyB8fCBwYXJzZUludChkaXZpc29yLCAxMCkgIT09IGRpdmlzb3IpIHtcblx0XHRcdFx0bWVzc2FnZSA9ICdRdWVyeSBvcGVyYXRvciAkbW9kXFwncyBkaXZpc29yIGlzIG5vdCBhbiBpbnRlZ2VyLic7XG5cdFx0XHRcdHJlY2VpdmVkID0gZGl2aXNvcjtcblx0XHRcdH1cblx0XHRcdGlmIChwYXJzZUludChtb2QsIDEwKSAhPT0gbW9kKSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJG1vZFxcJ3MgcmVtYWluZGVyIGlzIG5vdCBhbiBpbnRlZ2VyLic7XG5cdFx0XHRcdHJlY2VpdmVkID0gbW9kO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRpZiAobmFtZSA9PT0gJyRleGlzdHMnKSB7XG5cdFx0aWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRtZXNzYWdlID0gJ1F1ZXJ5IG9wZXJhdG9yICRleGlzdHMgbXVzdCBiZSBhIGJvb2xlYW4uJztcblx0XHR9XG5cdH1cblxuXHRpZiAobmFtZSA9PT0gJyR0eXBlJykge1xuXHRcdHZhciBhbGxvd2VkID0gWyAnbnVsbCcsICdib29sZWFuJywgJ251bWJlcicsICdzdHJpbmcnLCAnYXJyYXknLCAnb2JqZWN0JyBdO1xuXHRcdHZhciBhbGxvd2VkU3RyID0gJ1wiJyArIGFsbG93ZWQuc2xpY2UoMCwgYWxsb3dlZC5sZW5ndGggLSAxKS5qb2luKCdcIiwgXCInKSArICdcIiwgb3IgXCInICsgYWxsb3dlZFthbGxvd2VkLmxlbmd0aCAtIDFdICsgJ1wiJztcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0bWVzc2FnZSA9ICdRdWVyeSBvcGVyYXRvciAkdHlwZSBtdXN0IGJlIGEgc3RyaW5nLiBTdXBwb3J0ZWQgdmFsdWVzOiAnICsgYWxsb3dlZFN0ciArICcuJztcblx0XHR9IGVsc2UgaWYgKGFsbG93ZWQuaW5kZXhPZih2YWx1ZSkgPT0gLTEpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJHR5cGUgbXVzdCBiZSBhIHN0cmluZy4gU3VwcG9ydGVkIHZhbHVlczogJyArIGFsbG93ZWRTdHIgKyAnLic7XG5cdFx0fVxuXHR9XG5cblx0aWYgKG5hbWUgPT09ICckc2l6ZScpIHtcblx0XHRpZiAocGFyc2VJbnQodmFsdWUsIDEwKSAhPT0gdmFsdWUpIHtcblx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJHNpemUgbXVzdCBiZSBhIGludGVnZXIuJztcblx0XHR9XG5cdH1cblxuXHRpZiAobmFtZSA9PT0gJyRyZWdleCcpIHtcblx0XHRpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0aWYgKGlzSHR0cCkge1xuXHRcdFx0XHRtZXNzYWdlID0gJ1F1ZXJ5IG9wZXJhdG9yICRyZWdleCBtdXN0IGJlIGEgc3RyaW5nLic7XG5cdFx0XHR9IGVsc2UgaWYgKCEodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApKSB7XG5cdFx0XHRcdG1lc3NhZ2UgPSAnUXVlcnkgb3BlcmF0b3IgJHJlZ2V4IG11c3QgYmUgYSBzdHJpbmcgb3IgYW4gaW5zdGFuY2UgJyArXG5cdFx0XHRcdFx0J29mIGEgamF2YXNjcmlwdCByZWd1bGFyIGV4cHJlc3Npb24uJztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRpZiAobWVzc2FnZSkge1xuXHRcdGlmIChhZGRSZWNlaXZlZCkge1xuXG5cdFx0XHR2YXIgdHlwZSA9IHJlY2VpdmVkID09PSBudWxsXG5cdFx0XHQ/ICcgJ1xuXHRcdFx0OiBBcnJheS5pc0FycmF5KHJlY2VpdmVkKVxuXHRcdFx0PyAnIGFycmF5J1xuXHRcdFx0OiAnICcgKyB0eXBlb2YgcmVjZWl2ZWQ7XG5cdFx0XHR2YXIgcmVjZWl2ZWRTdHIgPSB0eXBlb2YgcmVjZWl2ZWQgPT09ICdvYmplY3QnICYmIHJlY2VpdmVkICE9PSBudWxsXG5cdFx0XHQ/ICBKU09OLnN0cmluZ2lmeShyZWNlaXZlZCwgbnVsbCwgJ1xcdCcpXG5cdFx0XHQ6IHJlY2VpdmVkO1xuXG5cdFx0XHRtZXNzYWdlICs9ICcgUmVjZWl2ZWQnICsgdHlwZSArICc6ICcgKyByZWNlaXZlZFN0cjtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKG1lc3NhZ2UpO1xuXHR9XG59XG5cblxudmFyIHJlcXVpcmVWYWxpZGF0aW9uID0gWyAnJGFsbCcsICckYWxsTWF0Y2gnLCAnJGFuZCcsICckZWxlbU1hdGNoJywgJyRleGlzdHMnLCAnJGluJywgJyRtb2QnLCAnJG5pbicsICckbm9yJywgJyRub3QnLCAnJG9yJywgJyRyZWdleCcsICckc2l6ZScsICckdHlwZScgXTtcblxudmFyIGFycmF5VHlwZUNvbXBhcmlzb25PcGVyYXRvcnMgPSBbICckaW4nLCAnJG5pbicsICckbW9kJywgJyRhbGwnXTtcblxudmFyIGVxdWFsaXR5T3BlcmF0b3JzID0gWyAnJGVxJywgJyRndCcsICckZ3RlJywgJyRsdCcsICckbHRlJyBdO1xuXG4vLyByZWN1cnNpdmVseSB3YWxrcyBkb3duIHRoZSBhIHF1ZXJ5IHNlbGVjdG9yIHZhbGlkYXRpbmcgYW55IG9wZXJhdG9yc1xuZnVuY3Rpb24gdmFsaWRhdGVTZWxlY3RvcihpbnB1dCwgaXNIdHRwKSB7XG5cdGlmIChBcnJheS5pc0FycmF5KGlucHV0KSkge1xuXHRcdGZvciAodmFyIGVudHJ5IG9mIGlucHV0KSB7XG5cdFx0XHRpZiAodHlwZW9mIGVudHJ5ID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbCkge1xuXHRcdFx0XHR2YWxpZGF0ZVNlbGVjdG9yKGVudHJ5LCBpc0h0dHApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR2YXIgZmllbGRzID0gT2JqZWN0LmtleXMoaW5wdXQpO1xuXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdHZhciBrZXkgPSBmaWVsZHNbaV07XG5cdFx0XHR2YXIgdmFsdWUgPSBpbnB1dFtrZXldO1xuXG5cdFx0XHRpZiAocmVxdWlyZVZhbGlkYXRpb24uaW5kZXhPZihrZXkpICE9PSAtMSkge1xuXHRcdFx0XHRjaGVja0ZpZWxkVmFsdWVUeXBlKGtleSwgdmFsdWUsIGlzSHR0cCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXF1YWxpdHlPcGVyYXRvcnMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuXHRcdFx0XHQvLyBza2lwLCBleHBsaWNpdCBjb21wYXJpc29uIG9wZXJhdG9ycyBjYW4gYmUgYW55dGhpbmdcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoYXJyYXlUeXBlQ29tcGFyaXNvbk9wZXJhdG9ycy5pbmRleE9mKGtleSkgIT09IC0xKSB7XG5cdFx0XHRcdC8vIHNraXAsIHRoZWlyIHZhbHVlcyBhcmUgYWxyZWFkeSB2YWxpZFxuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG5cdFx0XHRcdHZhbGlkYXRlU2VsZWN0b3IodmFsdWUsIGlzSHR0cCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBkZWZhdWx0IHZhbGlkYXRlU2VsZWN0b3I7XG4iLCJpbXBvcnQgeyBnZW5lcmF0ZUVycm9yRnJvbVJlc3BvbnNlIH0gZnJvbSAncG91Y2hkYi1lcnJvcnMnO1xuaW1wb3J0IHsgSGVhZGVycyB9IGZyb20gJ3BvdWNoZGItZmV0Y2gnO1xuaW1wb3J0IG1hc3NhZ2VDcmVhdGVJbmRleFJlcXVlc3QgZnJvbSAnLi4vLi4vbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdCc7XG5pbXBvcnQgdmFsaWRhdGVTZWxlY3RvciBmcm9tICcuLi8uLi92YWxpZGF0ZVNlbGVjdG9yJztcblxuZnVuY3Rpb24gZGJGZXRjaChkYiwgcGF0aCwgb3B0cywgY2FsbGJhY2spIHtcbiAgdmFyIHN0YXR1cywgb2s7XG4gIG9wdHMuaGVhZGVycyA9IG5ldyBIZWFkZXJzKHsnQ29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nfSk7XG4gIGRiLmZldGNoKHBhdGgsIG9wdHMpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgc3RhdHVzID0gcmVzcG9uc2Uuc3RhdHVzO1xuICAgIG9rID0gcmVzcG9uc2Uub2s7XG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKTtcbiAgfSkudGhlbihmdW5jdGlvbiAoanNvbikge1xuICAgIGlmICghb2spIHtcbiAgICAgIGpzb24uc3RhdHVzID0gc3RhdHVzO1xuICAgICAgdmFyIGVyciA9IGdlbmVyYXRlRXJyb3JGcm9tUmVzcG9uc2UoanNvbik7XG4gICAgICBjYWxsYmFjayhlcnIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhudWxsLCBqc29uKTtcbiAgICB9XG4gIH0pLmNhdGNoKGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5kZXgoZGIsIHJlcXVlc3REZWYsIGNhbGxiYWNrKSB7XG4gIHJlcXVlc3REZWYgPSBtYXNzYWdlQ3JlYXRlSW5kZXhSZXF1ZXN0KHJlcXVlc3REZWYpO1xuICBkYkZldGNoKGRiLCAnX2luZGV4Jywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3REZWYpXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZmluZChkYiwgcmVxdWVzdERlZiwgY2FsbGJhY2spIHtcbiAgdmFsaWRhdGVTZWxlY3RvcihyZXF1ZXN0RGVmLnNlbGVjdG9yLCB0cnVlKTtcbiAgZGJGZXRjaChkYiwgJ19maW5kJywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3REZWYpXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZXhwbGFpbihkYiwgcmVxdWVzdERlZiwgY2FsbGJhY2spIHtcbiAgZGJGZXRjaChkYiwgJ19leHBsYWluJywge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3REZWYpXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5kZXhlcyhkYiwgY2FsbGJhY2spIHtcbiAgZGJGZXRjaChkYiwgJ19pbmRleCcsIHtcbiAgICBtZXRob2Q6ICdHRVQnXG4gIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gZGVsZXRlSW5kZXgoZGIsIGluZGV4RGVmLCBjYWxsYmFjaykge1xuXG5cbiAgdmFyIGRkb2MgPSBpbmRleERlZi5kZG9jO1xuICB2YXIgdHlwZSA9IGluZGV4RGVmLnR5cGUgfHwgJ2pzb24nO1xuICB2YXIgbmFtZSA9IGluZGV4RGVmLm5hbWU7XG5cbiAgaWYgKCFkZG9jKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcigneW91IG11c3QgcHJvdmlkZSBhbiBpbmRleFxcJ3MgZGRvYycpKTtcbiAgfVxuXG4gIGlmICghbmFtZSkge1xuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ3lvdSBtdXN0IHByb3ZpZGUgYW4gaW5kZXhcXCdzIG5hbWUnKSk7XG4gIH1cblxuICB2YXIgdXJsID0gJ19pbmRleC8nICsgW2Rkb2MsIHR5cGUsIG5hbWVdLm1hcChlbmNvZGVVUklDb21wb25lbnQpLmpvaW4oJy8nKTtcblxuICBkYkZldGNoKGRiLCB1cmwsIHttZXRob2Q6ICdERUxFVEUnfSwgY2FsbGJhY2spO1xufVxuXG5leHBvcnQge1xuICBjcmVhdGVJbmRleCxcbiAgZmluZCxcbiAgZ2V0SW5kZXhlcyxcbiAgZGVsZXRlSW5kZXgsXG4gIGV4cGxhaW5cbn07XG4iLCJpbXBvcnQge1xuICBnZXRGaWVsZEZyb21Eb2MsXG4gIHNldEZpZWxkSW5Eb2MsXG4gIHBhcnNlRmllbGRcbn0gZnJvbSAncG91Y2hkYi1zZWxlY3Rvci1jb3JlJztcblxuaW1wb3J0IHsgbmV4dFRpY2sgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuZnVuY3Rpb24gb25jZShmdW4pIHtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICBpZiAoY2FsbGVkKSB7XG4gICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ29uY2UgY2FsbGVkICBtb3JlIHRoYW4gb25jZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsZWQgPSB0cnVlO1xuICAgICAgZnVuLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIHRvUHJvbWlzZShmdW5jKSB7XG4gIC8vY3JlYXRlIHRoZSBmdW5jdGlvbiB3ZSB3aWxsIGJlIHJldHVybmluZ1xuICByZXR1cm4gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHRlbXBDQiA9ICh0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSA/IGFyZ3MucG9wKCkgOiBmYWxzZTtcbiAgICAvLyBpZiB0aGUgbGFzdCBhcmd1bWVudCBpcyBhIGZ1bmN0aW9uLCBhc3N1bWUgaXRzIGEgY2FsbGJhY2tcbiAgICB2YXIgdXNlZENCO1xuICAgIGlmICh0ZW1wQ0IpIHtcbiAgICAgIC8vIGlmIGl0IHdhcyBhIGNhbGxiYWNrLCBjcmVhdGUgYSBuZXcgY2FsbGJhY2sgd2hpY2ggY2FsbHMgaXQsXG4gICAgICAvLyBidXQgZG8gc28gYXN5bmMgc28gd2UgZG9uJ3QgdHJhcCBhbnkgZXJyb3JzXG4gICAgICB1c2VkQ0IgPSBmdW5jdGlvbiAoZXJyLCByZXNwKSB7XG4gICAgICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB0ZW1wQ0IoZXJyLCByZXNwKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgIH1cbiAgICB2YXIgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uIChmdWxmaWxsLCByZWplY3QpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IG9uY2UoZnVuY3Rpb24gKGVyciwgbWVzZykge1xuICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmdWxmaWxsKG1lc2cpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNyZWF0ZSBhIGNhbGxiYWNrIGZvciB0aGlzIGludm9jYXRpb25cbiAgICAgICAgLy8gYXBwbHkgdGhlIGZ1bmN0aW9uIGluIHRoZSBvcmlnIGNvbnRleHRcbiAgICAgICAgYXJncy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgZnVuYy5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmVqZWN0KGUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIGlmIHRoZXJlIGlzIGEgY2FsbGJhY2ssIGNhbGwgaXQgYmFja1xuICAgIGlmICh1c2VkQ0IpIHtcbiAgICAgIHByb21pc2UudGhlbihmdW5jdGlvbiAocmVzdWx0KSB7XG4gICAgICAgIHVzZWRDQihudWxsLCByZXN1bHQpO1xuICAgICAgfSwgdXNlZENCKTtcbiAgICB9XG4gICAgcHJvbWlzZS5jYW5jZWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIHJldHVybiBwcm9taXNlO1xuICB9O1xufVxuXG5mdW5jdGlvbiBjYWxsYmFja2lmeShmdW4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgdmFyIGNiID0gYXJncy5wb3AoKTtcbiAgICB2YXIgcHJvbWlzZSA9IGZ1bi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICBwcm9taXNlZENhbGxiYWNrKHByb21pc2UsIGNiKTtcbiAgICByZXR1cm4gcHJvbWlzZTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcHJvbWlzZWRDYWxsYmFjayhwcm9taXNlLCBjYWxsYmFjaykge1xuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGNhbGxiYWNrKG51bGwsIHJlcyk7XG4gICAgfSk7XG4gIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICBjYWxsYmFjayhyZWFzb24pO1xuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbnZhciBmbGF0dGVuID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgdmFyIHJlcyA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJncy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBzdWJBcnIgPSBhcmdzW2ldO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHN1YkFycikpIHtcbiAgICAgIHJlcyA9IHJlcy5jb25jYXQoZmxhdHRlbi5hcHBseShudWxsLCBzdWJBcnIpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzLnB1c2goc3ViQXJyKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlcztcbn07XG5cbmZ1bmN0aW9uIG1lcmdlT2JqZWN0cyhhcnIpIHtcbiAgdmFyIHJlcyA9IHt9O1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcmVzID0gT2JqZWN0LmFzc2lnbihyZXMsIGFycltpXSk7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuLy8gU2VsZWN0cyBhIGxpc3Qgb2YgZmllbGRzIGRlZmluZWQgaW4gZG90IG5vdGF0aW9uIGZyb20gb25lIGRvY1xuLy8gYW5kIGNvcGllcyB0aGVtIHRvIGEgbmV3IGRvYy4gTGlrZSB1bmRlcnNjb3JlIF8ucGljayBidXQgc3VwcG9ydHMgbmVzdGluZy5cbmZ1bmN0aW9uIHBpY2sob2JqLCBhcnIpIHtcbiAgdmFyIHJlcyA9IHt9O1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIHBhcnNlZEZpZWxkID0gcGFyc2VGaWVsZChhcnJbaV0pO1xuICAgIHZhciB2YWx1ZSA9IGdldEZpZWxkRnJvbURvYyhvYmosIHBhcnNlZEZpZWxkKTtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgc2V0RmllbGRJbkRvYyhyZXMsIHBhcnNlZEZpZWxkLCB2YWx1ZSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8vIGUuZy4gWydhJ10sIFsnYScsICdiJ10gaXMgdHJ1ZSwgYnV0IFsnYiddLCBbJ2EnLCAnYiddIGlzIGZhbHNlXG5mdW5jdGlvbiBvbmVBcnJheUlzU3ViQXJyYXlPZk90aGVyKGxlZnQsIHJpZ2h0KSB7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IE1hdGgubWluKGxlZnQubGVuZ3RoLCByaWdodC5sZW5ndGgpOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAobGVmdFtpXSAhPT0gcmlnaHRbaV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIGUuZy5bJ2EnLCAnYicsICdjJ10sIFsnYScsICdiJ10gaXMgZmFsc2VcbmZ1bmN0aW9uIG9uZUFycmF5SXNTdHJpY3RTdWJBcnJheU9mT3RoZXIobGVmdCwgcmlnaHQpIHtcblxuICBpZiAobGVmdC5sZW5ndGggPiByaWdodC5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gb25lQXJyYXlJc1N1YkFycmF5T2ZPdGhlcihsZWZ0LCByaWdodCk7XG59XG5cbi8vIHNhbWUgYXMgYWJvdmUsIGJ1dCB0cmVhdCB0aGUgbGVmdCBhcnJheSBhcyBhbiB1bm9yZGVyZWQgc2V0XG4vLyBlLmcuIFsnYicsICdhJ10sIFsnYScsICdiJywgJ2MnXSBpcyB0cnVlLCBidXQgWydjJ10sIFsnYScsICdiJywgJ2MnXSBpcyBmYWxzZVxuZnVuY3Rpb24gb25lU2V0SXNTdWJBcnJheU9mT3RoZXIobGVmdCwgcmlnaHQpIHtcbiAgbGVmdCA9IGxlZnQuc2xpY2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHJpZ2h0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGZpZWxkID0gcmlnaHRbaV07XG4gICAgaWYgKCFsZWZ0Lmxlbmd0aCkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHZhciBsZWZ0SWR4ID0gbGVmdC5pbmRleE9mKGZpZWxkKTtcbiAgICBpZiAobGVmdElkeCA9PT0gLTEpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGVmdC5zcGxpY2UobGVmdElkeCwgMSk7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBhcnJheVRvT2JqZWN0KGFycikge1xuICB2YXIgcmVzID0ge307XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICByZXNbYXJyW2ldXSA9IHRydWU7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gbWF4KGFyciwgZnVuKSB7XG4gIHZhciBtYXggPSBudWxsO1xuICB2YXIgbWF4U2NvcmUgPSAtMTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGFyci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBlbGVtZW50ID0gYXJyW2ldO1xuICAgIHZhciBzY29yZSA9IGZ1bihlbGVtZW50KTtcbiAgICBpZiAoc2NvcmUgPiBtYXhTY29yZSkge1xuICAgICAgbWF4U2NvcmUgPSBzY29yZTtcbiAgICAgIG1heCA9IGVsZW1lbnQ7XG4gICAgfVxuICB9XG4gIHJldHVybiBtYXg7XG59XG5cbmZ1bmN0aW9uIGFycmF5RXF1YWxzKGFycjEsIGFycjIpIHtcbiAgaWYgKGFycjEubGVuZ3RoICE9PSBhcnIyLmxlbmd0aCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyMS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGlmIChhcnIxW2ldICE9PSBhcnIyW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiB1bmlxKGFycikge1xuICB2YXIgb2JqID0ge307XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgb2JqWyckJyArIGFycltpXV0gPSB0cnVlO1xuICB9XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgcmV0dXJuIGtleS5zdWJzdHJpbmcoMSk7XG4gIH0pO1xufVxuXG5leHBvcnQge1xuICBhcnJheUVxdWFscyxcbiAgYXJyYXlUb09iamVjdCxcbiAgY2FsbGJhY2tpZnksXG4gIGZsYXR0ZW4sXG4gIG1heCxcbiAgbWVyZ2VPYmplY3RzLFxuICBvbmNlLFxuICBvbmVBcnJheUlzU3RyaWN0U3ViQXJyYXlPZk90aGVyLFxuICBvbmVBcnJheUlzU3ViQXJyYXlPZk90aGVyLFxuICBvbmVTZXRJc1N1YkFycmF5T2ZPdGhlcixcbiAgcGljayxcbiAgcHJvbWlzZWRDYWxsYmFjayxcbiAgdG9Qcm9taXNlLFxuICB1bmlxXG59O1xuIiwiaW1wb3J0IGFic3RyYWN0TWFwUmVkdWNlIGZyb20gJ3BvdWNoZGItYWJzdHJhY3QtbWFwcmVkdWNlJztcbmltcG9ydCB7IG1hdGNoZXNTZWxlY3RvciwgcGFyc2VGaWVsZCB9IGZyb20gJ3BvdWNoZGItc2VsZWN0b3ItY29yZSc7XG5cbi8vXG4vLyBPbmUgdGhpbmcgYWJvdXQgdGhlc2UgbWFwcGVyczpcbi8vXG4vLyBQZXIgdGhlIGFkdmljZSBvZiBKb2huLURhdmlkIERhbHRvbiAoaHR0cDovL3lvdXR1LmJlL050aG1lTEVoRERNKSxcbi8vIHdoYXQgeW91IHdhbnQgdG8gZG8gaW4gdGhpcyBjYXNlIGlzIG9wdGltaXplIGZvciB0aGUgc21hbGxlc3QgcG9zc2libGVcbi8vIGZ1bmN0aW9uLCBzaW5jZSB0aGF0J3MgdGhlIHRoaW5nIHRoYXQgZ2V0cyBydW4gb3ZlciBhbmQgb3ZlciBhZ2Fpbi5cbi8vXG4vLyBUaGlzIGNvZGUgd291bGQgYmUgYSBsb3Qgc2ltcGxlciBpZiBhbGwgdGhlIGlmL2Vsc2VzIHdlcmUgaW5zaWRlXG4vLyB0aGUgZnVuY3Rpb24sIGJ1dCBpdCB3b3VsZCBhbHNvIGJlIGEgbG90IGxlc3MgcGVyZm9ybWFudC5cbi8vXG5cblxuZnVuY3Rpb24gY3JlYXRlRGVlcE11bHRpTWFwcGVyKGZpZWxkcywgZW1pdCwgc2VsZWN0b3IpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkb2MpIHtcbiAgICBpZiAoc2VsZWN0b3IgJiYgIW1hdGNoZXNTZWxlY3Rvcihkb2MsIHNlbGVjdG9yKSkgeyByZXR1cm47IH1cbiAgICB2YXIgdG9FbWl0ID0gW107XG4gICAgZm9yICh2YXIgaSA9IDAsIGlMZW4gPSBmaWVsZHMubGVuZ3RoOyBpIDwgaUxlbjsgaSsrKSB7XG4gICAgICB2YXIgcGFyc2VkRmllbGQgPSBwYXJzZUZpZWxkKGZpZWxkc1tpXSk7XG4gICAgICB2YXIgdmFsdWUgPSBkb2M7XG4gICAgICBmb3IgKHZhciBqID0gMCwgakxlbiA9IHBhcnNlZEZpZWxkLmxlbmd0aDsgaiA8IGpMZW47IGorKykge1xuICAgICAgICB2YXIga2V5ID0gcGFyc2VkRmllbGRbal07XG4gICAgICAgIHZhbHVlID0gdmFsdWVba2V5XTtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICByZXR1cm47IC8vIGRvbid0IGVtaXRcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdG9FbWl0LnB1c2godmFsdWUpO1xuICAgIH1cbiAgICBlbWl0KHRvRW1pdCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZURlZXBTaW5nbGVNYXBwZXIoZmllbGQsIGVtaXQsIHNlbGVjdG9yKSB7XG4gIHZhciBwYXJzZWRGaWVsZCA9IHBhcnNlRmllbGQoZmllbGQpO1xuICByZXR1cm4gZnVuY3Rpb24gKGRvYykge1xuICAgIGlmIChzZWxlY3RvciAmJiAhbWF0Y2hlc1NlbGVjdG9yKGRvYywgc2VsZWN0b3IpKSB7IHJldHVybjsgfVxuICAgIHZhciB2YWx1ZSA9IGRvYztcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gcGFyc2VkRmllbGQubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBrZXkgPSBwYXJzZWRGaWVsZFtpXTtcbiAgICAgIHZhbHVlID0gdmFsdWVba2V5XTtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjsgLy8gZG8gbm90aGluZ1xuICAgICAgfVxuICAgIH1cbiAgICBlbWl0KHZhbHVlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2hhbGxvd1NpbmdsZU1hcHBlcihmaWVsZCwgZW1pdCwgc2VsZWN0b3IpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChkb2MpIHtcbiAgICBpZiAoc2VsZWN0b3IgJiYgIW1hdGNoZXNTZWxlY3Rvcihkb2MsIHNlbGVjdG9yKSkgeyByZXR1cm47IH1cbiAgICBlbWl0KGRvY1tmaWVsZF0pO1xuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTaGFsbG93TXVsdGlNYXBwZXIoZmllbGRzLCBlbWl0LCBzZWxlY3Rvcikge1xuICByZXR1cm4gZnVuY3Rpb24gKGRvYykge1xuICAgIGlmIChzZWxlY3RvciAmJiAhbWF0Y2hlc1NlbGVjdG9yKGRvYywgc2VsZWN0b3IpKSB7IHJldHVybjsgfVxuICAgIHZhciB0b0VtaXQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0b0VtaXQucHVzaChkb2NbZmllbGRzW2ldXSk7XG4gICAgfVxuICAgIGVtaXQodG9FbWl0KTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gY2hlY2tTaGFsbG93KGZpZWxkcykge1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gZmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgIGlmIChmaWVsZC5pbmRleE9mKCcuJykgIT09IC0xKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNYXBwZXIoZmllbGRzLCBlbWl0LCBzZWxlY3Rvcikge1xuICB2YXIgaXNTaGFsbG93ID0gY2hlY2tTaGFsbG93KGZpZWxkcyk7XG4gIHZhciBpc1NpbmdsZSA9IGZpZWxkcy5sZW5ndGggPT09IDE7XG5cbiAgLy8gbm90aWNlIHdlIHRyeSB0byBvcHRpbWl6ZSBmb3IgdGhlIG1vc3QgY29tbW9uIGNhc2UsXG4gIC8vIGkuZS4gc2luZ2xlIHNoYWxsb3cgaW5kZXhlc1xuICBpZiAoaXNTaGFsbG93KSB7XG4gICAgaWYgKGlzU2luZ2xlKSB7XG4gICAgICByZXR1cm4gY3JlYXRlU2hhbGxvd1NpbmdsZU1hcHBlcihmaWVsZHNbMF0sIGVtaXQsIHNlbGVjdG9yKTtcbiAgICB9IGVsc2UgeyAvLyBtdWx0aVxuICAgICAgcmV0dXJuIGNyZWF0ZVNoYWxsb3dNdWx0aU1hcHBlcihmaWVsZHMsIGVtaXQsIHNlbGVjdG9yKTtcbiAgICB9XG4gIH0gZWxzZSB7IC8vIGRlZXBcbiAgICBpZiAoaXNTaW5nbGUpIHtcbiAgICAgIHJldHVybiBjcmVhdGVEZWVwU2luZ2xlTWFwcGVyKGZpZWxkc1swXSwgZW1pdCwgc2VsZWN0b3IpO1xuICAgIH0gZWxzZSB7IC8vIG11bHRpXG4gICAgICByZXR1cm4gY3JlYXRlRGVlcE11bHRpTWFwcGVyKGZpZWxkcywgZW1pdCwgc2VsZWN0b3IpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBtYXBwZXIobWFwRnVuRGVmLCBlbWl0KSB7XG4gIC8vIG1hcEZ1bkRlZiBpcyBhIGxpc3Qgb2YgZmllbGRzXG5cbiAgY29uc3QgZmllbGRzID0gT2JqZWN0LmtleXMobWFwRnVuRGVmLmZpZWxkcyk7XG4gIGNvbnN0IHBhcnRpYWxTZWxlY3RvciA9IG1hcEZ1bkRlZi5wYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvcjtcblxuICByZXR1cm4gY3JlYXRlTWFwcGVyKGZpZWxkcywgZW1pdCwgcGFydGlhbFNlbGVjdG9yKTtcbn1cblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmZ1bmN0aW9uIHJlZHVjZXIoLypyZWR1Y2VGdW5EZWYqLykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ3JlZHVjZSBub3Qgc3VwcG9ydGVkJyk7XG59XG5cbmZ1bmN0aW9uIGRkb2NWYWxpZGF0b3IoZGRvYywgdmlld05hbWUpIHtcbiAgdmFyIHZpZXcgPSBkZG9jLnZpZXdzW3ZpZXdOYW1lXTtcbiAgLy8gVGhpcyBkb2Vzbid0IGFjdHVhbGx5IG5lZWQgdG8gYmUgaGVyZSBhcHBhcmVudGx5LCBidXRcbiAgLy8gSSBmZWVsIHNhZmVyIGtlZXBpbmcgaXQuXG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoIXZpZXcubWFwIHx8ICF2aWV3Lm1hcC5maWVsZHMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2Rkb2MgJyArIGRkb2MuX2lkICsnIHdpdGggdmlldyAnICsgdmlld05hbWUgK1xuICAgICAgJyBkb2VzblxcJ3QgaGF2ZSBtYXAuZmllbGRzIGRlZmluZWQuICcgK1xuICAgICAgJ21heWJlIGl0IHdhc25cXCd0IGNyZWF0ZWQgYnkgdGhpcyBwbHVnaW4/Jyk7XG4gIH1cbn1cblxudmFyIGFic3RyYWN0TWFwcGVyID0gYWJzdHJhY3RNYXBSZWR1Y2UoXG4gIC8qIGxvY2FsRG9jTmFtZSAqLyAnaW5kZXhlcycsXG4gIG1hcHBlcixcbiAgcmVkdWNlcixcbiAgZGRvY1ZhbGlkYXRvclxuKTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGRiKSB7XG4gIGlmIChkYi5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIENhbGxzIHRoZSBfY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyLCBidXQgd2l0aCBhIHRoaXJkIGFyZ3VtZW50OlxuICAgICAgLy8gdGhlIHN0YW5kYXJkIGZpbmRBYnN0cmFjdE1hcHBlciBxdWVyeS92aWV3Q2xlYW51cC5cbiAgICAgIC8vIFRoaXMgYWxsb3dzIHRoZSBpbmRleGVkZGIgYWRhcHRlciB0byBzdXBwb3J0IHBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yLlxuICAgICAgcXVlcnk6IGZ1bmN0aW9uIGFkZFF1ZXJ5RmFsbGJhY2soc2lnbmF0dXJlLCBvcHRzKSB7XG4gICAgICAgIHZhciBmYWxsYmFjayA9IGFic3RyYWN0TWFwcGVyLnF1ZXJ5LmJpbmQodGhpcyk7XG4gICAgICAgIHJldHVybiBkYi5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyLnF1ZXJ5LmNhbGwodGhpcywgc2lnbmF0dXJlLCBvcHRzLCBmYWxsYmFjayk7XG4gICAgICB9LFxuICAgICAgdmlld0NsZWFudXA6IGZ1bmN0aW9uIGFkZFZpZXdDbGVhbnVwRmFsbGJhY2soKSB7XG4gICAgICAgIHZhciBmYWxsYmFjayA9IGFic3RyYWN0TWFwcGVyLnZpZXdDbGVhbnVwLmJpbmQodGhpcyk7XG4gICAgICAgIHJldHVybiBkYi5fY3VzdG9tRmluZEFic3RyYWN0TWFwcGVyLnZpZXdDbGVhbnVwLmNhbGwodGhpcywgZmFsbGJhY2spO1xuICAgICAgfVxuICAgIH07XG4gIH1cbiAgcmV0dXJuIGFic3RyYWN0TWFwcGVyO1xufVxuIiwiaW1wb3J0IHsgY29sbGF0ZSB9IGZyb20gJ3BvdWNoZGItY29sbGF0ZSc7XG5pbXBvcnQgeyBjbG9uZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHsgZ2V0S2V5LCBnZXRWYWx1ZSwgbWFzc2FnZVNlbGVjdG9yLCBwYXJzZUZpZWxkLCBnZXRGaWVsZEZyb21Eb2MgfSBmcm9tICdwb3VjaGRiLXNlbGVjdG9yLWNvcmUnO1xuXG4vLyBub3JtYWxpemUgdGhlIFwic29ydFwiIHZhbHVlXG5mdW5jdGlvbiBtYXNzYWdlU29ydChzb3J0KSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShzb3J0KSkge1xuICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzb3J0IGpzb24gLSBzaG91bGQgYmUgYW4gYXJyYXknKTtcbiAgfVxuICByZXR1cm4gc29ydC5tYXAoZnVuY3Rpb24gKHNvcnRpbmcpIHtcbiAgICBpZiAodHlwZW9mIHNvcnRpbmcgPT09ICdzdHJpbmcnKSB7XG4gICAgICB2YXIgb2JqID0ge307XG4gICAgICBvYmpbc29ydGluZ10gPSAnYXNjJztcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzb3J0aW5nO1xuICAgIH1cbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1hc3NhZ2VVc2VJbmRleCh1c2VJbmRleCkge1xuICB2YXIgY2xlYW5lZFVzZUluZGV4ID0gW107XG4gIGlmICh0eXBlb2YgdXNlSW5kZXggPT09ICdzdHJpbmcnKSB7XG4gICAgY2xlYW5lZFVzZUluZGV4LnB1c2godXNlSW5kZXgpO1xuICB9IGVsc2Uge1xuICAgIGNsZWFuZWRVc2VJbmRleCA9IHVzZUluZGV4O1xuICB9XG5cbiAgcmV0dXJuIGNsZWFuZWRVc2VJbmRleC5tYXAoZnVuY3Rpb24gKG5hbWUpIHtcbiAgICByZXR1cm4gbmFtZS5yZXBsYWNlKCdfZGVzaWduLycsICcnKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIG1hc3NhZ2VJbmRleERlZihpbmRleERlZikge1xuICBpbmRleERlZi5maWVsZHMgPSBpbmRleERlZi5maWVsZHMubWFwKGZ1bmN0aW9uIChmaWVsZCkge1xuICAgIGlmICh0eXBlb2YgZmllbGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB2YXIgb2JqID0ge307XG4gICAgICBvYmpbZmllbGRdID0gJ2FzYyc7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICByZXR1cm4gZmllbGQ7XG4gIH0pO1xuICBpZiAoaW5kZXhEZWYucGFydGlhbF9maWx0ZXJfc2VsZWN0b3IpIHtcbiAgICBpbmRleERlZi5wYXJ0aWFsX2ZpbHRlcl9zZWxlY3RvciA9IG1hc3NhZ2VTZWxlY3RvcihcbiAgICAgIGluZGV4RGVmLnBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yXG4gICAgKTtcbiAgfVxuICByZXR1cm4gaW5kZXhEZWY7XG59XG5cbmZ1bmN0aW9uIGdldEtleUZyb21Eb2MoZG9jLCBpbmRleCkge1xuICB2YXIgcmVzID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgaW5kZXguZGVmLmZpZWxkcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBmaWVsZCA9IGdldEtleShpbmRleC5kZWYuZmllbGRzW2ldKTtcbiAgICByZXMucHVzaChnZXRGaWVsZEZyb21Eb2MoZG9jLCBwYXJzZUZpZWxkKGZpZWxkKSkpO1xuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8vIGhhdmUgdG8gZG8gdGhpcyBtYW51YWxseSBiZWNhdXNlIFJFQVNPTlMuIEkgZG9uJ3Qga25vdyB3aHlcbi8vIENvdWNoREIgZGlkbid0IGltcGxlbWVudCBpbmNsdXNpdmVfc3RhcnRcbmZ1bmN0aW9uIGZpbHRlckluY2x1c2l2ZVN0YXJ0KHJvd3MsIHRhcmdldFZhbHVlLCBpbmRleCkge1xuICB2YXIgaW5kZXhGaWVsZHMgPSBpbmRleC5kZWYuZmllbGRzO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcm93cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciByb3cgPSByb3dzW2ldO1xuXG4gICAgLy8gc2hhdmUgb2ZmIGFueSBkb2NzIGF0IHRoZSBiZWdpbm5pbmcgdGhhdCBhcmUgPD0gdGhlXG4gICAgLy8gdGFyZ2V0IHZhbHVlXG5cbiAgICB2YXIgZG9jS2V5ID0gZ2V0S2V5RnJvbURvYyhyb3cuZG9jLCBpbmRleCk7XG4gICAgaWYgKGluZGV4RmllbGRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgZG9jS2V5ID0gZG9jS2V5WzBdOyAvLyBvbmx5IG9uZSBmaWVsZCwgbm90IG11bHRpLWZpZWxkXG4gICAgfSBlbHNlIHsgLy8gbW9yZSB0aGFuIG9uZSBmaWVsZCBpbiBpbmRleFxuICAgICAgLy8gaW4gdGhlIGNhc2Ugd2hlcmUgZS5nLiB0aGUgdXNlciBpcyBzZWFyY2hpbmcgeyRndDoge2E6IDF9fVxuICAgICAgLy8gYnV0IHRoZSBpbmRleCBpcyBbYSwgYl0sIHRoZW4gd2UgbmVlZCB0byBzaG9ydGVuIHRoZSBkb2Mga2V5XG4gICAgICB3aGlsZSAoZG9jS2V5Lmxlbmd0aCA+IHRhcmdldFZhbHVlLmxlbmd0aCkge1xuICAgICAgICBkb2NLZXkucG9wKCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vQUJTIGFzIHdlIGp1c3QgbG9va2luZyBmb3IgdmFsdWVzIHRoYXQgZG9uJ3QgbWF0Y2hcbiAgICBpZiAoTWF0aC5hYnMoY29sbGF0ZShkb2NLZXksIHRhcmdldFZhbHVlKSkgPiAwKSB7XG4gICAgICAvLyBubyBuZWVkIHRvIGZpbHRlciBhbnkgZnVydGhlcjsgd2UncmUgcGFzdCB0aGUga2V5XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGkgPiAwID8gcm93cy5zbGljZShpKSA6IHJvd3M7XG59XG5cbmZ1bmN0aW9uIHJldmVyc2VPcHRpb25zKG9wdHMpIHtcbiAgdmFyIG5ld09wdHMgPSBjbG9uZShvcHRzKTtcbiAgZGVsZXRlIG5ld09wdHMuc3RhcnRrZXk7XG4gIGRlbGV0ZSBuZXdPcHRzLmVuZGtleTtcbiAgZGVsZXRlIG5ld09wdHMuaW5jbHVzaXZlX3N0YXJ0O1xuICBkZWxldGUgbmV3T3B0cy5pbmNsdXNpdmVfZW5kO1xuXG4gIGlmICgnZW5ka2V5JyBpbiBvcHRzKSB7XG4gICAgbmV3T3B0cy5zdGFydGtleSA9IG9wdHMuZW5ka2V5O1xuICB9XG4gIGlmICgnc3RhcnRrZXknIGluIG9wdHMpIHtcbiAgICBuZXdPcHRzLmVuZGtleSA9IG9wdHMuc3RhcnRrZXk7XG4gIH1cbiAgaWYgKCdpbmNsdXNpdmVfc3RhcnQnIGluIG9wdHMpIHtcbiAgICBuZXdPcHRzLmluY2x1c2l2ZV9lbmQgPSBvcHRzLmluY2x1c2l2ZV9zdGFydDtcbiAgfVxuICBpZiAoJ2luY2x1c2l2ZV9lbmQnIGluIG9wdHMpIHtcbiAgICBuZXdPcHRzLmluY2x1c2l2ZV9zdGFydCA9IG9wdHMuaW5jbHVzaXZlX2VuZDtcbiAgfVxuICByZXR1cm4gbmV3T3B0cztcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVJbmRleChpbmRleCkge1xuICB2YXIgYXNjRmllbGRzID0gaW5kZXguZmllbGRzLmZpbHRlcihmdW5jdGlvbiAoZmllbGQpIHtcbiAgICByZXR1cm4gZ2V0VmFsdWUoZmllbGQpID09PSAnYXNjJztcbiAgfSk7XG4gIGlmIChhc2NGaWVsZHMubGVuZ3RoICE9PSAwICYmIGFzY0ZpZWxkcy5sZW5ndGggIT09IGluZGV4LmZpZWxkcy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIG1peGVkIHNvcnRpbmcnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZVNvcnQocmVxdWVzdERlZiwgaW5kZXgpIHtcbiAgaWYgKGluZGV4LmRlZmF1bHRVc2VkICYmIHJlcXVlc3REZWYuc29ydCkge1xuICAgIHZhciBub25lSWRTb3J0cyA9IHJlcXVlc3REZWYuc29ydC5maWx0ZXIoZnVuY3Rpb24gKHNvcnRJdGVtKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoc29ydEl0ZW0pWzBdICE9PSAnX2lkJztcbiAgICB9KS5tYXAoZnVuY3Rpb24gKHNvcnRJdGVtKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoc29ydEl0ZW0pWzBdO1xuICAgIH0pO1xuXG4gICAgaWYgKG5vbmVJZFNvcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNvcnQgb24gZmllbGQocykgXCInICsgbm9uZUlkU29ydHMuam9pbignLCcpICtcbiAgICAgICdcIiB3aGVuIHVzaW5nIHRoZSBkZWZhdWx0IGluZGV4Jyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKGluZGV4LmRlZmF1bHRVc2VkKSB7XG4gICAgcmV0dXJuO1xuICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRmluZFJlcXVlc3QocmVxdWVzdERlZikge1xuICBpZiAodHlwZW9mIHJlcXVlc3REZWYuc2VsZWN0b3IgIT09ICdvYmplY3QnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd5b3UgbXVzdCBwcm92aWRlIGEgc2VsZWN0b3Igd2hlbiB5b3UgZmluZCgpJyk7XG4gIH1cblxuICAvKnZhciBzZWxlY3RvcnMgPSByZXF1ZXN0RGVmLnNlbGVjdG9yWyckYW5kJ10gfHwgW3JlcXVlc3REZWYuc2VsZWN0b3JdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbGVjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzZWxlY3RvciA9IHNlbGVjdG9yc1tpXTtcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHNlbGVjdG9yKTtcbiAgICBpZiAoa2V5cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBlbXB0eSBzZWxlY3RvcicpO1xuICAgIH1cbiAgICAvL3ZhciBzZWxlY3Rpb24gPSBzZWxlY3RvcltrZXlzWzBdXTtcbiAgICAvKmlmIChPYmplY3Qua2V5cyhzZWxlY3Rpb24pLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHNlbGVjdG9yOiAnICsgSlNPTi5zdHJpbmdpZnkoc2VsZWN0aW9uKSArXG4gICAgICAgICcgLSBpdCBtdXN0IGhhdmUgZXhhY3RseSBvbmUga2V5L3ZhbHVlJyk7XG4gICAgfVxuICB9Ki9cbn1cblxuLy8gZGV0ZXJtaW5lIHRoZSBtYXhpbXVtIG51bWJlciBvZiBmaWVsZHNcbi8vIHdlJ3JlIGdvaW5nIHRvIG5lZWQgdG8gcXVlcnksIGUuZy4gaWYgdGhlIHVzZXJcbi8vIGhhcyBzZWxlY3Rpb24gWydhJ10gYW5kIHNvcnRpbmcgWydhJywgJ2InXSwgdGhlbiB3ZVxuLy8gbmVlZCB0byB1c2UgdGhlIGxvbmdlciBvZiB0aGUgdHdvOiBbJ2EnLCAnYiddXG5mdW5jdGlvbiBnZXRVc2VyRmllbGRzKHNlbGVjdG9yLCBzb3J0KSB7XG4gIHZhciBzZWxlY3RvckZpZWxkcyA9IE9iamVjdC5rZXlzKHNlbGVjdG9yKTtcbiAgdmFyIHNvcnRGaWVsZHMgPSBzb3J0PyBzb3J0Lm1hcChnZXRLZXkpIDogW107XG4gIHZhciB1c2VyRmllbGRzO1xuICBpZiAoc2VsZWN0b3JGaWVsZHMubGVuZ3RoID49IHNvcnRGaWVsZHMubGVuZ3RoKSB7XG4gICAgdXNlckZpZWxkcyA9IHNlbGVjdG9yRmllbGRzO1xuICB9IGVsc2Uge1xuICAgIHVzZXJGaWVsZHMgPSBzb3J0RmllbGRzO1xuICB9XG5cbiAgaWYgKHNvcnRGaWVsZHMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGZpZWxkczogdXNlckZpZWxkc1xuICAgIH07XG4gIH1cblxuICAvLyBzb3J0IGFjY29yZGluZyB0byB0aGUgdXNlcidzIHByZWZlcnJlZCBzb3J0aW5nXG4gIHVzZXJGaWVsZHMgPSB1c2VyRmllbGRzLnNvcnQoZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgdmFyIGxlZnRJZHggPSBzb3J0RmllbGRzLmluZGV4T2YobGVmdCk7XG4gICAgaWYgKGxlZnRJZHggPT09IC0xKSB7XG4gICAgICBsZWZ0SWR4ID0gTnVtYmVyLk1BWF9WQUxVRTtcbiAgICB9XG4gICAgdmFyIHJpZ2h0SWR4ID0gc29ydEZpZWxkcy5pbmRleE9mKHJpZ2h0KTtcbiAgICBpZiAocmlnaHRJZHggPT09IC0xKSB7XG4gICAgICByaWdodElkeCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgfVxuICAgIHJldHVybiBsZWZ0SWR4IDwgcmlnaHRJZHggPyAtMSA6IGxlZnRJZHggPiByaWdodElkeCA/IDEgOiAwO1xuICB9KTtcblxuICByZXR1cm4ge1xuICAgIGZpZWxkczogdXNlckZpZWxkcyxcbiAgICBzb3J0T3JkZXI6IHNvcnQubWFwKGdldEtleSlcbiAgfTtcbn1cblxuZXhwb3J0IHtcbiAgbWFzc2FnZVNvcnQsXG4gIHZhbGlkYXRlSW5kZXgsXG4gIHZhbGlkYXRlRmluZFJlcXVlc3QsXG4gIHZhbGlkYXRlU29ydCxcbiAgcmV2ZXJzZU9wdGlvbnMsXG4gIGZpbHRlckluY2x1c2l2ZVN0YXJ0LFxuICBtYXNzYWdlSW5kZXhEZWYsXG4gIGdldFVzZXJGaWVsZHMsXG4gIG1hc3NhZ2VVc2VJbmRleFxufTtcbiIsImltcG9ydCBhYnN0cmFjdE1hcHBlciBmcm9tICcuLi9hYnN0cmFjdC1tYXBwZXInO1xuaW1wb3J0IHsgbWFzc2FnZUluZGV4RGVmLCB2YWxpZGF0ZUluZGV4IH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IHsgY2xvbmUsIHVwc2VydCB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0IHsgc3RyaW5nTWQ1IH0gZnJvbSAncG91Y2hkYi1tZDUnO1xuaW1wb3J0IG1hc3NhZ2VDcmVhdGVJbmRleFJlcXVlc3QgZnJvbSAnLi4vLi4vLi4vbWFzc2FnZUNyZWF0ZUluZGV4UmVxdWVzdCc7XG5pbXBvcnQgeyBtZXJnZU9iamVjdHMgfSBmcm9tICcuLi8uLi8uLi91dGlscyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZUluZGV4KGRiLCByZXF1ZXN0RGVmKSB7XG4gIHJlcXVlc3REZWYgPSBtYXNzYWdlQ3JlYXRlSW5kZXhSZXF1ZXN0KHJlcXVlc3REZWYpO1xuICB2YXIgb3JpZ2luYWxJbmRleERlZiA9IGNsb25lKHJlcXVlc3REZWYuaW5kZXgpO1xuICByZXF1ZXN0RGVmLmluZGV4ID0gbWFzc2FnZUluZGV4RGVmKHJlcXVlc3REZWYuaW5kZXgpO1xuXG4gIHZhbGlkYXRlSW5kZXgocmVxdWVzdERlZi5pbmRleCk7XG5cbiAgLy8gY2FsY3VsYXRpbmcgbWQ1IGlzIGV4cGVuc2l2ZSAtIG1lbW9pemUgYW5kIG9ubHlcbiAgLy8gcnVuIGlmIHJlcXVpcmVkXG4gIHZhciBtZDU7XG4gIGZ1bmN0aW9uIGdldE1kNSgpIHtcbiAgICByZXR1cm4gbWQ1IHx8IChtZDUgPSBzdHJpbmdNZDUoSlNPTi5zdHJpbmdpZnkocmVxdWVzdERlZikpKTtcbiAgfVxuXG4gIHZhciB2aWV3TmFtZSA9IHJlcXVlc3REZWYubmFtZSB8fCAoJ2lkeC0nICsgZ2V0TWQ1KCkpO1xuXG4gIHZhciBkZG9jTmFtZSA9IHJlcXVlc3REZWYuZGRvYyB8fCAoJ2lkeC0nICsgZ2V0TWQ1KCkpO1xuICB2YXIgZGRvY0lkID0gJ19kZXNpZ24vJyArIGRkb2NOYW1lO1xuXG4gIHZhciBoYXNJbnZhbGlkTGFuZ3VhZ2UgPSBmYWxzZTtcbiAgdmFyIHZpZXdFeGlzdHMgPSBmYWxzZTtcblxuICBmdW5jdGlvbiB1cGRhdGVEZG9jKGRvYykge1xuICAgIGlmIChkb2MuX3JldiAmJiBkb2MubGFuZ3VhZ2UgIT09ICdxdWVyeScpIHtcbiAgICAgIGhhc0ludmFsaWRMYW5ndWFnZSA9IHRydWU7XG4gICAgfVxuICAgIGRvYy5sYW5ndWFnZSA9ICdxdWVyeSc7XG4gICAgZG9jLnZpZXdzID0gZG9jLnZpZXdzIHx8IHt9O1xuXG4gICAgdmlld0V4aXN0cyA9ICEhZG9jLnZpZXdzW3ZpZXdOYW1lXTtcblxuICAgIGlmICh2aWV3RXhpc3RzKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgZG9jLnZpZXdzW3ZpZXdOYW1lXSA9IHtcbiAgICAgIG1hcDoge1xuICAgICAgICBmaWVsZHM6IG1lcmdlT2JqZWN0cyhyZXF1ZXN0RGVmLmluZGV4LmZpZWxkcyksXG4gICAgICAgIHBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yOiByZXF1ZXN0RGVmLmluZGV4LnBhcnRpYWxfZmlsdGVyX3NlbGVjdG9yXG4gICAgICB9LFxuICAgICAgcmVkdWNlOiAnX2NvdW50JyxcbiAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgZGVmOiBvcmlnaW5hbEluZGV4RGVmXG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBkb2M7XG4gIH1cblxuICBkYi5jb25zdHJ1Y3Rvci5lbWl0KCdkZWJ1ZycsIFsnZmluZCcsICdjcmVhdGluZyBpbmRleCcsIGRkb2NJZF0pO1xuXG4gIHJldHVybiB1cHNlcnQoZGIsIGRkb2NJZCwgdXBkYXRlRGRvYykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGhhc0ludmFsaWRMYW5ndWFnZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGxhbmd1YWdlIGZvciBkZG9jIHdpdGggaWQgXCInICtcbiAgICAgIGRkb2NJZCArXG4gICAgICAnXCIgKHNob3VsZCBiZSBcInF1ZXJ5XCIpJyk7XG4gICAgfVxuICB9KS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBraWNrIG9mZiBhIGJ1aWxkXG4gICAgLy8gVE9ETzogYWJzdHJhY3QtcG91Y2hkYi1tYXByZWR1Y2Ugc2hvdWxkIHN1cHBvcnQgYXV0by11cGRhdGluZ1xuICAgIC8vIFRPRE86IHNob3VsZCBhbHNvIHVzZSB1cGRhdGVfYWZ0ZXIsIGJ1dCBwb3VjaGRiL3BvdWNoZGIjMzQxNSBibG9ja3MgbWVcbiAgICB2YXIgc2lnbmF0dXJlID0gZGRvY05hbWUgKyAnLycgKyB2aWV3TmFtZTtcbiAgICByZXR1cm4gYWJzdHJhY3RNYXBwZXIoZGIpLnF1ZXJ5LmNhbGwoZGIsIHNpZ25hdHVyZSwge1xuICAgICAgbGltaXQ6IDAsXG4gICAgICByZWR1Y2U6IGZhbHNlXG4gICAgfSkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpZDogZGRvY0lkLFxuICAgICAgICBuYW1lOiB2aWV3TmFtZSxcbiAgICAgICAgcmVzdWx0OiB2aWV3RXhpc3RzID8gJ2V4aXN0cycgOiAnY3JlYXRlZCdcbiAgICAgIH07XG4gICAgfSk7XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjcmVhdGVJbmRleDtcbiIsImltcG9ydCB7IGZsYXR0ZW4gfSBmcm9tICcuLi8uLi8uLi91dGlscyc7XG5pbXBvcnQgeyBtYXNzYWdlSW5kZXhEZWYgfSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQgeyBjb21wYXJlIH0gZnJvbSAncG91Y2hkYi1zZWxlY3Rvci1jb3JlJztcblxuZnVuY3Rpb24gZ2V0SW5kZXhlcyhkYikge1xuICAvLyBqdXN0IHNlYXJjaCB0aHJvdWdoIGFsbCB0aGUgZGVzaWduIGRvY3MgYW5kIGZpbHRlciBpbi1tZW1vcnkuXG4gIC8vIGhvcGVmdWxseSB0aGVyZSBhcmVuJ3QgdGhhdCBtYW55IGRkb2NzLlxuICByZXR1cm4gZGIuYWxsRG9jcyh7XG4gICAgc3RhcnRrZXk6ICdfZGVzaWduLycsXG4gICAgZW5ka2V5OiAnX2Rlc2lnbi9cXHVmZmZmJyxcbiAgICBpbmNsdWRlX2RvY3M6IHRydWVcbiAgfSkudGhlbihmdW5jdGlvbiAoYWxsRG9jc1Jlcykge1xuICAgIHZhciByZXMgPSB7XG4gICAgICBpbmRleGVzOiBbe1xuICAgICAgICBkZG9jOiBudWxsLFxuICAgICAgICBuYW1lOiAnX2FsbF9kb2NzJyxcbiAgICAgICAgdHlwZTogJ3NwZWNpYWwnLFxuICAgICAgICBkZWY6IHtcbiAgICAgICAgICBmaWVsZHM6IFt7X2lkOiAnYXNjJ31dXG4gICAgICAgIH1cbiAgICAgIH1dXG4gICAgfTtcblxuICAgIHJlcy5pbmRleGVzID0gZmxhdHRlbihyZXMuaW5kZXhlcywgYWxsRG9jc1Jlcy5yb3dzLmZpbHRlcihmdW5jdGlvbiAocm93KSB7XG4gICAgICByZXR1cm4gcm93LmRvYy5sYW5ndWFnZSA9PT0gJ3F1ZXJ5JztcbiAgICB9KS5tYXAoZnVuY3Rpb24gKHJvdykge1xuICAgICAgdmFyIHZpZXdOYW1lcyA9IHJvdy5kb2Mudmlld3MgIT09IHVuZGVmaW5lZCA/IE9iamVjdC5rZXlzKHJvdy5kb2Mudmlld3MpIDogW107XG5cbiAgICAgIHJldHVybiB2aWV3TmFtZXMubWFwKGZ1bmN0aW9uICh2aWV3TmFtZSkge1xuICAgICAgICB2YXIgdmlldyA9IHJvdy5kb2Mudmlld3Nbdmlld05hbWVdO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRkb2M6IHJvdy5pZCxcbiAgICAgICAgICBuYW1lOiB2aWV3TmFtZSxcbiAgICAgICAgICB0eXBlOiAnanNvbicsXG4gICAgICAgICAgZGVmOiBtYXNzYWdlSW5kZXhEZWYodmlldy5vcHRpb25zLmRlZilcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuICAgIH0pKTtcblxuICAgIC8vIHRoZXNlIGFyZSBzb3J0ZWQgYnkgdmlldyBuYW1lIGZvciBzb21lIHJlYXNvblxuICAgIHJlcy5pbmRleGVzLnNvcnQoZnVuY3Rpb24gKGxlZnQsIHJpZ2h0KSB7XG4gICAgICByZXR1cm4gY29tcGFyZShsZWZ0Lm5hbWUsIHJpZ2h0Lm5hbWUpO1xuICAgIH0pO1xuICAgIHJlcy50b3RhbF9yb3dzID0gcmVzLmluZGV4ZXMubGVuZ3RoO1xuICAgIHJldHVybiByZXM7XG4gIH0pO1xufVxuXG5leHBvcnQgZGVmYXVsdCBnZXRJbmRleGVzO1xuIiwiaW1wb3J0IHtcbiAgZ2V0VXNlckZpZWxkc1xufSBmcm9tICcuLi91dGlscyc7XG5pbXBvcnQge1xuICBnZXRLZXksXG4gIGNvbXBhcmVcbn0gZnJvbSAncG91Y2hkYi1zZWxlY3Rvci1jb3JlJztcbmltcG9ydCB7XG4gIGFycmF5RXF1YWxzLFxuICBhcnJheVRvT2JqZWN0LFxuICBmbGF0dGVuLFxuICBtYXgsXG4gIG1lcmdlT2JqZWN0cyxcbiAgb25lQXJyYXlJc1N0cmljdFN1YkFycmF5T2ZPdGhlcixcbiAgb25lQXJyYXlJc1N1YkFycmF5T2ZPdGhlcixcbiAgb25lU2V0SXNTdWJBcnJheU9mT3RoZXIsXG4gIHVuaXFcbn0gZnJvbSAnLi4vLi4vLi4vdXRpbHMnO1xuXG4vLyBjb3VjaGRiIGxvd2VzdCBjb2xsYXRpb24gdmFsdWVcbnZhciBDT0xMQVRFX0xPID0gbnVsbDtcblxuLy8gY291Y2hkYiBoaWdoZXN0IGNvbGxhdGlvbiB2YWx1ZSAoVE9ETzogd2VsbCBub3QgcmVhbGx5LCBidXQgY2xvc2UgZW5vdWdoIGFtaXJpdGUpXG52YXIgQ09MTEFURV9ISSA9IHtcIlxcdWZmZmZcIjoge319O1xuXG5jb25zdCBTSE9SVF9DSVJDVUlUX1FVRVJZID0ge1xuICBxdWVyeU9wdHM6IHsgbGltaXQ6IDAsIHN0YXJ0a2V5OiBDT0xMQVRFX0hJLCBlbmRrZXk6IENPTExBVEVfTE8gfSxcbiAgaW5NZW1vcnlGaWVsZHM6IFtdLFxufTtcblxuLy8gY291Y2hkYiBzZWNvbmQtbG93ZXN0IGNvbGxhdGlvbiB2YWx1ZVxuXG5mdW5jdGlvbiBjaGVja0ZpZWxkSW5JbmRleChpbmRleCwgZmllbGQpIHtcbiAgdmFyIGluZGV4RmllbGRzID0gaW5kZXguZGVmLmZpZWxkcy5tYXAoZ2V0S2V5KTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGluZGV4RmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGluZGV4RmllbGQgPSBpbmRleEZpZWxkc1tpXTtcbiAgICBpZiAoZmllbGQgPT09IGluZGV4RmllbGQpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIHNvIHdoZW4geW91IGRvIGUuZy4gJGVxLyRlcSwgd2UgY2FuIGRvIGl0IGVudGlyZWx5IGluIHRoZSBkYXRhYmFzZS5cbi8vIGJ1dCB3aGVuIHlvdSBkbyBlLmcuICRndC8kZXEsIHRoZSBmaXJzdCBwYXJ0IGNhbiBiZSBkb25lXG4vLyBpbiB0aGUgZGF0YWJhc2UsIGJ1dCB0aGUgc2Vjb25kIHBhcnQgaGFzIHRvIGJlIGRvbmUgaW4tbWVtb3J5LFxuLy8gYmVjYXVzZSAkZ3QgaGFzIGZvcmNlZCB1cyB0byBsb3NlIHByZWNpc2lvbi5cbi8vIHNvIHRoYXQncyB3aGF0IHRoaXMgZGV0ZXJtaW5lc1xuZnVuY3Rpb24gdXNlck9wZXJhdG9yTG9zZXNQcmVjaXNpb24oc2VsZWN0b3IsIGZpZWxkKSB7XG4gIHZhciBtYXRjaGVyID0gc2VsZWN0b3JbZmllbGRdO1xuICB2YXIgdXNlck9wZXJhdG9yID0gZ2V0S2V5KG1hdGNoZXIpO1xuXG4gIHJldHVybiB1c2VyT3BlcmF0b3IgIT09ICckZXEnO1xufVxuXG4vLyBzb3J0IHRoZSB1c2VyIGZpZWxkcyBieSB0aGVpciBwb3NpdGlvbiBpbiB0aGUgaW5kZXgsXG4vLyBpZiB0aGV5J3JlIGluIHRoZSBpbmRleFxuZnVuY3Rpb24gc29ydEZpZWxkc0J5SW5kZXgodXNlckZpZWxkcywgaW5kZXgpIHtcbiAgdmFyIGluZGV4RmllbGRzID0gaW5kZXguZGVmLmZpZWxkcy5tYXAoZ2V0S2V5KTtcblxuICByZXR1cm4gdXNlckZpZWxkcy5zbGljZSgpLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcbiAgICB2YXIgYUlkeCA9IGluZGV4RmllbGRzLmluZGV4T2YoYSk7XG4gICAgdmFyIGJJZHggPSBpbmRleEZpZWxkcy5pbmRleE9mKGIpO1xuICAgIGlmIChhSWR4ID09PSAtMSkge1xuICAgICAgYUlkeCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgfVxuICAgIGlmIChiSWR4ID09PSAtMSkge1xuICAgICAgYklkeCA9IE51bWJlci5NQVhfVkFMVUU7XG4gICAgfVxuICAgIHJldHVybiBjb21wYXJlKGFJZHgsIGJJZHgpO1xuICB9KTtcbn1cblxuLy8gZmlyc3QgcGFzcyB0byB0cnkgdG8gZmluZCBmaWVsZHMgdGhhdCB3aWxsIG5lZWQgdG8gYmUgc29ydGVkIGluLW1lbW9yeVxuZnVuY3Rpb24gZ2V0QmFzaWNJbk1lbW9yeUZpZWxkcyhpbmRleCwgc2VsZWN0b3IsIHVzZXJGaWVsZHMpIHtcblxuICB1c2VyRmllbGRzID0gc29ydEZpZWxkc0J5SW5kZXgodXNlckZpZWxkcywgaW5kZXgpO1xuXG4gIC8vIGNoZWNrIGlmIGFueSBvZiB0aGUgdXNlciBzZWxlY3RvcnMgbG9zZSBwcmVjaXNpb25cbiAgdmFyIG5lZWRUb0ZpbHRlckluTWVtb3J5ID0gZmFsc2U7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSB1c2VyRmllbGRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGZpZWxkID0gdXNlckZpZWxkc1tpXTtcbiAgICBpZiAobmVlZFRvRmlsdGVySW5NZW1vcnkgfHwgIWNoZWNrRmllbGRJbkluZGV4KGluZGV4LCBmaWVsZCkpIHtcbiAgICAgIHJldHVybiB1c2VyRmllbGRzLnNsaWNlKGkpO1xuICAgIH1cbiAgICBpZiAoaSA8IGxlbiAtIDEgJiYgdXNlck9wZXJhdG9yTG9zZXNQcmVjaXNpb24oc2VsZWN0b3IsIGZpZWxkKSkge1xuICAgICAgbmVlZFRvRmlsdGVySW5NZW1vcnkgPSB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gW107XG59XG5cbmZ1bmN0aW9uIGdldEluTWVtb3J5RmllbGRzRnJvbU5lKHNlbGVjdG9yKSB7XG4gIHZhciBmaWVsZHMgPSBbXTtcbiAgT2JqZWN0LmtleXMoc2VsZWN0b3IpLmZvckVhY2goZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgdmFyIG1hdGNoZXIgPSBzZWxlY3RvcltmaWVsZF07XG4gICAgT2JqZWN0LmtleXMobWF0Y2hlcikuZm9yRWFjaChmdW5jdGlvbiAob3BlcmF0b3IpIHtcbiAgICAgIGlmIChvcGVyYXRvciA9PT0gJyRuZScpIHtcbiAgICAgICAgZmllbGRzLnB1c2goZmllbGQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbiAgcmV0dXJuIGZpZWxkcztcbn1cblxuZnVuY3Rpb24gZ2V0SW5NZW1vcnlGaWVsZHMoY29yZUluTWVtb3J5RmllbGRzLCBpbmRleCwgc2VsZWN0b3IsIHVzZXJGaWVsZHMpIHtcbiAgdmFyIHJlc3VsdCA9IGZsYXR0ZW4oXG4gICAgLy8gaW4tbWVtb3J5IGZpZWxkcyByZXBvcnRlZCBhcyBuZWNlc3NhcnkgYnkgdGhlIHF1ZXJ5IHBsYW5uZXJcbiAgICBjb3JlSW5NZW1vcnlGaWVsZHMsXG4gICAgLy8gY29tYmluZSB3aXRoIGFub3RoZXIgcGFzcyB0aGF0IGNoZWNrcyBmb3IgYW55IHdlIG1heSBoYXZlIG1pc3NlZFxuICAgIGdldEJhc2ljSW5NZW1vcnlGaWVsZHMoaW5kZXgsIHNlbGVjdG9yLCB1c2VyRmllbGRzKSxcbiAgICAvLyBjb21iaW5lIHdpdGggYW5vdGhlciBwYXNzIHRoYXQgY2hlY2tzIGZvciAkbmUnc1xuICAgIGdldEluTWVtb3J5RmllbGRzRnJvbU5lKHNlbGVjdG9yKVxuICApO1xuXG4gIHJldHVybiBzb3J0RmllbGRzQnlJbmRleCh1bmlxKHJlc3VsdCksIGluZGV4KTtcbn1cblxuLy8gY2hlY2sgdGhhdCBhdCBsZWFzdCBvbmUgZmllbGQgaW4gdGhlIHVzZXIncyBxdWVyeSBpcyByZXByZXNlbnRlZFxuLy8gaW4gdGhlIGluZGV4LiBvcmRlciBtYXR0ZXJzIGluIHRoZSBjYXNlIG9mIHNvcnRzXG5mdW5jdGlvbiBjaGVja0luZGV4RmllbGRzTWF0Y2goaW5kZXhGaWVsZHMsIHNvcnRPcmRlciwgZmllbGRzKSB7XG4gIGlmIChzb3J0T3JkZXIpIHtcbiAgICAvLyBhcnJheSBoYXMgdG8gYmUgYSBzdHJpY3Qgc3ViYXJyYXkgb2YgaW5kZXggYXJyYXkuIGZ1cnRoZXJtb3JlLFxuICAgIC8vIHRoZSBzb3J0T3JkZXIgZmllbGRzIG5lZWQgdG8gYWxsIGJlIHJlcHJlc2VudGVkIGluIHRoZSBpbmRleFxuICAgIHZhciBzb3J0TWF0Y2hlcyA9IG9uZUFycmF5SXNTdHJpY3RTdWJBcnJheU9mT3RoZXIoc29ydE9yZGVyLCBpbmRleEZpZWxkcyk7XG4gICAgdmFyIHNlbGVjdG9yTWF0Y2hlcyA9IG9uZUFycmF5SXNTdWJBcnJheU9mT3RoZXIoZmllbGRzLCBpbmRleEZpZWxkcyk7XG5cbiAgICByZXR1cm4gc29ydE1hdGNoZXMgJiYgc2VsZWN0b3JNYXRjaGVzO1xuICB9XG5cbiAgLy8gYWxsIG9mIHRoZSB1c2VyJ3Mgc3BlY2lmaWVkIGZpZWxkcyBzdGlsbCBuZWVkIHRvIGJlXG4gIC8vIG9uIHRoZSBsZWZ0IHNpZGUgb2YgdGhlIGluZGV4IGFycmF5LCBhbHRob3VnaCB0aGUgb3JkZXJcbiAgLy8gZG9lc24ndCBtYXR0ZXJcbiAgcmV0dXJuIG9uZVNldElzU3ViQXJyYXlPZk90aGVyKGZpZWxkcywgaW5kZXhGaWVsZHMpO1xufVxuXG52YXIgbG9naWNhbE1hdGNoZXJzID0gWyckZXEnLCAnJGd0JywgJyRndGUnLCAnJGx0JywgJyRsdGUnXTtcbmZ1bmN0aW9uIGlzTm9uTG9naWNhbE1hdGNoZXIobWF0Y2hlcikge1xuICByZXR1cm4gbG9naWNhbE1hdGNoZXJzLmluZGV4T2YobWF0Y2hlcikgPT09IC0xO1xufVxuXG4vLyBjaGVjayBhbGwgdGhlIGluZGV4IGZpZWxkcyBmb3IgdXNhZ2VzIG9mICckbmUnXG4vLyBlLmcuIGlmIHRoZSB1c2VyIHF1ZXJpZXMge2ZvbzogeyRuZTogJ2Zvbyd9LCBiYXI6IHskZXE6ICdiYXInfX0sXG4vLyB0aGVuIHdlIGNhbiBuZWl0aGVyIHVzZSBhbiBpbmRleCBvbiBbJ2ZvbyddIG5vciBhbiBpbmRleCBvblxuLy8gWydmb28nLCAnYmFyJ10sIGJ1dCB3ZSBjYW4gdXNlIGFuIGluZGV4IG9uIFsnYmFyJ10gb3IgWydiYXInLCAnZm9vJ11cbmZ1bmN0aW9uIGNoZWNrRmllbGRzTG9naWNhbGx5U291bmQoaW5kZXhGaWVsZHMsIHNlbGVjdG9yKSB7XG4gIHZhciBmaXJzdEZpZWxkID0gaW5kZXhGaWVsZHNbMF07XG4gIHZhciBtYXRjaGVyID0gc2VsZWN0b3JbZmlyc3RGaWVsZF07XG5cbiAgaWYgKHR5cGVvZiBtYXRjaGVyID09PSAndW5kZWZpbmVkJykge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICB2YXIgaXNJbnZhbGlkTmUgPSBPYmplY3Qua2V5cyhtYXRjaGVyKS5sZW5ndGggPT09IDEgJiZcbiAgICBnZXRLZXkobWF0Y2hlcikgPT09ICckbmUnO1xuXG4gIHJldHVybiAhaXNJbnZhbGlkTmU7XG59XG5cbmZ1bmN0aW9uIGNoZWNrSW5kZXhNYXRjaGVzKGluZGV4LCBzb3J0T3JkZXIsIGZpZWxkcywgc2VsZWN0b3IpIHtcblxuICB2YXIgaW5kZXhGaWVsZHMgPSBpbmRleC5kZWYuZmllbGRzLm1hcChnZXRLZXkpO1xuXG4gIHZhciBmaWVsZHNNYXRjaCA9IGNoZWNrSW5kZXhGaWVsZHNNYXRjaChpbmRleEZpZWxkcywgc29ydE9yZGVyLCBmaWVsZHMpO1xuXG4gIGlmICghZmllbGRzTWF0Y2gpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gY2hlY2tGaWVsZHNMb2dpY2FsbHlTb3VuZChpbmRleEZpZWxkcywgc2VsZWN0b3IpO1xufVxuXG4vL1xuLy8gdGhlIGFsZ29yaXRobSBpcyB2ZXJ5IHNpbXBsZTpcbi8vIHRha2UgYWxsIHRoZSBmaWVsZHMgdGhlIHVzZXIgc3VwcGxpZXMsIGFuZCBpZiB0aG9zZSBmaWVsZHNcbi8vIGFyZSBhIHN0cmljdCBzdWJzZXQgb2YgdGhlIGZpZWxkcyBpbiBzb21lIGluZGV4LFxuLy8gdGhlbiB1c2UgdGhhdCBpbmRleFxuLy9cbi8vXG5mdW5jdGlvbiBmaW5kTWF0Y2hpbmdJbmRleGVzKHNlbGVjdG9yLCB1c2VyRmllbGRzLCBzb3J0T3JkZXIsIGluZGV4ZXMpIHtcbiAgcmV0dXJuIGluZGV4ZXMuZmlsdGVyKGZ1bmN0aW9uIChpbmRleCkge1xuICAgIHJldHVybiBjaGVja0luZGV4TWF0Y2hlcyhpbmRleCwgc29ydE9yZGVyLCB1c2VyRmllbGRzLCBzZWxlY3Rvcik7XG4gIH0pO1xufVxuXG4vLyBmaW5kIHRoZSBiZXN0IGluZGV4LCBpLmUuIHRoZSBvbmUgdGhhdCBtYXRjaGVzIHRoZSBtb3N0IGZpZWxkc1xuLy8gaW4gdGhlIHVzZXIncyBxdWVyeVxuZnVuY3Rpb24gZmluZEJlc3RNYXRjaGluZ0luZGV4KHNlbGVjdG9yLCB1c2VyRmllbGRzLCBzb3J0T3JkZXIsIGluZGV4ZXMsIHVzZUluZGV4KSB7XG5cbiAgdmFyIG1hdGNoaW5nSW5kZXhlcyA9IGZpbmRNYXRjaGluZ0luZGV4ZXMoc2VsZWN0b3IsIHVzZXJGaWVsZHMsIHNvcnRPcmRlciwgaW5kZXhlcyk7XG5cbiAgaWYgKG1hdGNoaW5nSW5kZXhlcy5sZW5ndGggPT09IDApIHtcbiAgICBpZiAodXNlSW5kZXgpIHtcbiAgICAgIHRocm93IHtcbiAgICAgICAgZXJyb3I6IFwibm9fdXNhYmxlX2luZGV4XCIsXG4gICAgICAgIG1lc3NhZ2U6IFwiVGhlcmUgaXMgbm8gaW5kZXggYXZhaWxhYmxlIGZvciB0aGlzIHNlbGVjdG9yLlwiXG4gICAgICB9O1xuICAgIH1cbiAgICAvL3JldHVybiBgYWxsX2RvY3NgIGFzIGEgZGVmYXVsdCBpbmRleDtcbiAgICAvL0knbSBhc3N1bWluZyB0aGF0IF9hbGxfZG9jcyBpcyBhbHdheXMgZmlyc3RcbiAgICB2YXIgZGVmYXVsdEluZGV4ID0gaW5kZXhlc1swXTtcbiAgICBkZWZhdWx0SW5kZXguZGVmYXVsdFVzZWQgPSB0cnVlO1xuICAgIHJldHVybiBkZWZhdWx0SW5kZXg7XG4gIH1cbiAgaWYgKG1hdGNoaW5nSW5kZXhlcy5sZW5ndGggPT09IDEgJiYgIXVzZUluZGV4KSB7XG4gICAgcmV0dXJuIG1hdGNoaW5nSW5kZXhlc1swXTtcbiAgfVxuXG4gIHZhciB1c2VyRmllbGRzTWFwID0gYXJyYXlUb09iamVjdCh1c2VyRmllbGRzKTtcblxuICBmdW5jdGlvbiBzY29yZUluZGV4KGluZGV4KSB7XG4gICAgdmFyIGluZGV4RmllbGRzID0gaW5kZXguZGVmLmZpZWxkcy5tYXAoZ2V0S2V5KTtcbiAgICB2YXIgc2NvcmUgPSAwO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBpbmRleEZpZWxkcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIGluZGV4RmllbGQgPSBpbmRleEZpZWxkc1tpXTtcbiAgICAgIGlmICh1c2VyRmllbGRzTWFwW2luZGV4RmllbGRdKSB7XG4gICAgICAgIHNjb3JlKys7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBzY29yZTtcbiAgfVxuXG4gIGlmICh1c2VJbmRleCkge1xuICAgIHZhciB1c2VJbmRleERkb2MgPSAnX2Rlc2lnbi8nICsgdXNlSW5kZXhbMF07XG4gICAgdmFyIHVzZUluZGV4TmFtZSA9IHVzZUluZGV4Lmxlbmd0aCA9PT0gMiA/IHVzZUluZGV4WzFdIDogZmFsc2U7XG4gICAgdmFyIGluZGV4ID0gbWF0Y2hpbmdJbmRleGVzLmZpbmQoZnVuY3Rpb24gKGluZGV4KSB7XG4gICAgICBpZiAodXNlSW5kZXhOYW1lICYmIGluZGV4LmRkb2MgPT09IHVzZUluZGV4RGRvYyAmJiB1c2VJbmRleE5hbWUgPT09IGluZGV4Lm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChpbmRleC5kZG9jID09PSB1c2VJbmRleERkb2MpIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcblxuICAgIGlmICghaW5kZXgpIHtcbiAgICAgIHRocm93IHtcbiAgICAgICAgZXJyb3I6IFwidW5rbm93bl9lcnJvclwiLFxuICAgICAgICBtZXNzYWdlOiBcIkNvdWxkIG5vdCBmaW5kIHRoYXQgaW5kZXggb3IgY291bGQgbm90IHVzZSB0aGF0IGluZGV4IGZvciB0aGUgcXVlcnlcIlxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGluZGV4O1xuICB9XG5cbiAgcmV0dXJuIG1heChtYXRjaGluZ0luZGV4ZXMsIHNjb3JlSW5kZXgpO1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVGaWVsZFF1ZXJ5T3B0c0Zvcih1c2VyT3BlcmF0b3IsIHVzZXJWYWx1ZSkge1xuICBzd2l0Y2ggKHVzZXJPcGVyYXRvcikge1xuICAgIGNhc2UgJyRlcSc6XG4gICAgICByZXR1cm4ge2tleTogdXNlclZhbHVlfTtcbiAgICBjYXNlICckbHRlJzpcbiAgICAgIHJldHVybiB7ZW5ka2V5OiB1c2VyVmFsdWV9O1xuICAgIGNhc2UgJyRndGUnOlxuICAgICAgcmV0dXJuIHtzdGFydGtleTogdXNlclZhbHVlfTtcbiAgICBjYXNlICckbHQnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5ka2V5OiB1c2VyVmFsdWUsXG4gICAgICAgIGluY2x1c2l2ZV9lbmQ6IGZhbHNlXG4gICAgICB9O1xuICAgIGNhc2UgJyRndCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGFydGtleTogdXNlclZhbHVlLFxuICAgICAgICBpbmNsdXNpdmVfc3RhcnQ6IGZhbHNlXG4gICAgICB9O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzdGFydGtleTogQ09MTEFURV9MT1xuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRTaW5nbGVGaWVsZENvcmVRdWVyeVBsYW4oc2VsZWN0b3IsIGluZGV4KSB7XG4gIHZhciBmaWVsZCA9IGdldEtleShpbmRleC5kZWYuZmllbGRzWzBdKTtcbiAgLy9pZ25vcmluZyB0aGlzIGJlY2F1c2UgdGhlIHRlc3QgdG8gZXhlcmNpc2UgdGhlIGJyYW5jaCBpcyBza2lwcGVkIGF0IHRoZSBtb21lbnRcbiAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgdmFyIG1hdGNoZXIgPSBzZWxlY3RvcltmaWVsZF0gfHwge307XG4gIHZhciBpbk1lbW9yeUZpZWxkcyA9IFtdO1xuXG4gIHZhciB1c2VyT3BlcmF0b3JzID0gT2JqZWN0LmtleXMobWF0Y2hlcik7XG5cbiAgdmFyIGNvbWJpbmVkT3B0cztcblxuICB1c2VyT3BlcmF0b3JzLmZvckVhY2goZnVuY3Rpb24gKHVzZXJPcGVyYXRvcikge1xuXG4gICAgaWYgKGlzTm9uTG9naWNhbE1hdGNoZXIodXNlck9wZXJhdG9yKSkge1xuICAgICAgaW5NZW1vcnlGaWVsZHMucHVzaChmaWVsZCk7XG4gICAgfVxuXG4gICAgdmFyIHVzZXJWYWx1ZSA9IG1hdGNoZXJbdXNlck9wZXJhdG9yXTtcblxuICAgIHZhciBuZXdRdWVyeU9wdHMgPSBnZXRTaW5nbGVGaWVsZFF1ZXJ5T3B0c0Zvcih1c2VyT3BlcmF0b3IsIHVzZXJWYWx1ZSk7XG5cbiAgICBpZiAoY29tYmluZWRPcHRzKSB7XG4gICAgICBjb21iaW5lZE9wdHMgPSBtZXJnZU9iamVjdHMoW2NvbWJpbmVkT3B0cywgbmV3UXVlcnlPcHRzXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbWJpbmVkT3B0cyA9IG5ld1F1ZXJ5T3B0cztcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgcXVlcnlPcHRzOiBjb21iaW5lZE9wdHMsXG4gICAgaW5NZW1vcnlGaWVsZHM6IGluTWVtb3J5RmllbGRzXG4gIH07XG59XG5cbmZ1bmN0aW9uIGdldE11bHRpRmllbGRDb3JlUXVlcnlQbGFuKHVzZXJPcGVyYXRvciwgdXNlclZhbHVlKSB7XG4gIHN3aXRjaCAodXNlck9wZXJhdG9yKSB7XG4gICAgY2FzZSAnJGVxJzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXJ0a2V5OiB1c2VyVmFsdWUsXG4gICAgICAgIGVuZGtleTogdXNlclZhbHVlXG4gICAgICB9O1xuICAgIGNhc2UgJyRsdGUnOlxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZW5ka2V5OiB1c2VyVmFsdWVcbiAgICAgIH07XG4gICAgY2FzZSAnJGd0ZSc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGFydGtleTogdXNlclZhbHVlXG4gICAgICB9O1xuICAgIGNhc2UgJyRsdCc6XG4gICAgICByZXR1cm4ge1xuICAgICAgICBlbmRrZXk6IHVzZXJWYWx1ZSxcbiAgICAgICAgaW5jbHVzaXZlX2VuZDogZmFsc2VcbiAgICAgIH07XG4gICAgY2FzZSAnJGd0JzpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXJ0a2V5OiB1c2VyVmFsdWUsXG4gICAgICAgIGluY2x1c2l2ZV9zdGFydDogZmFsc2VcbiAgICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0TXVsdGlGaWVsZFF1ZXJ5T3B0cyhzZWxlY3RvciwgaW5kZXgpIHtcblxuICB2YXIgaW5kZXhGaWVsZHMgPSBpbmRleC5kZWYuZmllbGRzLm1hcChnZXRLZXkpO1xuXG4gIHZhciBpbk1lbW9yeUZpZWxkcyA9IFtdO1xuICB2YXIgc3RhcnRrZXkgPSBbXTtcbiAgdmFyIGVuZGtleSA9IFtdO1xuICB2YXIgaW5jbHVzaXZlU3RhcnQ7XG4gIHZhciBpbmNsdXNpdmVFbmQ7XG5cblxuICBmdW5jdGlvbiBmaW5pc2goaSkge1xuXG4gICAgaWYgKGluY2x1c2l2ZVN0YXJ0ICE9PSBmYWxzZSkge1xuICAgICAgc3RhcnRrZXkucHVzaChDT0xMQVRFX0xPKTtcbiAgICB9XG4gICAgaWYgKGluY2x1c2l2ZUVuZCAhPT0gZmFsc2UpIHtcbiAgICAgIGVuZGtleS5wdXNoKENPTExBVEVfSEkpO1xuICAgIH1cbiAgICAvLyBrZWVwIHRyYWNrIG9mIHRoZSBmaWVsZHMgd2hlcmUgd2UgbG9zdCBzcGVjaWZpY2l0eSxcbiAgICAvLyBhbmQgdGhlcmVmb3JlIG5lZWQgdG8gZmlsdGVyIGluLW1lbW9yeVxuICAgIGluTWVtb3J5RmllbGRzID0gaW5kZXhGaWVsZHMuc2xpY2UoaSk7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gaW5kZXhGaWVsZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICB2YXIgaW5kZXhGaWVsZCA9IGluZGV4RmllbGRzW2ldO1xuXG4gICAgdmFyIG1hdGNoZXIgPSBzZWxlY3RvcltpbmRleEZpZWxkXTtcblxuICAgIGlmICghbWF0Y2hlciB8fCAhT2JqZWN0LmtleXMobWF0Y2hlcikubGVuZ3RoKSB7IC8vIGZld2VyIGZpZWxkcyBpbiB1c2VyIHF1ZXJ5IHRoYW4gaW4gaW5kZXhcbiAgICAgIGZpbmlzaChpKTtcbiAgICAgIGJyZWFrO1xuICAgIH0gZWxzZSBpZiAoT2JqZWN0LmtleXMobWF0Y2hlcikuc29tZShpc05vbkxvZ2ljYWxNYXRjaGVyKSkgeyAvLyBub24tbG9naWNhbCBhcmUgaWdub3JlZFxuICAgICAgZmluaXNoKGkpO1xuICAgICAgYnJlYWs7XG4gICAgfSBlbHNlIGlmIChpID4gMCkge1xuICAgICAgdmFyIHVzaW5nR3RsdCA9IChcbiAgICAgICAgJyRndCcgaW4gbWF0Y2hlciB8fCAnJGd0ZScgaW4gbWF0Y2hlciB8fFxuICAgICAgICAnJGx0JyBpbiBtYXRjaGVyIHx8ICckbHRlJyBpbiBtYXRjaGVyKTtcbiAgICAgIHZhciBwcmV2aW91c0tleXMgPSBPYmplY3Qua2V5cyhzZWxlY3RvcltpbmRleEZpZWxkc1tpIC0gMV1dKTtcbiAgICAgIHZhciBwcmV2aW91c1dhc0VxID0gYXJyYXlFcXVhbHMocHJldmlvdXNLZXlzLCBbJyRlcSddKTtcbiAgICAgIHZhciBwcmV2aW91c1dhc1NhbWUgPSBhcnJheUVxdWFscyhwcmV2aW91c0tleXMsIE9iamVjdC5rZXlzKG1hdGNoZXIpKTtcbiAgICAgIHZhciBndGx0TG9zdFNwZWNpZmljaXR5ID0gdXNpbmdHdGx0ICYmICFwcmV2aW91c1dhc0VxICYmICFwcmV2aW91c1dhc1NhbWU7XG4gICAgICBpZiAoZ3RsdExvc3RTcGVjaWZpY2l0eSkge1xuICAgICAgICBmaW5pc2goaSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB1c2VyT3BlcmF0b3JzID0gT2JqZWN0LmtleXMobWF0Y2hlcik7XG5cbiAgICB2YXIgY29tYmluZWRPcHRzID0gbnVsbDtcblxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgdXNlck9wZXJhdG9ycy5sZW5ndGg7IGorKykge1xuICAgICAgdmFyIHVzZXJPcGVyYXRvciA9IHVzZXJPcGVyYXRvcnNbal07XG4gICAgICB2YXIgdXNlclZhbHVlID0gbWF0Y2hlclt1c2VyT3BlcmF0b3JdO1xuXG4gICAgICB2YXIgbmV3T3B0cyA9IGdldE11bHRpRmllbGRDb3JlUXVlcnlQbGFuKHVzZXJPcGVyYXRvciwgdXNlclZhbHVlKTtcblxuICAgICAgaWYgKGNvbWJpbmVkT3B0cykge1xuICAgICAgICBjb21iaW5lZE9wdHMgPSBtZXJnZU9iamVjdHMoW2NvbWJpbmVkT3B0cywgbmV3T3B0c10pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29tYmluZWRPcHRzID0gbmV3T3B0cztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzdGFydGtleS5wdXNoKCdzdGFydGtleScgaW4gY29tYmluZWRPcHRzID8gY29tYmluZWRPcHRzLnN0YXJ0a2V5IDogQ09MTEFURV9MTyk7XG4gICAgZW5ka2V5LnB1c2goJ2VuZGtleScgaW4gY29tYmluZWRPcHRzID8gY29tYmluZWRPcHRzLmVuZGtleSA6IENPTExBVEVfSEkpO1xuICAgIGlmICgnaW5jbHVzaXZlX3N0YXJ0JyBpbiBjb21iaW5lZE9wdHMpIHtcbiAgICAgIGluY2x1c2l2ZVN0YXJ0ID0gY29tYmluZWRPcHRzLmluY2x1c2l2ZV9zdGFydDtcbiAgICB9XG4gICAgaWYgKCdpbmNsdXNpdmVfZW5kJyBpbiBjb21iaW5lZE9wdHMpIHtcbiAgICAgIGluY2x1c2l2ZUVuZCA9IGNvbWJpbmVkT3B0cy5pbmNsdXNpdmVfZW5kO1xuICAgIH1cbiAgfVxuXG4gIHZhciByZXMgPSB7XG4gICAgc3RhcnRrZXk6IHN0YXJ0a2V5LFxuICAgIGVuZGtleTogZW5ka2V5XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBpbmNsdXNpdmVTdGFydCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXMuaW5jbHVzaXZlX3N0YXJ0ID0gaW5jbHVzaXZlU3RhcnQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBpbmNsdXNpdmVFbmQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmVzLmluY2x1c2l2ZV9lbmQgPSBpbmNsdXNpdmVFbmQ7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHF1ZXJ5T3B0czogcmVzLFxuICAgIGluTWVtb3J5RmllbGRzOiBpbk1lbW9yeUZpZWxkc1xuICB9O1xufVxuXG5mdW5jdGlvbiBzaG91bGRTaG9ydENpcmN1aXQoc2VsZWN0b3IpIHtcbiAgLy8gV2UgaGF2ZSBhIGZpZWxkIHRvIHNlbGVjdCBmcm9tLCBidXQgbm90IGEgdmFsaWQgdmFsdWVcbiAgLy8gdGhpcyBzaG91bGQgcmVzdWx0IGluIGEgc2hvcnQgY2lyY3VpdGVkIHF1ZXJ5IFxuICAvLyBqdXN0IGxpa2UgdGhlIGh0dHAgYWRhcHRlciAoY291Y2hkYikgYW5kIG1vbmdvZGJcbiAgLy8gc2VlIHRlc3RzIGZvciBpc3N1ZSAjNzgxMFxuICBcbiAgLy8gQHRvZG8gVXNlICdPYmplY3QudmFsdWVzJyB3aGVuIE5vZGUuanMgdjYgc3VwcG9ydCBpcyBkcm9wcGVkLlxuICBjb25zdCB2YWx1ZXMgPSBPYmplY3Qua2V5cyhzZWxlY3RvcikubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gc2VsZWN0b3Jba2V5XTtcbiAgfSk7XG4gIHJldHVybiB2YWx1ZXMuc29tZShmdW5jdGlvbiAodmFsKSB7IFxuICAgIHJldHVybiB0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiBPYmplY3Qua2V5cyh2YWwpLmxlbmd0aCA9PT0gMDtcbn0pO1xufVxuXG5mdW5jdGlvbiBnZXREZWZhdWx0UXVlcnlQbGFuKHNlbGVjdG9yKSB7XG4gIC8vdXNpbmcgZGVmYXVsdCBpbmRleCwgc28gYWxsIGZpZWxkcyBuZWVkIHRvIGJlIGRvbmUgaW4gbWVtb3J5XG4gIHJldHVybiB7XG4gICAgcXVlcnlPcHRzOiB7c3RhcnRrZXk6IG51bGx9LFxuICAgIGluTWVtb3J5RmllbGRzOiBbT2JqZWN0LmtleXMoc2VsZWN0b3IpXVxuICB9O1xufVxuXG5mdW5jdGlvbiBnZXRDb3JlUXVlcnlQbGFuKHNlbGVjdG9yLCBpbmRleCkge1xuICBpZiAoaW5kZXguZGVmYXVsdFVzZWQpIHtcbiAgICByZXR1cm4gZ2V0RGVmYXVsdFF1ZXJ5UGxhbihzZWxlY3RvciwgaW5kZXgpO1xuICB9XG5cbiAgaWYgKGluZGV4LmRlZi5maWVsZHMubGVuZ3RoID09PSAxKSB7XG4gICAgLy8gb25lIGZpZWxkIGluIGluZGV4LCBzbyB0aGUgdmFsdWUgd2FzIGluZGV4ZWQgYXMgYSBzaW5nbGV0b25cbiAgICByZXR1cm4gZ2V0U2luZ2xlRmllbGRDb3JlUXVlcnlQbGFuKHNlbGVjdG9yLCBpbmRleCk7XG4gIH1cbiAgLy8gZWxzZSBpbmRleCBoYXMgbXVsdGlwbGUgZmllbGRzLCBzbyB0aGUgdmFsdWUgd2FzIGluZGV4ZWQgYXMgYW4gYXJyYXlcbiAgcmV0dXJuIGdldE11bHRpRmllbGRRdWVyeU9wdHMoc2VsZWN0b3IsIGluZGV4KTtcbn1cblxuZnVuY3Rpb24gcGxhblF1ZXJ5KHJlcXVlc3QsIGluZGV4ZXMpIHtcblxuICB2YXIgc2VsZWN0b3IgPSByZXF1ZXN0LnNlbGVjdG9yO1xuICB2YXIgc29ydCA9IHJlcXVlc3Quc29ydDtcblxuICBpZiAoc2hvdWxkU2hvcnRDaXJjdWl0KHNlbGVjdG9yKSkge1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBTSE9SVF9DSVJDVUlUX1FVRVJZLCB7IGluZGV4OiBpbmRleGVzWzBdIH0pO1xuICB9XG5cbiAgdmFyIHVzZXJGaWVsZHNSZXMgPSBnZXRVc2VyRmllbGRzKHNlbGVjdG9yLCBzb3J0KTtcblxuICB2YXIgdXNlckZpZWxkcyA9IHVzZXJGaWVsZHNSZXMuZmllbGRzO1xuICB2YXIgc29ydE9yZGVyID0gdXNlckZpZWxkc1Jlcy5zb3J0T3JkZXI7XG4gIHZhciBpbmRleCA9IGZpbmRCZXN0TWF0Y2hpbmdJbmRleChzZWxlY3RvciwgdXNlckZpZWxkcywgc29ydE9yZGVyLCBpbmRleGVzLCByZXF1ZXN0LnVzZV9pbmRleCk7XG5cbiAgdmFyIGNvcmVRdWVyeVBsYW4gPSBnZXRDb3JlUXVlcnlQbGFuKHNlbGVjdG9yLCBpbmRleCk7XG4gIHZhciBxdWVyeU9wdHMgPSBjb3JlUXVlcnlQbGFuLnF1ZXJ5T3B0cztcbiAgdmFyIGNvcmVJbk1lbW9yeUZpZWxkcyA9IGNvcmVRdWVyeVBsYW4uaW5NZW1vcnlGaWVsZHM7XG5cbiAgdmFyIGluTWVtb3J5RmllbGRzID0gZ2V0SW5NZW1vcnlGaWVsZHMoY29yZUluTWVtb3J5RmllbGRzLCBpbmRleCwgc2VsZWN0b3IsIHVzZXJGaWVsZHMpO1xuXG4gIHZhciByZXMgPSB7XG4gICAgcXVlcnlPcHRzOiBxdWVyeU9wdHMsXG4gICAgaW5kZXg6IGluZGV4LFxuICAgIGluTWVtb3J5RmllbGRzOiBpbk1lbW9yeUZpZWxkc1xuICB9O1xuICByZXR1cm4gcmVzO1xufVxuXG5leHBvcnQgZGVmYXVsdCBwbGFuUXVlcnk7XG4iLCJpbXBvcnQge2Nsb25lfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcbmltcG9ydCBnZXRJbmRleGVzIGZyb20gJy4uL2dldC1pbmRleGVzJztcbmltcG9ydCB7Y29sbGF0ZX0gZnJvbSAncG91Y2hkYi1jb2xsYXRlJztcbmltcG9ydCBhYnN0cmFjdE1hcHBlciBmcm9tICcuLi9hYnN0cmFjdC1tYXBwZXInO1xuaW1wb3J0IHBsYW5RdWVyeSBmcm9tICcuL3F1ZXJ5LXBsYW5uZXInO1xuaW1wb3J0IHtcbiAgbWFzc2FnZVNlbGVjdG9yLFxuICBnZXRWYWx1ZSxcbiAgZmlsdGVySW5NZW1vcnlGaWVsZHNcbn0gZnJvbSAncG91Y2hkYi1zZWxlY3Rvci1jb3JlJztcbmltcG9ydCB7XG4gIG1hc3NhZ2VTb3J0LFxuICB2YWxpZGF0ZUZpbmRSZXF1ZXN0LFxuICB2YWxpZGF0ZVNvcnQsXG4gIHJldmVyc2VPcHRpb25zLFxuICBmaWx0ZXJJbmNsdXNpdmVTdGFydCxcbiAgbWFzc2FnZVVzZUluZGV4XG59IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7cGlja30gZnJvbSAnLi4vLi4vLi4vdXRpbHMnO1xuaW1wb3J0IHZhbGlkYXRlU2VsZWN0b3IgZnJvbSAnLi4vLi4vLi4vdmFsaWRhdGVTZWxlY3Rvcic7XG5cbmZ1bmN0aW9uIGluZGV4VG9TaWduYXR1cmUoaW5kZXgpIHtcbiAgLy8gcmVtb3ZlICdfZGVzaWduLydcbiAgcmV0dXJuIGluZGV4LmRkb2Muc3Vic3RyaW5nKDgpICsgJy8nICsgaW5kZXgubmFtZTtcbn1cblxuZnVuY3Rpb24gZG9BbGxEb2NzKGRiLCBvcmlnaW5hbE9wdHMpIHtcbiAgdmFyIG9wdHMgPSBjbG9uZShvcmlnaW5hbE9wdHMpO1xuXG4gIC8vIENvdWNoREIgcmVzcG9uZHMgaW4gd2VpcmQgd2F5cyB3aGVuIHlvdSBwcm92aWRlIGEgbm9uLXN0cmluZyB0byBfaWQ7XG4gIC8vIHdlIG1pbWljIHRoZSBiZWhhdmlvciBmb3IgY29uc2lzdGVuY3kuIFNlZSBpc3N1ZTY2IHRlc3RzIGZvciBkZXRhaWxzLlxuICBpZiAob3B0cy5kZXNjZW5kaW5nKSB7XG4gICAgaWYgKCdlbmRrZXknIGluIG9wdHMgJiYgdHlwZW9mIG9wdHMuZW5ka2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgb3B0cy5lbmRrZXkgPSAnJztcbiAgICB9XG4gICAgaWYgKCdzdGFydGtleScgaW4gb3B0cyAmJiB0eXBlb2Ygb3B0cy5zdGFydGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIG9wdHMubGltaXQgPSAwO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBpZiAoJ3N0YXJ0a2V5JyBpbiBvcHRzICYmIHR5cGVvZiBvcHRzLnN0YXJ0a2V5ICE9PSAnc3RyaW5nJykge1xuICAgICAgb3B0cy5zdGFydGtleSA9ICcnO1xuICAgIH1cbiAgICBpZiAoJ2VuZGtleScgaW4gb3B0cyAmJiB0eXBlb2Ygb3B0cy5lbmRrZXkgIT09ICdzdHJpbmcnKSB7XG4gICAgICBvcHRzLmxpbWl0ID0gMDtcbiAgICB9XG4gIH1cbiAgaWYgKCdrZXknIGluIG9wdHMgJiYgdHlwZW9mIG9wdHMua2V5ICE9PSAnc3RyaW5nJykge1xuICAgIG9wdHMubGltaXQgPSAwO1xuICB9XG5cbiAgaWYgKG9wdHMubGltaXQgPiAwICYmIG9wdHMuaW5kZXhlc19jb3VudCkge1xuICAgIC8vIGJydXRlIGZvcmNlIGFuZCBxdWl0ZSBuYWl2ZSBpbXBsLlxuICAgIC8vIGFtcCB1cCB0aGUgbGltaXQgd2l0aCB0aGUgYW1vdW50IG9mIChpbmRleGVzKSBkZXNpZ24gZG9jc1xuICAgIC8vIG9yIGlzIHRoaXMgdG9vIG5haXZlPyBIb3cgYWJvdXQgc2tpcD9cbiAgICBvcHRzLm9yaWdpbmFsX2xpbWl0ID0gb3B0cy5saW1pdDtcbiAgICBvcHRzLmxpbWl0ICs9IG9wdHMuaW5kZXhlc19jb3VudDtcbiAgfVxuXG4gIHJldHVybiBkYi5hbGxEb2NzKG9wdHMpXG4gICAgLnRoZW4oZnVuY3Rpb24gKHJlcykge1xuICAgICAgLy8gZmlsdGVyIG91dCBhbnkgZGVzaWduIGRvY3MgdGhhdCBfYWxsX2RvY3MgbWlnaHQgcmV0dXJuXG4gICAgICByZXMucm93cyA9IHJlcy5yb3dzLmZpbHRlcihmdW5jdGlvbiAocm93KSB7XG4gICAgICAgIHJldHVybiAhL15fZGVzaWduXFwvLy50ZXN0KHJvdy5pZCk7XG4gICAgICB9KTtcbiAgICAgIC8vIHB1dCBiYWNrIG9yaWdpbmFsIGxpbWl0XG4gICAgICBpZiAob3B0cy5vcmlnaW5hbF9saW1pdCkge1xuICAgICAgICBvcHRzLmxpbWl0ID0gb3B0cy5vcmlnaW5hbF9saW1pdDtcbiAgICAgIH1cbiAgICAgIC8vIGVuZm9yY2UgdGhlIHJvd3MgdG8gcmVzcGVjdCB0aGUgZ2l2ZW4gbGltaXRcbiAgICAgIHJlcy5yb3dzID0gcmVzLnJvd3Muc2xpY2UoMCwgb3B0cy5saW1pdCk7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBmaW5kKGRiLCByZXF1ZXN0RGVmLCBleHBsYWluKSB7XG4gIGlmIChyZXF1ZXN0RGVmLnNlbGVjdG9yKSB7XG4gICAgLy8gbXVzdCBiZSB2YWxpZGF0ZWQgYmVmb3JlIG1hc3NhZ2luZ1xuICAgIHZhbGlkYXRlU2VsZWN0b3IocmVxdWVzdERlZi5zZWxlY3RvciwgZmFsc2UpO1xuICAgIHJlcXVlc3REZWYuc2VsZWN0b3IgPSBtYXNzYWdlU2VsZWN0b3IocmVxdWVzdERlZi5zZWxlY3Rvcik7XG4gIH1cblxuICBpZiAocmVxdWVzdERlZi5zb3J0KSB7XG4gICAgcmVxdWVzdERlZi5zb3J0ID0gbWFzc2FnZVNvcnQocmVxdWVzdERlZi5zb3J0KTtcbiAgfVxuXG4gIGlmIChyZXF1ZXN0RGVmLnVzZV9pbmRleCkge1xuICAgIHJlcXVlc3REZWYudXNlX2luZGV4ID0gbWFzc2FnZVVzZUluZGV4KHJlcXVlc3REZWYudXNlX2luZGV4KTtcbiAgfVxuXG4gIHZhbGlkYXRlRmluZFJlcXVlc3QocmVxdWVzdERlZik7XG5cbiAgcmV0dXJuIGdldEluZGV4ZXMoZGIpLnRoZW4oZnVuY3Rpb24gKGdldEluZGV4ZXNSZXMpIHtcblxuICAgIGRiLmNvbnN0cnVjdG9yLmVtaXQoJ2RlYnVnJywgWydmaW5kJywgJ3BsYW5uaW5nIHF1ZXJ5JywgcmVxdWVzdERlZl0pO1xuICAgIHZhciBxdWVyeVBsYW4gPSBwbGFuUXVlcnkocmVxdWVzdERlZiwgZ2V0SW5kZXhlc1Jlcy5pbmRleGVzKTtcbiAgICBkYi5jb25zdHJ1Y3Rvci5lbWl0KCdkZWJ1ZycsIFsnZmluZCcsICdxdWVyeSBwbGFuJywgcXVlcnlQbGFuXSk7XG5cbiAgICB2YXIgaW5kZXhUb1VzZSA9IHF1ZXJ5UGxhbi5pbmRleDtcblxuICAgIHZhbGlkYXRlU29ydChyZXF1ZXN0RGVmLCBpbmRleFRvVXNlKTtcblxuICAgIHZhciBvcHRzID0gT2JqZWN0LmFzc2lnbih7XG4gICAgICBpbmNsdWRlX2RvY3M6IHRydWUsXG4gICAgICByZWR1Y2U6IGZhbHNlLFxuICAgICAgLy8gQWRkIGFtb3VudCBvZiBpbmRleCBmb3IgZG9BbGxEb2NzIHRvIHVzZSAocmVsYXRlZCB0byBpc3N1ZSAjNzgxMClcbiAgICAgIGluZGV4ZXNfY291bnQ6IGdldEluZGV4ZXNSZXMudG90YWxfcm93cyxcbiAgICB9LCBxdWVyeVBsYW4ucXVlcnlPcHRzKTtcblxuICAgIGlmICgnc3RhcnRrZXknIGluIG9wdHMgJiYgJ2VuZGtleScgaW4gb3B0cyAmJlxuICAgICAgICBjb2xsYXRlKG9wdHMuc3RhcnRrZXksIG9wdHMuZW5ka2V5KSA+IDApIHtcbiAgICAgIC8vIGNhbid0IHBvc3NpYmx5IHJldHVybiBhbnkgcmVzdWx0cywgc3RhcnRrZXkgPiBlbmRrZXlcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBuZXh0ICovXG4gICAgICByZXR1cm4ge2RvY3M6IFtdfTtcbiAgICB9XG5cbiAgICB2YXIgaXNEZXNjZW5kaW5nID0gcmVxdWVzdERlZi5zb3J0ICYmXG4gICAgICB0eXBlb2YgcmVxdWVzdERlZi5zb3J0WzBdICE9PSAnc3RyaW5nJyAmJlxuICAgICAgZ2V0VmFsdWUocmVxdWVzdERlZi5zb3J0WzBdKSA9PT0gJ2Rlc2MnO1xuXG4gICAgaWYgKGlzRGVzY2VuZGluZykge1xuICAgICAgLy8gZWl0aGVyIGFsbCBkZXNjZW5kaW5nIG9yIGFsbCBhc2NlbmRpbmdcbiAgICAgIG9wdHMuZGVzY2VuZGluZyA9IHRydWU7XG4gICAgICBvcHRzID0gcmV2ZXJzZU9wdGlvbnMob3B0cyk7XG4gICAgfVxuXG4gICAgaWYgKCFxdWVyeVBsYW4uaW5NZW1vcnlGaWVsZHMubGVuZ3RoKSB7XG4gICAgICAvLyBubyBpbi1tZW1vcnkgZmlsdGVyaW5nIG5lY2Vzc2FyeSwgc28gd2UgY2FuIGxldCB0aGVcbiAgICAgIC8vIGRhdGFiYXNlIGRvIHRoZSBsaW1pdC9za2lwIGZvciB1c1xuICAgICAgaWYgKCdsaW1pdCcgaW4gcmVxdWVzdERlZikge1xuICAgICAgICBvcHRzLmxpbWl0ID0gcmVxdWVzdERlZi5saW1pdDtcbiAgICAgIH1cbiAgICAgIGlmICgnc2tpcCcgaW4gcmVxdWVzdERlZikge1xuICAgICAgICBvcHRzLnNraXAgPSByZXF1ZXN0RGVmLnNraXA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGV4cGxhaW4pIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocXVlcnlQbGFuLCBvcHRzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoaW5kZXhUb1VzZS5uYW1lID09PSAnX2FsbF9kb2NzJykge1xuICAgICAgICByZXR1cm4gZG9BbGxEb2NzKGRiLCBvcHRzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBzaWduYXR1cmUgPSBpbmRleFRvU2lnbmF0dXJlKGluZGV4VG9Vc2UpO1xuICAgICAgICByZXR1cm4gYWJzdHJhY3RNYXBwZXIoZGIpLnF1ZXJ5LmNhbGwoZGIsIHNpZ25hdHVyZSwgb3B0cyk7XG4gICAgICB9XG4gICAgfSkudGhlbihmdW5jdGlvbiAocmVzKSB7XG4gICAgICBpZiAob3B0cy5pbmNsdXNpdmVfc3RhcnQgPT09IGZhbHNlKSB7XG4gICAgICAgIC8vIG1heSBoYXZlIHRvIG1hbnVhbGx5IGZpbHRlciB0aGUgZmlyc3Qgb25lLFxuICAgICAgICAvLyBzaW5jZSBjb3VjaGRiIGhhcyBubyB0cnVlIGluY2x1c2l2ZV9zdGFydCBvcHRpb25cbiAgICAgICAgcmVzLnJvd3MgPSBmaWx0ZXJJbmNsdXNpdmVTdGFydChyZXMucm93cywgb3B0cy5zdGFydGtleSwgaW5kZXhUb1VzZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChxdWVyeVBsYW4uaW5NZW1vcnlGaWVsZHMubGVuZ3RoKSB7XG4gICAgICAgIC8vIG5lZWQgdG8gZmlsdGVyIHNvbWUgc3R1ZmYgaW4tbWVtb3J5XG4gICAgICAgIHJlcy5yb3dzID0gZmlsdGVySW5NZW1vcnlGaWVsZHMocmVzLnJvd3MsIHJlcXVlc3REZWYsIHF1ZXJ5UGxhbi5pbk1lbW9yeUZpZWxkcyk7XG4gICAgICB9XG5cbiAgICAgIHZhciByZXNwID0ge1xuICAgICAgICBkb2NzOiByZXMucm93cy5tYXAoZnVuY3Rpb24gKHJvdykge1xuICAgICAgICAgIHZhciBkb2MgPSByb3cuZG9jO1xuICAgICAgICAgIGlmIChyZXF1ZXN0RGVmLmZpZWxkcykge1xuICAgICAgICAgICAgcmV0dXJuIHBpY2soZG9jLCByZXF1ZXN0RGVmLmZpZWxkcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBkb2M7XG4gICAgICAgIH0pXG4gICAgICB9O1xuXG4gICAgICBpZiAoaW5kZXhUb1VzZS5kZWZhdWx0VXNlZCkge1xuICAgICAgICByZXNwLndhcm5pbmcgPSAnTm8gbWF0Y2hpbmcgaW5kZXggZm91bmQsIGNyZWF0ZSBhbiBpbmRleCB0byBvcHRpbWl6ZSBxdWVyeSB0aW1lLic7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXNwO1xuICAgIH0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZXhwbGFpbihkYiwgcmVxdWVzdERlZikge1xuICByZXR1cm4gZmluZChkYiwgcmVxdWVzdERlZiwgdHJ1ZSlcbiAgLnRoZW4oZnVuY3Rpb24gKHF1ZXJ5UGxhbikge1xuICAgIHJldHVybiB7XG4gICAgICBkYm5hbWU6IGRiLm5hbWUsXG4gICAgICBpbmRleDogcXVlcnlQbGFuLmluZGV4LFxuICAgICAgc2VsZWN0b3I6IHJlcXVlc3REZWYuc2VsZWN0b3IsXG4gICAgICByYW5nZToge1xuICAgICAgICBzdGFydF9rZXk6IHF1ZXJ5UGxhbi5xdWVyeU9wdHMuc3RhcnRrZXksXG4gICAgICAgIGVuZF9rZXk6IHF1ZXJ5UGxhbi5xdWVyeU9wdHMuZW5ka2V5LFxuICAgICAgfSxcbiAgICAgIG9wdHM6IHtcbiAgICAgICAgdXNlX2luZGV4OiByZXF1ZXN0RGVmLnVzZV9pbmRleCB8fCBbXSxcbiAgICAgICAgYm9va21hcms6IFwibmlsXCIsIC8vaGFyZGNvZGVkIHRvIG1hdGNoIENvdWNoREIgc2luY2UgaXRzIG5vdCBzdXBwb3J0ZWQsXG4gICAgICAgIGxpbWl0OiByZXF1ZXN0RGVmLmxpbWl0LFxuICAgICAgICBza2lwOiByZXF1ZXN0RGVmLnNraXAsXG4gICAgICAgIHNvcnQ6IHJlcXVlc3REZWYuc29ydCB8fCB7fSxcbiAgICAgICAgZmllbGRzOiByZXF1ZXN0RGVmLmZpZWxkcyxcbiAgICAgICAgY29uZmxpY3RzOiBmYWxzZSwgLy9oYXJkY29kZWQgdG8gbWF0Y2ggQ291Y2hEQiBzaW5jZSBpdHMgbm90IHN1cHBvcnRlZCxcbiAgICAgICAgcjogWzQ5XSwgLy8gaGFyZGNvZGVkIHRvIG1hdGNoIENvdWNoREIgc2luY2UgaXRzIG5vdCBzdXBwb3J0XG4gICAgICB9LFxuICAgICAgbGltaXQ6IHJlcXVlc3REZWYubGltaXQsXG4gICAgICBza2lwOiByZXF1ZXN0RGVmLnNraXAgfHwgMCxcbiAgICAgIGZpZWxkczogcmVxdWVzdERlZi5maWVsZHMsXG4gICAgfTtcbiAgfSk7XG59XG5cbmV4cG9ydCB7IGZpbmQsIGV4cGxhaW4gfTtcbiIsImltcG9ydCBhYnN0cmFjdE1hcHBlciBmcm9tICcuLi9hYnN0cmFjdC1tYXBwZXInO1xuaW1wb3J0IHsgdXBzZXJ0IH0gZnJvbSAncG91Y2hkYi11dGlscyc7XG5cbmZ1bmN0aW9uIGRlbGV0ZUluZGV4KGRiLCBpbmRleCkge1xuXG4gIGlmICghaW5kZXguZGRvYykge1xuICAgIHRocm93IG5ldyBFcnJvcigneW91IG11c3Qgc3VwcGx5IGFuIGluZGV4LmRkb2Mgd2hlbiBkZWxldGluZycpO1xuICB9XG5cbiAgaWYgKCFpbmRleC5uYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd5b3UgbXVzdCBzdXBwbHkgYW4gaW5kZXgubmFtZSB3aGVuIGRlbGV0aW5nJyk7XG4gIH1cblxuICB2YXIgZG9jSWQgPSBpbmRleC5kZG9jO1xuICB2YXIgdmlld05hbWUgPSBpbmRleC5uYW1lO1xuXG4gIGZ1bmN0aW9uIGRlbHRhRnVuKGRvYykge1xuICAgIGlmIChPYmplY3Qua2V5cyhkb2Mudmlld3MpLmxlbmd0aCA9PT0gMSAmJiBkb2Mudmlld3Nbdmlld05hbWVdKSB7XG4gICAgICAvLyBvbmx5IG9uZSB2aWV3IGluIHRoaXMgZGRvYywgZGVsZXRlIHRoZSB3aG9sZSBkZG9jXG4gICAgICByZXR1cm4ge19pZDogZG9jSWQsIF9kZWxldGVkOiB0cnVlfTtcbiAgICB9XG4gICAgLy8gbW9yZSB0aGFuIG9uZSB2aWV3IGhlcmUsIGp1c3QgcmVtb3ZlIHRoZSB2aWV3XG4gICAgZGVsZXRlIGRvYy52aWV3c1t2aWV3TmFtZV07XG4gICAgcmV0dXJuIGRvYztcbiAgfVxuXG4gIHJldHVybiB1cHNlcnQoZGIsIGRvY0lkLCBkZWx0YUZ1bikudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGFic3RyYWN0TWFwcGVyKGRiKS52aWV3Q2xlYW51cC5hcHBseShkYik7XG4gIH0pLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7b2s6IHRydWV9O1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVsZXRlSW5kZXg7XG4iLCJpbXBvcnQgeyBjYWxsYmFja2lmeSB9IGZyb20gJy4uLy4uL3V0aWxzJztcbmltcG9ydCBjcmVhdGVJbmRleCBmcm9tICcuL2NyZWF0ZS1pbmRleCc7XG5pbXBvcnQge2ZpbmQsICBleHBsYWluIH0gZnJvbSAnLi9maW5kJztcbmltcG9ydCBnZXRJbmRleGVzIGZyb20gJy4vZ2V0LWluZGV4ZXMnO1xuaW1wb3J0IGRlbGV0ZUluZGV4IGZyb20gJy4vZGVsZXRlLWluZGV4JztcblxudmFyIGNyZWF0ZUluZGV4QXNDYWxsYmFjayA9IGNhbGxiYWNraWZ5KGNyZWF0ZUluZGV4KTtcbnZhciBmaW5kQXNDYWxsYmFjayA9IGNhbGxiYWNraWZ5KGZpbmQpO1xudmFyIGV4cGxhaW5Bc0NhbGxiYWNrID0gY2FsbGJhY2tpZnkoZXhwbGFpbik7XG52YXIgZ2V0SW5kZXhlc0FzQ2FsbGJhY2sgPSBjYWxsYmFja2lmeShnZXRJbmRleGVzKTtcbnZhciBkZWxldGVJbmRleEFzQ2FsbGJhY2sgPSBjYWxsYmFja2lmeShkZWxldGVJbmRleCk7XG5cbmV4cG9ydCB7XG4gIGNyZWF0ZUluZGV4QXNDYWxsYmFjayBhcyBjcmVhdGVJbmRleCxcbiAgZmluZEFzQ2FsbGJhY2sgYXMgZmluZCxcbiAgZ2V0SW5kZXhlc0FzQ2FsbGJhY2sgYXMgZ2V0SW5kZXhlcyxcbiAgZGVsZXRlSW5kZXhBc0NhbGxiYWNrIGFzIGRlbGV0ZUluZGV4LFxuICBleHBsYWluQXNDYWxsYmFjayBhcyBleHBsYWluXG59O1xuIiwiaW1wb3J0IHsgdG9Qcm9taXNlLCBpc1JlbW90ZSB9IGZyb20gJ3BvdWNoZGItdXRpbHMnO1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICcuL2FkYXB0ZXJzL2h0dHAvaW5kZXgnO1xuaW1wb3J0ICogYXMgbG9jYWwgZnJvbSAnLi9hZGFwdGVycy9sb2NhbC9pbmRleCc7XG5cbnZhciBwbHVnaW4gPSB7fTtcbnBsdWdpbi5jcmVhdGVJbmRleCA9IHRvUHJvbWlzZShmdW5jdGlvbiAocmVxdWVzdERlZiwgY2FsbGJhY2spIHtcblxuICBpZiAodHlwZW9mIHJlcXVlc3REZWYgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcigneW91IG11c3QgcHJvdmlkZSBhbiBpbmRleCB0byBjcmVhdGUnKSk7XG4gIH1cblxuICB2YXIgY3JlYXRlSW5kZXggPSBpc1JlbW90ZSh0aGlzKSA/XG4gICAgaHR0cC5jcmVhdGVJbmRleCA6IGxvY2FsLmNyZWF0ZUluZGV4O1xuICBjcmVhdGVJbmRleCh0aGlzLCByZXF1ZXN0RGVmLCBjYWxsYmFjayk7XG59KTtcblxucGx1Z2luLmZpbmQgPSB0b1Byb21pc2UoZnVuY3Rpb24gKHJlcXVlc3REZWYsIGNhbGxiYWNrKSB7XG5cbiAgaWYgKHR5cGVvZiBjYWxsYmFjayA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBjYWxsYmFjayA9IHJlcXVlc3REZWY7XG4gICAgcmVxdWVzdERlZiA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmICh0eXBlb2YgcmVxdWVzdERlZiAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4gY2FsbGJhY2sobmV3IEVycm9yKCd5b3UgbXVzdCBwcm92aWRlIHNlYXJjaCBwYXJhbWV0ZXJzIHRvIGZpbmQoKScpKTtcbiAgfVxuXG4gIHZhciBmaW5kID0gaXNSZW1vdGUodGhpcykgPyBodHRwLmZpbmQgOiBsb2NhbC5maW5kO1xuICBmaW5kKHRoaXMsIHJlcXVlc3REZWYsIGNhbGxiYWNrKTtcbn0pO1xuXG5wbHVnaW4uZXhwbGFpbiA9IHRvUHJvbWlzZShmdW5jdGlvbiAocmVxdWVzdERlZiwgY2FsbGJhY2spIHtcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAndW5kZWZpbmVkJykge1xuICAgIGNhbGxiYWNrID0gcmVxdWVzdERlZjtcbiAgICByZXF1ZXN0RGVmID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYgKHR5cGVvZiByZXF1ZXN0RGVmICE9PSAnb2JqZWN0Jykge1xuICAgIHJldHVybiBjYWxsYmFjayhuZXcgRXJyb3IoJ3lvdSBtdXN0IHByb3ZpZGUgc2VhcmNoIHBhcmFtZXRlcnMgdG8gZXhwbGFpbigpJykpO1xuICB9XG5cbiAgdmFyIGZpbmQgPSBpc1JlbW90ZSh0aGlzKSA/IGh0dHAuZXhwbGFpbiA6IGxvY2FsLmV4cGxhaW47XG4gIGZpbmQodGhpcywgcmVxdWVzdERlZiwgY2FsbGJhY2spO1xufSk7XG5cbnBsdWdpbi5nZXRJbmRleGVzID0gdG9Qcm9taXNlKGZ1bmN0aW9uIChjYWxsYmFjaykge1xuXG4gIHZhciBnZXRJbmRleGVzID0gaXNSZW1vdGUodGhpcykgPyBodHRwLmdldEluZGV4ZXMgOiBsb2NhbC5nZXRJbmRleGVzO1xuICBnZXRJbmRleGVzKHRoaXMsIGNhbGxiYWNrKTtcbn0pO1xuXG5wbHVnaW4uZGVsZXRlSW5kZXggPSB0b1Byb21pc2UoZnVuY3Rpb24gKGluZGV4RGVmLCBjYWxsYmFjaykge1xuXG4gIGlmICh0eXBlb2YgaW5kZXhEZWYgIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKG5ldyBFcnJvcigneW91IG11c3QgcHJvdmlkZSBhbiBpbmRleCB0byBkZWxldGUnKSk7XG4gIH1cblxuICB2YXIgZGVsZXRlSW5kZXggPSBpc1JlbW90ZSh0aGlzKSA/XG4gICAgaHR0cC5kZWxldGVJbmRleCA6IGxvY2FsLmRlbGV0ZUluZGV4O1xuICBkZWxldGVJbmRleCh0aGlzLCBpbmRleERlZiwgY2FsbGJhY2spO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IHBsdWdpbjtcbiJdLCJuYW1lcyI6WyJjcmVhdGVJbmRleCIsImZpbmQiLCJleHBsYWluIiwiZ2V0SW5kZXhlcyIsImRlbGV0ZUluZGV4IiwibmV4dFRpY2siLCJhYnN0cmFjdE1hcFJlZHVjZSIsImFic3RyYWN0TWFwcGVyIiwiaHR0cC5jcmVhdGVJbmRleCIsImxvY2FsLmNyZWF0ZUluZGV4IiwiaHR0cC5maW5kIiwibG9jYWwuZmluZCIsImh0dHAuZXhwbGFpbiIsImxvY2FsLmV4cGxhaW4iLCJodHRwLmdldEluZGV4ZXMiLCJsb2NhbC5nZXRJbmRleGVzIiwiaHR0cC5kZWxldGVJbmRleCIsImxvY2FsLmRlbGV0ZUluZGV4Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVMseUJBQXlCLENBQUMsVUFBVSxFQUFFO0FBQy9DLEVBQUUsVUFBVSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNqQztBQUNBLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEVBQUU7QUFDekIsSUFBSSxVQUFVLENBQUMsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUMxQixHQUFHO0FBQ0g7QUFDQSxFQUFFLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxHQUFHLEVBQUU7QUFDbEQsSUFBSSxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7QUFDL0IsTUFBTSxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM5QyxNQUFNLE9BQU8sVUFBVSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNuQyxLQUFLO0FBQ0wsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBLEVBQUUsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFO0FBQ3pCLElBQUksVUFBVSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQztBQUNoRCxJQUFJLE9BQU8sVUFBVSxDQUFDLE1BQU0sQ0FBQztBQUM3QixHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFO0FBQ3hCLElBQUksVUFBVSxDQUFDLElBQUksR0FBRyxNQUFNLENBQUM7QUFDN0Is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
