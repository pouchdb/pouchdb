function genDBName() {
  var suffix = '';
  for (var i = 0 ; i < 10 ; i++ ) {
    suffix += (Math.random()*16).toFixed().toString(16);
  }
  return suffix;
}

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
  pouch.deleteDatabase(name, function() {
    pouch.open(name, callback);
  });
}