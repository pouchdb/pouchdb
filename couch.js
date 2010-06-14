

function getObjectStore (db, name, desc, callback, errBack) {
  if (db.objectStoreNames.contains(name)) {
    callback(db.objectStore(name));
  } else {
    var request = db.createObjectStore(name, desc);
    request.onsuccess = function (e) {
      callback(e.value)
    }
    request.onerror = function (err) {
      if (errBack) errBack(err);
    }
  }
}

function createCouch (options, cb) {
  if (cb) options.success = cb;
  if (!options.name) throw "name attribute is required"
  var request = indexedDB.open(options.name, options.description ? options.description : "a couchdb");
  // Failure handler on getting Database
  request.onerror = function(error) {
    if (options.error) {
      if (error) options.error(error)
      else options.error("Failed to open database.")
    }
  }
  console.log(request)
  request.onsuccess = function(event) {
    var db = event.result;
    console.log(db);
    getObjectStore(db, 'document-store', 'Document Store.', function (documentStore) {
      console.log(documentStore);
      getObjectStore(db, 'sequence-index', 'Sequence Index', function (sequenceIndex) {
        console.log(sequenceIndex);
        
        // Now we create the actual CouchDB
        var couch = {
          put: function (doc, options) {
            
          } 
          , get: function (_id, options) {
            
          }
          , post: function (doc, options) {
            
          }
        }
        
        var request = sequenceIndex.openCursor()
        request.onsuccess = function (event) {
          // Handle iterating on the sequence index to create the reverse map and validate last-seq
          options.error('I need more code');
        }
        request.onerror = function (event) {
          // Assume the database is just empty because the error code is broken
          couch.seq = 0;
          options.success(couch);
        }
        
        
      }, function () {if (options.error) {options.error('Could not open sequence index.')}})
    }, function () {if (options.error) {options.error('Could not open document store.')}})
  }
}

