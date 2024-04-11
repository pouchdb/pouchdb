import abstractMapReduce from 'pouchdb-abstract-mapreduce';
import { matchesSelector, parseField } from 'pouchdb-selector-core';

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

function getDeepValue(value, path) {
  for (const key of path) {
    value = value[key];
    if (value === undefined) {
      return undefined;
    }
  }
  return value;
}

function createDeepMultiMapper(fields, emit, selector) {
  return function (doc) {
    if (selector && !matchesSelector(doc, selector)) { return; }

    const toEmit = [];
    for (const field of fields) {
      const value = getDeepValue(doc, parseField(field));
      if (value === undefined) {
        return;
      }
      toEmit.push(value);
    }
    emit(toEmit);
  };
}

function createDeepSingleMapper(field, emit, selector) {
  const parsedField = parseField(field);
  return function (doc) {
    if (selector && !matchesSelector(doc, selector)) { return; }

    const value = getDeepValue(doc, parsedField);
    if (value !== undefined) {
      emit(value);
    }
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
    const toEmit = fields.map(field => doc[field]);
    emit(toEmit);
  };
}

function checkShallow(fields) {
  return fields.every((field) => field.indexOf('.') === -1);
}

function createMapper(fields, emit, selector) {
  const isShallow = checkShallow(fields);
  const isSingle = fields.length === 1;

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
  const view = ddoc.views[viewName];
  // This doesn't actually need to be here apparently, but
  // I feel safer keeping it.
  /* istanbul ignore if */
  if (!view.map || !view.map.fields) {
    throw new Error('ddoc ' + ddoc._id + ' with view ' + viewName +
      ' doesn\'t have map.fields defined. ' +
      'maybe it wasn\'t created by this plugin?');
  }
}

const abstractMapper = abstractMapReduce(
  /* localDocName */ 'indexes',
  mapper,
  reducer,
  ddocValidator
);

export default function (db) {
  if (db._customFindAbstractMapper) {
    return {
      // Calls the _customFindAbstractMapper, but with a third argument:
      // the standard findAbstractMapper query/viewCleanup.
      // This allows the indexeddb adapter to support partial_filter_selector.
      query: function addQueryFallback(signature, opts) {
        const fallback = abstractMapper.query.bind(this);
        return db._customFindAbstractMapper.query.call(this, signature, opts, fallback);
      },
      viewCleanup: function addViewCleanupFallback() {
        const fallback = abstractMapper.viewCleanup.bind(this);
        return db._customFindAbstractMapper.viewCleanup.call(this, fallback);
      }
    };
  }
  return abstractMapper;
}
