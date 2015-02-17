'use strict';

var abstractMapper = require('../abstract-mapper');

function deleteIndex(db, index) {

  var docId = index.ddoc;

  return db.get(docId).then(function (doc) {
    return db.remove(doc);
  }).then(function () {
    return abstractMapper.viewCleanup.apply(db);
  }).then(function () {
    return {ok: true};
  });
}

module.exports = deleteIndex;