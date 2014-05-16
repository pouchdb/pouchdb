'use strict';
// LevelAlt doesn't need the pre-2.2.0 LevelDB-specific migrations
module.exports = function (name, db, afterDBCreated) {
  process.nextTick(function () {
    afterDBCreated();
  });
};