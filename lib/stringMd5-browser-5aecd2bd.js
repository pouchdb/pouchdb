import { M as Md5 } from './spark-md5-2c57e5fc.js';

function stringMd5(string) {
  return Md5.hash(string);
}

export { stringMd5 as s };
