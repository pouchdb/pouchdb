import buffer from './buffer';

function thisAtob(str) {
  var base64 = new buffer(str, 'base64');
  // Node.js will just skip the characters it can't decode instead of
  // throwing an exception
  if (base64.toString('base64') !== str) {
    throw new Error("attachment is not a valid base64 string");
  }
  return base64.toString('binary');
}

function thisBtoa(str) {
  return new buffer(str, 'binary').toString('base64');
}

export {
  thisAtob as atob,
  thisBtoa as btoa
};