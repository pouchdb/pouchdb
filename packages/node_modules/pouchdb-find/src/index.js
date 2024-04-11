import { isRemote } from 'pouchdb-utils';
import { resolveToCallback } from './utils';
import * as http from './adapters/http/index';
import * as local from './adapters/local/index';

const plugin = {};
plugin.createIndex = resolveToCallback(async function (requestDef) {
  if (typeof requestDef !== 'object') {
    throw new Error('you must provide an index to create');
  }

  const createIndex = isRemote(this) ?
    http.createIndex : local.createIndex;
  return createIndex(this, requestDef);
});

plugin.find = resolveToCallback(async function (requestDef) {
  if (typeof requestDef !== 'object') {
    throw new Error('you must provide search parameters to find()');
  }

  const find = isRemote(this) ? http.find : local.find;
  return find(this, requestDef);
});

plugin.explain = resolveToCallback(async function (requestDef) {
  if (typeof requestDef !== 'object') {
    throw new Error('you must provide search parameters to explain()');
  }

  const find = isRemote(this) ? http.explain : local.explain;
  return find(this, requestDef);
});

plugin.getIndexes = resolveToCallback(async function () {
  const getIndexes = isRemote(this) ? http.getIndexes : local.getIndexes;
  return getIndexes(this);
});

plugin.deleteIndex = resolveToCallback(async function (indexDef) {
  if (typeof indexDef !== 'object') {
    throw new Error('you must provide an index to delete');
  }

  const deleteIndex = isRemote(this) ?
    http.deleteIndex : local.deleteIndex;
  return deleteIndex(this, indexDef);
});

export default plugin;
