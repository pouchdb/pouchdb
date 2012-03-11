// Just leaving the credentials in there, only ever used to test so worst
// someone can do is make tests fail

// Couch currently doesnt support CORS, which means replications need to
// happen from the server the idb database is served from
var remote = {
  host: 'pouchdb.iriscouch.com',
  user: 'pouch',
  pass: 'pouchdb'
};

module('replication', {
  setup : function () {
    var suffix = '';
    for (var i = 0 ; i < 10 ; i++ ) {
      suffix += (Math.random()*16).toFixed().toString(16);
    }
    this.name = 'test' + suffix;
  }
});

asyncTest("Test basic pull replication", function() {

  var name = this.name;
  var $db = $.couch.db(name);

  var docs = {
    docs: [
      {_id: "0", integer: 0, string: '0'},
      {_id: "1", integer: 1, string: '1'},
      {_id: "2", integer: 2, string: '2'}
    ]
  };

  var create = function() {
    $db.create({success: function() {
      $db.bulkSave(docs, {success: replicate});
    }});
  };

  var replicate = function(from) {
    pouch.open(name, function(err, db) {
      db.replicate.from('/' + name + '/', function(err, result) {
        ok(result.length === docs.docs.length);
        start();
      });
    });
  };

  $db.drop({success: create, error: create});
});
