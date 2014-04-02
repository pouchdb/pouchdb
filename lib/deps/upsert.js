'use strict';
var Promise = require('../utils').Promise;

// this is essentially the "update sugar" function from daleharvey/pouchdb#1388
function upsert(db, docId, diffFun) {
  return new Promise(function (fullfil, reject) {
    if (docId && typeof docId === 'object') {
      docId = docId._id;
    }
    if (typeof docId !== 'string') {
      return reject(new Error('doc id is required'));
    }

    db.get(docId, function (err, doc) {
      if (err) {
        if (err.name !== 'not_found') {
          return reject(err);
        }
        return fullfil(tryAndPut(db, diffFun({_id : docId}), diffFun));
      }
      doc = diffFun(doc);
      fullfil(tryAndPut(db, doc, diffFun));
    });
  });
}

function tryAndPut(db, doc, diffFun) {
  return db.put(doc).then(null, function (err) {
    if (err.name !== 'conflict') {
      throw err;
    }
    return upsert(db, doc, diffFun);
  });
}

module.exports = function (db, docId, diffFun, cb) {
  if (typeof cb === 'function') {
    upsert(db, docId, diffFun).then(function (resp) {
      cb(null, resp);
    }, cb);
  } else {
    return upsert(db, docId, diffFun);
  }
};
