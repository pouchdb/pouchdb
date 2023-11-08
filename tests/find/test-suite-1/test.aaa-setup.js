if (typeof process === 'undefined' || process.browser) {
  window.context = {};
} else {
  global.context = {};
}

beforeEach(function () {
  this.timeout(60000);
  var dbName = testUtils.adapterUrl(testUtils.adapterType(), 'testdb');
  context.db = new PouchDB(dbName);
});

afterEach(function () {
  this.timeout(60000);
  return context.db.destroy();
});
