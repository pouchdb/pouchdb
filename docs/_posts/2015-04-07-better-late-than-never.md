---
layout: post

title: PouchDB 3.4.0&#58; Better late than never
author: Dale Harvey

---

Everyone needs a break, and for March PouchDB relaxed and enjoyed the arrival of spring. However, regularly scheduled programming has resumed, and today I am happy to announce PouchDB 3.4.0.

### Documentation, Documentation, Documentation

Over the last 2 months a huge amount of work has gone into PouchDB's documentation, including [#3584](https://github.com/pouchdb/pouchdb/pull/3584), which allows you to switch between a Promises and a callback format for your code examples.

We have hugely expanded the coverage of the documentation, so if there is anything missing please feel free to point it out.

### Changelog:

* Fix incompatibilities with Couchbase Sync Gateway ([#3556](https://github.com/pouchdb/pouchdb/issues/3556), [#3552](https://github.com/pouchdb/pouchdb/issues/3552), [#3555](https://github.com/pouchdb/pouchdb/issues/3555), [#3561](https://github.com/pouchdb/pouchdb/issues/3561), [#3562](https://github.com/pouchdb/pouchdb/issues/3562),  [#3562](https://github.com/pouchdb/pouchdb/issues/3562), [#3495](https://github.com/pouchdb/pouchdb/issues/3495), [#3493](https://github.com/pouchdb/pouchdb/issues/3493))
* Added a copy of PouchDB to PouchDB.com (check the inspector - [#2960](https://github.com/pouchdb/pouchdb/issues/2960))
* Fix replication using design documents ([#3543](https://github.com/pouchdb/pouchdb/issues/3543))
* Fix immediately cancelling live replication ([#3605](https://github.com/pouchdb/pouchdb/issues/3605))
* Fix replication with a view ([#3606](https://github.com/pouchdb/pouchdb/issues/3606))
* Add support for new SqlitePlugin parameters ([#3617](https://github.com/pouchdb/pouchdb/issues/3617))
* Fix for deleted conflicts ([#3646](https://github.com/pouchdb/pouchdb/issues/3646))
* Fix design documents that contain a slash ([#3680](https://github.com/pouchdb/pouchdb/issues/3680))
* Fix for setting ajax headers in GET requests ([#3689](https://github.com/pouchdb/pouchdb/issues/3689))
* Allow setting auth headers in replication ([#3543](https://github.com/pouchdb/pouchdb/issues/3543))

### Get in touch

Please [file issues](https://github.com/pouchdb/pouchdb/issues) or [tell us what you think](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md#get-in-touch). And as always, a big thanks to all of our [new and existing contributors](https://github.com/pouchdb/pouchdb/graphs/contributors)!
