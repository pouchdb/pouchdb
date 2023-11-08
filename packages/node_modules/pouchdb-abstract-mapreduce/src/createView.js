import { upsert } from 'pouchdb-utils';
import { stringMd5 } from 'pouchdb-md5';
import createViewSignature from './createViewSignature';

async function createView(sourceDB, viewName, mapFun, reduceFun, temporary, localDocName) {
  const viewSignature = createViewSignature(mapFun, reduceFun);

  let cachedViews;
  if (!temporary) {
    // cache this to ensure we don't try to update the same view twice
    cachedViews = sourceDB._cachedViews = sourceDB._cachedViews || {};
    if (cachedViews[viewSignature]) {
      return cachedViews[viewSignature];
    }
  }

  const promiseForView = sourceDB.info().then(async function (info) {
    const depDbName = info.db_name + '-mrview-' +
    (temporary ? 'temp' : stringMd5(viewSignature));

    // save the view name in the source db so it can be cleaned up if necessary
    // (e.g. when the _design doc is deleted, remove all associated view data)
    function diffFunction(doc) {
      doc.views = doc.views || {};
      let fullViewName = viewName;
      if (fullViewName.indexOf('/') === -1) {
        fullViewName = viewName + '/' + viewName;
      }
      const depDbs = doc.views[fullViewName] = doc.views[fullViewName] || {};
      /* istanbul ignore if */
      if (depDbs[depDbName]) {
        return; // no update necessary
      }
      depDbs[depDbName] = true;
      return doc;
    }
    await upsert(sourceDB, '_local/' + localDocName, diffFunction);
    const res = await sourceDB.registerDependentDatabase(depDbName);
    const db = res.db;
    db.auto_compaction = true;
    const view = {
      name: depDbName,
      db,
      sourceDB,
      adapter: sourceDB.adapter,
      mapFun,
      reduceFun
    };

    let lastSeqDoc;
    try {
      lastSeqDoc = await view.db.get('_local/lastSeq');
    } catch (err) {
        /* istanbul ignore if */
      if (err.status !== 404) {
        throw err;
      }
    }

    view.seq = lastSeqDoc ? lastSeqDoc.seq : 0;
    if (cachedViews) {
      view.db.once('destroyed', function () {
        delete cachedViews[viewSignature];
      });
    }
    return view;
  });

  if (cachedViews) {
    cachedViews[viewSignature] = promiseForView;
  }
  return promiseForView;
}

export default createView;
