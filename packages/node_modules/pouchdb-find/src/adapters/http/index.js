import { createError, generateErrorFromResponse } from 'pouchdb-errors';
import { Headers } from 'pouchdb-fetch';
import massageCreateIndexRequest from '../../massageCreateIndexRequest';
import validateSelector from '../../validateSelector';

async function dbFetch(db, path, opts) {
  if (opts.body) {
    opts.body = JSON.stringify(opts.body);
    opts.headers = new Headers({ 'Content-type': 'application/json' });
  }

  const response = await db.fetch(path, opts);
  const json = await response.json();
  if (!response.ok) {
    json.status = response.status;
    const pouchError = createError(json);
    throw generateErrorFromResponse(pouchError);
  }
  return json;
}

async function createIndex(db, requestDef) {
  return await dbFetch(db, '_index', {
    method: 'POST',
    body: massageCreateIndexRequest(requestDef)
  });
}

async function find(db, requestDef) {
  validateSelector(requestDef.selector, true);
  return await dbFetch(db, '_find', {
    method: 'POST',
    body: requestDef
  });
}

async function explain(db, requestDef) {
  return await dbFetch(db, '_explain', {
    method: 'POST',
    body: requestDef
  });
}

async function getIndexes(db) {
  return await dbFetch(db, '_index', {
    method: 'GET'
  });
}

async function deleteIndex(db, indexDef) {
  const ddoc = indexDef.ddoc;
  const type = indexDef.type || 'json';
  const name = indexDef.name;

  if (!ddoc) {
    throw new Error('you must provide an index\'s ddoc');
  }

  if (!name) {
    throw new Error('you must provide an index\'s name');
  }

  const url = '_index/' + [ddoc, type, name].map(encodeURIComponent).join('/');

  return await dbFetch(db, url, { method: 'DELETE' });
}

export {
  createIndex,
  find,
  getIndexes,
  deleteIndex,
  explain
};
