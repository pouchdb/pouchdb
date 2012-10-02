function makeDocs(start, end, templateDoc) {
  var templateDocSrc = templateDoc ? JSON.stringify(templateDoc) : "{}";
  if (end === undefined) {
    end = start;
    start = 0;
  }
  var docs = [];
  for (var i = start; i < end; i++) {
    /* jshint: evil */
    var newDoc = eval("(" + templateDocSrc + ")");
    newDoc._id = (i).toString();
    newDoc.integer = i;
    newDoc.string = (i).toString();
    docs.push(newDoc);
  }
  return docs;
}

function initTestDB(name, callback) {
  // ignore errors, the database might not exist
  Pouch.destroy(name, function(err) {
    if (err && err.status !== 404) {
      console.error(err);
      ok(false, 'failed to open database');
      return start();
    }
    new Pouch(name, function(err, db) {
      if (err) {
        console.error(err);
        ok(false, 'failed to open database');
        return start();
      }
      callback.apply(this, arguments);
    });
  });
}

function initDBPair(local, remote, callback) {
  initTestDB(local, function(err, localDb) {
    initTestDB(remote, function(err, remoteDb) {
      callback(localDb, remoteDb);
    });
  });
}

function generateAdapterUrl(id) {
  var opt = id.split('-');
  if (opt[0] === 'idb') {
    return 'idb://test_suite_db' + opt[1];
  }
  if (opt[0] === 'http') {
    return 'http://localhost:2020/test_suite_db' + opt[1];
  }
}


/**** Test Result Support ***************/
    var doc = {};
    QUnit.jUnitReport = function(report) {
        doc.report = report;
        doc.completed = new Date().getTime();
        //doc.system = System;
        if (window.location.hash && window.location.hash.length > 0) {
            doc.git_commit = window.location.hash.substring(1);
        }
        $('button').on('click', function(){
            submitResults();
        });
        new Pouch(generateAdapterUrl('http-110'), function(err, db) {
            if (err) return console.log('Cant open db to store results');
            db.post(doc, function (err, info) {
              if (err) return console.log('Could not post results');
              $('body').append('<p>Storing Results Complete.</p>')
            });
        });
    }


    function submitResults() {

        $('button').text('uploading...').attr('disabled', 'disabled');
        $.ajax({
            type: 'POST',
            url: 'http://localhost:2020/_replicate',
            data: JSON.stringify({"source":"test_suite_db1","target":"http://reupholster.iriscouch.com/pouch_tests"}),
            success: function() {
                $('button').hide();
                $('body').append('<p>Submission complete.</p>')
            },
            headers: {
                Accept: 'application/json'
            },
            dataType: 'json',
            contentType: 'application/json'
        });
    }






