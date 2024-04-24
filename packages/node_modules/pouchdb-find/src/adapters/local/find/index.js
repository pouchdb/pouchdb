import { clone } from 'pouchdb-utils';
import getIndexes from '../get-indexes';
import { collate } from 'pouchdb-collate';
import abstractMapper from '../abstract-mapper';
import planQuery from './query-planner';
import {
  massageSelector,
  getValue,
  filterInMemoryFields
} from 'pouchdb-selector-core';
import {
  massageSort,
  validateFindRequest,
  validateSort,
  reverseOptions,
  filterInclusiveStart,
  massageUseIndex
} from '../utils';
import { pick } from '../../../utils';
import validateSelector from '../../../validateSelector';

function indexToSignature(index) {
  // remove '_design/'
  return index.ddoc.substring(8) + '/' + index.name;
}

async function doAllDocs(db, originalOpts) {
  const opts = clone(originalOpts);

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

  const res = await db.allDocs(opts);
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
}

async function queryAllOrIndex(db, opts, indexToUse) {
  if (indexToUse.name === '_all_docs') {
    return doAllDocs(db, opts);
  }
  return abstractMapper(db).query.call(db, indexToSignature(indexToUse), opts);
}

async function find(db, requestDef, explain) {
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

  if (!('limit' in requestDef)) {
    // Match the default limit of CouchDB
    requestDef.limit = 25;
  }

  validateFindRequest(requestDef);

  const getIndexesRes = await getIndexes(db);

  db.constructor.emit('debug', ['find', 'planning query', requestDef]);
  const queryPlan = planQuery(requestDef, getIndexesRes.indexes);
  db.constructor.emit('debug', ['find', 'query plan', queryPlan]);

  const indexToUse = queryPlan.index;

  validateSort(requestDef, indexToUse);

  let opts = Object.assign({
    include_docs: true,
    reduce: false,
    // Add amount of index for doAllDocs to use (related to issue #7810)
    indexes_count: getIndexesRes.total_rows,
  }, queryPlan.queryOpts);

  if ('startkey' in opts && 'endkey' in opts &&
    collate(opts.startkey, opts.endkey) > 0) {
    // can't possibly return any results, startkey > endkey
    /* istanbul ignore next */
    return { docs: [] };
  }

  const isDescending = requestDef.sort &&
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
    opts.limit = requestDef.limit;
    if ('skip' in requestDef) {
      opts.skip = requestDef.skip;
    }
  }

  if (explain) {
    return Promise.resolve(queryPlan, opts);
  }

  const res = await queryAllOrIndex(db, opts, indexToUse);


  if (opts.inclusive_start === false) {
    // may have to manually filter the first one,
    // since couchdb has no true inclusive_start option
    res.rows = filterInclusiveStart(res.rows, opts.startkey, indexToUse);
  }

  if (queryPlan.inMemoryFields.length) {
    // need to filter some stuff in-memory
    res.rows = filterInMemoryFields(res.rows, requestDef, queryPlan.inMemoryFields);
  }

  const resp = {
    docs: res.rows.map(function (row) {
      const doc = row.doc;
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
}

async function explain(db, requestDef) {
  const queryPlan = await find(db, requestDef, true);

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
}

export { find, explain };
