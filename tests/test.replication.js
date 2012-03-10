// Just leaving the credentials in there, only ever used to test so worst
// someone can do is make tests fail
var remote = {
  host: 'pouchdb.iriscouch.com',
  user: 'pouch',
  pass: 'pouchdb'
};

module('replication', {
  setup : function () {
    stop();
    this.name = 'test' + Math.uuid();
    $.couch.urlPrefix = 'http://' + remote.host;
    this.remote = $.couch.db(this.name);
    this.remote.create({
      success: function() {
        start();
      }
    });
  }
});