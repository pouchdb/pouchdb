import abstractMapper from '../abstract-mapper';
import { upsert } from 'pouchdb-utils';

async function deleteIndex(db, index) {

  if (!index.ddoc) {
    throw new Error('you must supply an index.ddoc when deleting');
  }

  if (!index.name) {
    throw new Error('you must supply an index.name when deleting');
  }

  const docId = index.ddoc;
  const viewName = index.name;

  function deltaFun(doc) {
    if (Object.keys(doc.views).length === 1 && doc.views[viewName]) {
      // only one view in this ddoc, delete the whole ddoc
      return {_id: docId, _deleted: true};
    }
    // more than one view here, just remove the view
    delete doc.views[viewName];
    return doc;
  }

  await upsert(db, docId, deltaFun);
  await abstractMapper(db).viewCleanup.apply(db);
  return { ok: true };
}

export default deleteIndex;
