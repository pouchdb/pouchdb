import abstractMapper from '../abstract-mapper';
import { massageIndexDef, validateIndex } from '../utils';
import { clone, upsert } from 'pouchdb-utils';
import { stringMd5 } from 'pouchdb-md5';
import massageCreateIndexRequest from '../../../massageCreateIndexRequest';
import { mergeObjects } from '../../../utils';

async function createIndex(db, requestDef) {
  requestDef = massageCreateIndexRequest(requestDef);
  const originalIndexDef = clone(requestDef.index);
  requestDef.index = massageIndexDef(requestDef.index);

  validateIndex(requestDef.index);

  // calculating md5 is expensive - memoize and only
  // run if required
  let md5;
  function getMd5() {
    return md5 || (md5 = stringMd5(JSON.stringify(requestDef)));
  }

  const viewName = requestDef.name || ('idx-' + getMd5());

  const ddocName = requestDef.ddoc || ('idx-' + getMd5());
  const ddocId = '_design/' + ddocName;

  let hasInvalidLanguage = false;
  let viewExists = false;

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

  await upsert(db, ddocId, updateDdoc);

  if (hasInvalidLanguage) {
    throw new Error('invalid language for ddoc with id "' +
      ddocId +
      '" (should be "query")');
  }

  // kick off a build
  // TODO: abstract-pouchdb-mapreduce should support auto-updating
  // TODO: should also use update_after, but pouchdb/pouchdb#3415 blocks me
  const signature = ddocName + '/' + viewName;
  await abstractMapper(db).query.call(db, signature, {
    limit: 0,
    reduce: false
  });
  return {
    id: ddocId,
    name: viewName,
    result: viewExists ? 'exists' : 'created'
  };
}

export default createIndex;
