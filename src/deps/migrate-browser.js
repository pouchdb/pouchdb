// in the browser, LevelAlt doesn't need the
// pre-2.2.0 LevelDB-specific migrations
var toSublevel = function (name, db, callback) {
  process.nextTick(function () {
    callback();
  });
};

var localAndMetaStores = function (db, stores, callback) {
  process.nextTick(function () {
    callback();
  });
};

export default {
  toSublevel: toSublevel,
  localAndMetaStores: localAndMetaStores
};
