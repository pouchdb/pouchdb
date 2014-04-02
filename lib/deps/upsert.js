'use strict';

// this is essentially the "update sugar" function from daleharvey/pouchdb#1388
function upsert(db, docId, diffFun, cb) {
  if (docId && typeof docId === 'object') {
    docId = docId._id;
  }
  if (typeof docId !== 'string') {
    return cb(new Error('doc id is required'));
  }

  db.get(docId, function (err, doc) {
    if (err) {
      if (err.name !== 'not_found') {
        return cb(err);
      }
      return tryAndPut(db, diffFun({_id : docId}), diffFun, cb);
    }
    doc = diffFun(doc);
    tryAndPut(db, doc, diffFun, cb);
  });
}

function tryAndPut(db, doc, diffFun, cb) {
  db.put(doc, function (err) {
    if (err) {
      if (err.name !== 'conflict') {
        return cb(err);
      }
      return upsert(db, doc, diffFun, cb);
    }
    cb(null);
  });
}

module.exports = upsert;