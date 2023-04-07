---
layout: post

title: PouchDB 3.3.0&#58; Fix Up, Look Sharp
author: Dale Harvey

---

A new month means a new PouchDB release. Over the last month we have been looking around the rough edges and cleaning things up or chopping them off along with the usual slew of bugfixes and a lot of great news.

### PouchDB-Inspector

[Marten de Vries](https://twitter.com/commandoline) has taken the awesome work done by the CouchDB Fauxton team and wrapped Fauxton up in Firefox and Chrome plugins so you can inspect your local data in each browser.

 * [Install as Firefox Addon](https://addons.mozilla.org/firefox/addon/pouchdb-inspector/) - [Github](https://github.com/marten-de-vries/pouchdb-fauxton-firefox-addon)
 * [Install from Chrome Web Store](https://chrome.google.com/webstore/detail/pouchdb-inspector/hbhhpaojmpfimakffndmpmpndcmonkfa) - [Github](https://github.com/marten-de-vries/pouchdb-fauxton-chrome-extension)

### PouchDB-Find

A few months ago Cloudant released a preview of [Mango](https://github.com/cloudant/mango), a MongoDB-inspired query API for Cloudant and CouchDB. The MapReduce API exposed by CouchDB has long been a source of confusion for developers, and this will hopefully provide a more natural way to query data held within CouchDB / PouchDB.

Nolan Lawson took on the mantle and has developed an implementation of Mango for PouchDB. It is currently in beta, and you can try it out [as a plugin](https://github.com/nolanlawson/pouchdb-find), try the [live demo](http://nolanlawson.github.io/pouchdb-find/) or even test it by installing [PouchDB-Server](https://github.com/pouchdb/pouchdb-server).

### In other news

The excellent team at [CozyCloud](https://www.cozycloud.cc/) have been working on a web-based email application that you can run on a personal server based on PouchDB and ReactJS @ [https://www.npmjs.com/package/emails](https://www.npmjs.com/package/emails). Yours truly will be speaking about PouchDB and the offline web at [Web Rebels in Oslo](https://www.webrebels.org/speakers#daleharvey) and the [Hood.ie](http://hood.ie/) team are working on 1. [migrating their data storage to PouchDB](https://github.com/hoodiehq/wip-hoodie-store-on-pouchdb) and 2. [extracting some of PouchDB's test setup to be reusable](https://github.com/gr2m/testmate). Contributions and discussion always welcome.

## Release Changes

### Sync Events - [#3155](https://github.com/pouchdb/pouchdb/issues/3155)

We have introduced [new events](/api.html#replication) to give you more information what is happening during syncing. There are now `active` and `paused` events triggered during replication and the `uptodate` event is now deprecated.

### Retry Replication - [#966](https://github.com/pouchdb/pouchdb/issues/966)

Calvin did the base work for this a long time ago, however we now officially support a `retry` option to replication. If you do a `db.replicate(to, {retry: true})` or `db.sync(db, {retry: true})` then the replication process will not halt when you go offline, and will automatically resume when you (or your server) comes back online.

### Docs property in change events - [#3358](https://github.com/pouchdb/pouchdb/pull/3358)

A lot of developers wanted to know what documents were being referred to when they recieved a change event. Gregor from hood.ie implemented a new `docs` property in the change event, so you know exactly what documents have changed.

### local_seq now deprecated - [#3367](https://github.com/pouchdb/pouchdb/issues/3367)

`local_seq` was a rarely used property that will be unsupported in CouchDB 2.0, so we have deprecated it and will be removed in future versions.

### Changelog:

* We now have all tests passing against CouchDB master ([#136](https://github.com/pouchdb/pouchdb/issues/136))
* Fixed return of `.compact` ([#3350](https://github.com/pouchdb/pouchdb/issues/3350))
* Fix a typo in the Error constructor ([#1167](https://github.com/pouchdb/pouchdb/issues/1167))
* Disabled blob support due to bugs in Chrome, so we now use base64 for attachments in Chrome ([#3369](https://github.com/pouchdb/pouchdb/issues/3369))
* Fix races in `.destroy()` ([mapreduce/#251](https://github.com/pouchdb/mapreduce/issues/251))
* Ensure both replications are cancelled properly during `.sync` ([#3431](https://github.com/pouchdb/pouchdb/issues/3431))
* Replace ajax calls with `request` polyfill ([#3200](https://github.com/pouchdb/pouchdb/issues/3200))
* Prefer readAsArrayBuffer to BinaryString ([#3379](https://github.com/pouchdb/pouchdb/issues/3379))
* Get all tests green on Travis (including iPhone and IE)  ([#3058](https://github.com/pouchdb/pouchdb/issues/3058))
* Map/reduce views built concurrently ([pouchdb/mapreduce#240](https://github.com/pouchdb/mapreduce/issues/240))
* Quicker map/reduce view build times ([pouchdb/mapreduce#242](https://github.com/pouchdb/mapreduce/issues/242))


### Get in touch

Please [file issues](https://github.com/pouchdb/pouchdb/issues) or [tell us what you think](https://github.com/pouchdb/pouchdb/blob/master/CONTRIBUTING.md#get-in-touch). And as always, a big thanks to all of our [new and existing contributors](https://github.com/pouchdb/pouchdb/graphs/contributors)!
