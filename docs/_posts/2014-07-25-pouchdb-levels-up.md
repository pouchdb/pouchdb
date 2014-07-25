---
layout: post

title: PouchDB levels up

author: Nolan Lawson

---

You might not have noticed it, but PouchDB underwent a quiet revolution over the past few months. The catalyzing moment was [the LevelUP proposal](https://github.com/pouchdb/pouchdb/issues/1250) posted by Nick Thompson back in January 2014, which slowly led to a rewrite of the PouchDB adapter for LevelDB to support arbitrary LevelUP backends.  If that looks like word soup, let me explain why this is such a big deal.

### LevelDB

In 2011, Google invented [LevelDB](https://en.wikipedia.org/wiki/LevelDB) as their answer to the [IndexedDB spec](http://www.w3.org/TR/IndexedDB/) designed by Nikunj Mehta. Like IndexedDB, it's quite a low-level abstraction that provides only the bare bones of what you'd need to qualify as a database &ndash; key-value storage, iteration, batch operations, and little else. Indeed, this was one of the big selling points of IndexedDB: it was low-level and unimposing enough that all the browser vendors could agree on it.

As it turned out, though, Google's implementation was really good.  Due to [its unique design](http://dailyjs.com/2013/04/19/leveldb-and-node-1/) inspired by BigTable, it scales well for anything from small application stores to huge multi-cluster databases. And thanks to its limited scope, it's been adopted as a core building block for more feature-rich databases, most notably Basho's [Riak](http://basho.com/riak/), Facebook's [RocksDB](http://rocksdb.org/), and [Hyperdex](http://hyperdex.org/).

### LevelDB comes to Node

In Node.js, LevelDB took an especially interesting turn when Rod Vagg started the [LevelUP project](https://github.com/rvagg/node-levelup). LevelUP aimed not only to provide a fluent, Node-friendly API for LevelDB, but also to create a new lingua franca for persistent datastores. With LevelUP, the team managed to separate the API from the underlying storage engine (cheekily named LevelDOWN), therefore allowing any database that exposes a LevelUP-compliant API to be swapped in under the hood.

Since the LevelUP project began, the number of compatible datastores has exploded, and today you're spoiled for choice if you write your app to the LevelUP API. As a developer, you can start with LevelDOWN, but if you later decide LevelDB itself isn't to your tastes, you can swap it out for any one of:

* [level-rocksdb](https://github.com/Level/level-rocksdb), Facebook's fork for RocksDB
* [Level.js](https://github.com/maxogden/level.js), a browser-based store built on IndexedDB
* [RiakDOWN](https://github.com/nlf/riakdown), a Riak-based store
* [MemDOWN](https://github.com/rvagg/memdown), an in-memory store
* and [many others](https://github.com/rvagg/node-levelup/wiki/Modules#storage-back-ends).

What this means in practice is that you could, for instance, use:

* MemDOWN for your unit tests,
* Level.js when your app runs in a browser,
* LevelDOWN on your dev server,
* and Riak in your production server.

In a sense, LevelUP brings to the NoSQL world the same benefits of interoperability that the SQL world enjoyed for so long.  SQL databases share the SQL language, and the LevelUP-compliant databases share the LevelUP API.

### Enter PouchDB

This brings us back to Nick Thompson's [LevelUP proposal](https://github.com/pouchdb/pouchdb/issues/1250). At the time he wrote it, PouchDB had three supported backends &ndash; LevelDB, Web SQL, and IndexedDB.  All three were written as separate adapters tailored to PouchDB's API, but he pointed out that if we integrated with LevelUP, we could piggyback on LevelUP's success and potentially get lots of new backends for free.

For instance, there was [a longstanding issue](https://github.com/pouchdb/pouchdb/issues/44) to add LocalStorage support for older browsers like IE 8 and 9. With LevelUP, we could avoid writing an entirely new, fourth adapter and simply plug into [localstorage-down](https://github.com/No9/localstorage-down). And it certainly wouldn't hurt to have Riak, Redis, or an in-memory database as potential backends.

There was some hemming and hawing (mostly from me), but in the end we decided to cruise ahead with the proposal. (And ultimately, I was happily proven wrong.) Calvin Metcalf deserves the primary credit for integrating [Sublevel](https://github.com/dominictarr/level-sublevel) into the LevelDB adapter, while Adam Shih jumped in to get the new adapter browserified with three different backends: localstorage-down, level-js, and MemDOWN. I put the finishing touches to build them as separate plugins, and as of 2.2.3 they're fully passing the test suite and [ready to use](http://pouchdb.com/adapters.html#pouchdb_in_the_browser).

Additionally, [PouchDB Server](https://github.com/pouchdb/pouchdb-server) has been updated to allow the use of alternate backends via the `--level-backend` option. This provides an instant CouchDB REST API to any LevelUP-compliant datastore &ndash; Redis, Riak, MySQL, you name it. There's also a new `--in-memory` option, courtesy of MemDOWN, of course.

### Community dynamics

Besides getting some new backends, another cool change was that PouchDB started to take a more active role in the LevelUP community. Calvin Metcalf wrote [SQLdown](https://github.com/calvinmetcalf/SQLdown), Adam Shih and I became maintainers of localstorage-down, and all three of us submitted patches to level-js, MemDOWN, [abstract-leveldown](https://github.com/rvagg/abstract-leveldown), and even LevelUP itself. The PouchDB test suite [has been offered](https://github.com/rvagg/abstract-leveldown/issues/26) as an additional means of testing for *DOWN authors, and it's already been used to fix bugs in [RiakDOWN](https://github.com/nlf/riakdown) and [RedisDOWN](https://github.com/hmalphettes/redisdown).

So in a sense, we didn't really get these new adapters "for free." PouchDB is complex enough, and our unit tests are thorough enough, that we ended up pushing the LevelUP folks' code to the limit, discovering many new bugs in the process.

But in a more positive sense, we've actually achieved Nick Thompson's goal of more deeply integrating with the LevelUP community, thereby reducing redundancy and putting more effort into a smaller codebase. And in the future, positive changes in PouchDB will spill over into the LevelUP universe, and vice-versa. 

The only original aim that we haven't achieved is to consolidate our three adapters (LevelDB, Web SQL, and IndexedDB) into one. We have a few reasons for this: our custom IndexedDB adapter is currently faster than Level.js, SQLdown is still a work in progress, and we're wary of the inevitable schema migration.

However, the fact that we can have dozens of PouchDB backends, while only maintaining three parallel adapters, is still a huge boon and was well worth the effort.

### Conclusion

PouchDB has a bright future as part of the LevelUP ecosystem. What would have sounded like a crazy dream half a year ago is now a verifiable reality, with unit tests to boot.  Today you can write an app that:

* Syncs from CouchDB to an in-memory [PouchDB Server](https://github.com/pouchdb/pouchdb-server),
* Then syncs to LocalStorage on IE 8,
* Then syncs to [Cloudant](https://cloudant.com/),
* Then syncs to a PhoneGap app using the [SQLite Plugin](https://github.com/brodysoft/Cordova-SQLitePlugin),
* Then syncs to any one of Redis, Riak, SQLite, LevelDB, MySQL, PostgreSQL, and potentially [many more](https://github.com/rvagg/node-levelup/wiki/Modules#storage-back-ends).

Or whatever other crazy combination you can cook up!

The marriage of PouchDB and LevelUP has essentially resulted in a marriage of the CouchDB sync protocol to the LevelUP API. Any database that exposes a LevelUP interface is now a full-fledged CouchDB replication target, which is a huge win for application developers.

Which database do you want to sync to?  Well, which database do you feel like today?