import crypto from 'crypto';
import { v as v4 } from './v4-b7ee9c0c.js';

function stringMd5(string) {
  return crypto.createHash('md5').update(string, 'binary').digest('hex');
}

/**
 * Creates a new revision string that does NOT include the revision height
 * For example '56649f1b0506c6ca9fda0746eb0cacdf'
 */
function rev(doc, deterministic_revs) {
  if (!deterministic_revs) {
    return v4().replace(/-/g, '').toLowerCase();
  }

  var mutateableDoc = Object.assign({}, doc);
  delete mutateableDoc._rev_tree;
  return stringMd5(JSON.stringify(mutateableDoc));
}

export { rev as r };
