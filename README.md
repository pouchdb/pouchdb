[PouchDB](http://pouchdb.com/) - The Javascript Database that Syncs
==================================================

PouchDB was written to help web developers build applications that work as well offline as well as they do online, applications save data locally so the user can use all the features of an app even while offline and synchronise the data between clients so they have up to date data wherever they go.

PouchDB is a free open source project, written in Javascript by these [wonderful contributors](https://github.com/daleharvey/pouchdb/graphs/contributors) and inspired by <a href="http://couchdb.apache.org/">Apache CouchDB</a>.

Using PouchDB
-------------

To get started using PouchDB check out our [Documentation](http://pouchdb.com/learn.html) and the [API Documentation](http://pouchdb.com/api.html).


Contributors
------------
If you want to get involved then check out the [contributing guide](https://github.com/daleharvey/pouchdb/blob/master/CONTRIBUTING.md)

Example
-------

```javascript
var db = new PouchDB('dbname');

db.put({
 _id: 'dave@gmail.com',
 name: 'David',
 age: 66
});

db.changes().on('change', function() {
  console.log('Ch-Ch-Changes');
});

db.replicate.to('http://example.com/mydb');
```
