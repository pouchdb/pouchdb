import { callbackify } from '../../utils';
import createIndex from './create-index';
import {find,  explain } from './find';
import getIndexes from './get-indexes';
import deleteIndex from './delete-index';

var createIndexAsCallback = callbackify(createIndex);
var findAsCallback = callbackify(find);
var explainAsCallback = callbackify(explain);
var getIndexesAsCallback = callbackify(getIndexes);
var deleteIndexAsCallback = callbackify(deleteIndex);

export {
  createIndexAsCallback as createIndex,
  findAsCallback as find,
  getIndexesAsCallback as getIndexes,
  deleteIndexAsCallback as deleteIndex,
  explainAsCallback as explain
};
