// Contained shim to create a Blob object, so it also works in older
// browsers that don't support the native Blob constructor (e.g.
// old QtWebKit versions, Android < 4.4). Is Deprecated.

export * from './blob.js';
