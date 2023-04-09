import { ChangesHandler } from '../../pouchdb-utils';

import setup from './setup';

// API implementations
import info from './info';
import get from './get';
import { getAttachment } from './getAttachment';
import bulkDocs from './bulkDocs';
import allDocs from './allDocs';
import changes from './changes';
import getRevisionTree from './getRevisionTree';
import doCompaction from './doCompaction';
import destroy from './destroy';
import {query, viewCleanup} from './find';
import purge from './purge';

import { DOC_STORE } from './util';

const ADAPTER_NAME = 'indexeddb';
const idbChanges = new ChangesHandler();

// A shared list of database handles
const openDatabases = {};

function IdbPouch(dbOpts, callback) {

  if (dbOpts.view_adapter) {
    console.log('Please note that the indexeddb adapter manages _find indexes itself, therefore it is not using your specified view_adapter');
  }
  
  const api = this;
  let metadata = {};

  // Wrapper that gives you an active DB handle. You probably want $t.
  const $ = fun => ((...args) => {
    setup(openDatabases, api, dbOpts).then(res => {
      metadata = res.metadata;
      args.unshift(res.idb);
      fun.apply(api, args);
    }).catch(err => {
      const last = args.pop();
      if (typeof last === 'function') {
        last(err);
      } else {
        console.error(err);
      }
    });
  });
  // the promise version of $ a handle
  const $p = fun => (...args) => {
    return setup(openDatabases, api, dbOpts).then(async res => {
      metadata = res.metadata;
      return (await fun).apply(api, [res.idb,...args]);
    });
  };
  // Wrapper that gives you a safe transaction handle. It's important to use
  // this instead of opening your own transaction from a db handle returned from $,
  // because in the time between getting the db handle and opening the
  // transaction it may have been invalidated by index changes.
  const $t = async (fun, stores, mode = 'readonly') => {
    return (...args) => {
      const txn = {};
      return setup(openDatabases, api, dbOpts).then(async (res) => {
        metadata = res.metadata;
        txn.txn = res.idb.transaction((await stores) || [DOC_STORE], mode);
      },(err) => {
        console.error('Failed to establish transaction safely');
        console.error(err);
        txn.error = err;
      }).then(async () => (await fun).apply(api, [txn,...args]));
    };
  };

  api._openTransactionSafely = (stores, mode, callback) => {
    $t((txn, callback) => {
      callback(txn.error, txn.txn);
    }, stores, mode)(callback);
  };

  api._remote = false;
  api.type = () => ADAPTER_NAME;

  api._id = $((_, cb) => {
    cb(null, metadata.db_uuid);
  });

  api._info = $((_, cb) => info(metadata, cb));

  api._get = $t(get);

  api._bulkDocs = $((_, req, opts, callback) => {
    bulkDocs(api, req, opts, metadata, dbOpts, idbChanges, callback);
  });

  api._allDocs = $t((txn, opts, cb) => {
    allDocs(txn, metadata, opts, cb);
  });

  api._getAttachment = $t(getAttachment);

  api._changes = $t(async (txn, opts) => 
    await changes(await txn, idbChanges, api, dbOpts, opts));
  

  api._getRevisionTree = $t(getRevisionTree);
  api._doCompaction = $t(doCompaction, [DOC_STORE], 'readwrite');

  api._customFindAbstractMapper = {
    query: $p(query),
    viewCleanup: $p(viewCleanup)
  };

  api._destroy = (opts, callback) => destroy(dbOpts, openDatabases, idbChanges, callback);

  api._close = $((db, cb) => {
    delete openDatabases[dbOpts.name];
    db.close();
    cb();
  });

  // Closing and re-opening the DB re-generates native indexes
  api._freshen = () => new Promise(resolve => {
    api._close(() => {
      $(resolve)();
    });
  });

  api._purge = $t(purge, [DOC_STORE], 'readwrite');

  // TODO: this setTimeout seems nasty, if its needed lets
  // figure out / explain why
  setTimeout(() => {
    callback(null, api);
  });
}

// TODO: this isnt really valid permanently, just being lazy to start
IdbPouch.valid = () => true;

export default function (PouchDB) {
  PouchDB.adapter(ADAPTER_NAME, IdbPouch, true);
}
