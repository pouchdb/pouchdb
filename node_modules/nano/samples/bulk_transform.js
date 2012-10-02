var db    = require('nano')('http://localhost:5984/emails')
  , async = require('async')
  ;

function update_row(row,cb) {
  var doc = row.doc;
  delete doc.subject;
  db.insert(doc, doc._id, function (err, data) {
    if(err)  { console.log('err at ' + doc._id);  cb(err); }
    else     { console.log('updated ' + doc._id); cb(); }
  });
}

function list(offset) {
  var ended = false;
  offset = offset || 0;
  db.list({include_docs: true, limit: 10, skip: offset}, 
    function(err, data) {
      var total, offset, rows;
      if(err) { console.log('fuuuu: ' + err.message); rows = []; return; }
      total  = data.total_rows;
      offset = data.offset;
      rows   = data.rows;
      if(offset === total) { 
        ended = true;
        return; 
      }
      async.forEach(rows, update_row, function (err) {
        if(err) { console.log('something failed, check logs'); }
        if(ended) { return; }
        list(offset+10);
      });
  });
}

list();