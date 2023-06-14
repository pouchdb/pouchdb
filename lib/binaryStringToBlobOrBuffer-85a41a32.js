import { t as typedBuffer } from './typedBuffer-a8220a49.js';

function thisAtob(str) {
  var base64 = Buffer.from(str, 'base64');
  // Node.js will just skip the characters it can't decode instead of
  // throwing an exception
  if (base64.toString('base64') !== str) {
    throw new Error("attachment is not a valid base64 string");
  }
  return base64.toString('binary');
}

function thisBtoa(str) {
  return Buffer.from(str, 'binary').toString('base64');
}

function binStringToBluffer(binString, type) {
  return typedBuffer(binString, 'binary', type);
}

export { thisAtob as a, binStringToBluffer as b, thisBtoa as t };
