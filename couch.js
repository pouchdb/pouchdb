// function Couch (name) {
//   this.name = name;
//   
//   
//   mozIndexedDB.open(name, description);
//   request.onerror = errorHandler;
//   request.onsuccess = grabEventAndContinueHandler;
//   let event = yield;
// 
//   let db = event.result;
// 
//   request = db.createObjectStore("foo", "");
//   request.onerror = errorHandler;
//   request.onsuccess = grabEventAndContinueHandler;
//   let event = yield;
// 
//   let objectStore = event.result;
//   let key = 10;
// 
//   request = objectStore.add({}, key);
//   request.onerror = errorHandler;
//   request.onsuccess = grabEventAndContinueHandler;
//   event = yield;
// 
//   is(event.result, key, "Correct key");
// 
//   request = objectStore.add({}, key);
//   request.onerror = new ExpectError(CONSTRAINT_ERR);
//   request.onsuccess = unexpectedSuccessHandler;
//   yield;
// 
//   finishTest();
//   yield;
// }

function createCouch (name, callback) {
  var request = indexedDB.open(name, "a couchdb");
  console.log(request)
  var couch = {};
  var db;
  request.onsuccess = function(event) {
   db = event.result;
   console.log(db);
   request = db.createObjectStore("sequence-index");
   request.openCursor().onsuccess = function (event) {
     var cursor = event.result;
     console.log(cursor);
     callback(null, couch);
   }
   // var transaction = db.transaction(["sequence-index", "store"]);
  }
  request.onfailure = function(error) {
    if (error) callback(error)
    else callback(true)
  } 
}

