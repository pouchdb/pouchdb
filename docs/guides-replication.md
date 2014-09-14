CouchDB was designed with one main goal in mind &ndash; sync. Jason Smith of Nodejitsu has a great quote about this:

> "The way I like to think about CouchDB is this: **CouchDB is bad at everything, except syncing**. And it turns out that's the most important feature you could ever ask for, for many types of software."

When you first start using CouchDB, you may become frustrated because it doesn't operate quite like other databases, such as MySQL and MongoDB. Unlike those databases, it makes you explicitly manage document revisions (`_rev`), which can be tedious.

However, CouchDB was designed with sync in mind, and this is exactly what it excels at. Many of the rougher edges of the API serve this larger purpose. For instance, managing document revisions is crucial, because it helps you further down the line, when you start needing to deal with conflicts.

CouchDB sync
------

CouchDB sync, a.k.a. "replication," has a unique design. Rather than relying on a master/slave architecture, CouchDB
supports a **multi-master** architecture. You can think of this as a system where any node can be written to or read from, and where you don't have to care which one is the "master"
and which one is the "slave." In CouchDB's egalitarian world, every citizen is as worthy as another.

When you write web applications with PouchDB, or when you write mobile apps using the Couchbase/Cloudant mobile libraries for iOS and Android, you
don't have to worry which database is the "single source of truth." They all are. According to the CAP theorem, CouchDB is an AP database, meaning that it's **P**artitioned, 
every node is **A**vailable, and it's only eventually **C**onsistent.

To illustrate, imagine a multi-node architecture with CouchDB servers spread across several continents. As long as you're willing to wait, the data will eventually flow 
from Australia to Europe to North America to wherver. Users around the world running PouchDB in their browsers or the Couchbase/Cloudant mobile libraries smartphones experience the 
same privileges. The data won't show up instantaneously, but depending on the Internet connection speed, it's usually close enough to real-time.

In cases of conflict, CouchDB will choose an arbitrary winner that every node can agree upon deterministically. However, conflicts are still stored in the **revision tree** (similar to a Git history tree), which means that app developers can either surface the conflicts to the user, or just ignore them.

In this way, CouchDB replication "just works."