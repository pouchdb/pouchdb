'use strict';
// in the browser, LevelAlt doesn't need the
// pre-2.2.0 LevelDB-specific migrations
exports.toSublevel = function (name, db, callback) {
  process.nextTick(function () {
    callback();
  });
};

exports.localAndMetaStores = function (db, stores, callback) {
  process.nextTick(function () {
    callback();
  });
};