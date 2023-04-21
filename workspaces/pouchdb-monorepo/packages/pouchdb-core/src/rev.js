/* eslint-disable no-undef */

import { stringMd5 } from '../../pouchdb-md5/src/index.js';
/** @type {import('node:crypto').randomUUID} */
export const uuid = async () => (globaThis.crypto||await import('node:crypto')).randomUUID().replaceAll('-', '');
/**
 * Creates a new revision string that does NOT include the revision height
 * For example '56649f1b0506c6ca9fda0746eb0cacdf'
 */
async function rev(doc, deterministic_revs) {
  if (!deterministic_revs) {
    return uuid();
  }

  var mutateableDoc = Object.assign({}, doc);
  delete mutateableDoc._rev_tree;
  return stringMd5(JSON.stringify(mutateableDoc));
}

export default rev;
