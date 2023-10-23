import { blob as createBlob } from 'pouchdb-binary-utils';

//
// Blobs are not supported in all versions of IndexedDB, notably
// Chrome <37, Android <5 and (some?) webkit-based browsers.
// In those versions, storing a blob will throw.
//
// Example Webkit error:
// > DataCloneError: Failed to store record in an IDBObjectStore: BlobURLs are not yet supported.
//
// Various other blob bugs exist in Chrome v37-42 (inclusive).
// Detecting them is expensive and confusing to users, and Chrome 37-42
// is at very low usage worldwide, so we do a hacky userAgent check instead.
//
// content-type bug: https://code.google.com/p/chromium/issues/detail?id=408120
// 404 bug: https://code.google.com/p/chromium/issues/detail?id=447916
// FileReader bug: https://code.google.com/p/chromium/issues/detail?id=447836
//
function checkBlobSupport(txn, store, docIdOrCreateDoc) {
  return new Promise(function (resolve) {
    var blob = createBlob(['']);

    let req;
    if (typeof docIdOrCreateDoc === 'function') {
      // Store may require a specific key path, in which case we can't store the
      // blob directly in the store.
      const createDoc = docIdOrCreateDoc;
      const doc = createDoc(blob);
      req = txn.objectStore(store).put(doc);
    } else {
      const docId = docIdOrCreateDoc;
      req = txn.objectStore(store).put(blob, docId);
    }

    req.onsuccess = function () {
      var matchedChrome = navigator.userAgent.match(/Chrome\/(\d+)/);
      var matchedEdge = navigator.userAgent.match(/Edge\//);
      // MS Edge pretends to be Chrome 42:
      // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
      resolve(matchedEdge || !matchedChrome ||
        parseInt(matchedChrome[1], 10) >= 43);
    };

    req.onerror = txn.onabort = function (e) {
      // If the transaction aborts now its due to not being able to
      // write to the database, likely due to the disk being full
      e.preventDefault();
      e.stopPropagation();
      resolve(false);
    };
  }).catch(function () {
    return false; // error, so assume unsupported
  });
}

export default checkBlobSupport;
