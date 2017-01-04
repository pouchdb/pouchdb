---
layout: post

title: How we performance-tune PouchDB
author: Nolan Lawson

---

In PouchDB 6.1.1, there were substantial improvements to the performance of secondary index creation, as well as overall improvements to the IndexedDB and in-memory adapters. In this post I'll talk about how I analyzed PouchDB and implemented these performance boosts.

### Measure twice, cut once

There's an old English idiom that says ["measure twice, cut once"](https://en.wiktionary.org/wiki/measure_twice_and_cut_once#English). Apparently it's a reference to carpentry, but I find it to be excellent advice for performance-tuning as well.  

When trying to improve the performance of any piece of code, proper measurements are your most valuable asset. You can't get
any faster if you don't know what "fast" means.

PouchDB maintains [a simple set of benchmarks](https://github.com/pouchdb/pouchdb/tree/master/tests/performance) using [tape](https://github.com/substack/tape) as well as `performance.mark()`, `performance.measure()`, and `performance.now()`, aka the [User Timing API](https://developer.mozilla.org/en-US/docs/Web/API/User_Timing_API). These APIs provide accurate timings as well as nice visualizations in the Chrome Dev Tools:

Previously we had been using `Date.now()`, but this API is no longer recommended for performance testing, because it's not as high-resolution as `performance`. During the course of modernizing our measurements, I also built a standalone library called [marky](https://github.com/nolanlawson/marky), which makes it easier to use high-resolution APIs like `performance.mark()` and `measure()` while also falling back to `Date.now()` in older browsers.

Once you've got your measurements in place, next you need to make sure that you reduce variability in the tests. When I run performance tests, I always ensure:

1. **The Dev Tools have never been opened.** These add overhead to browsers. So for a fair assessment, it's best to completely close the Dev Tools, close the browser, and reopen it.
2. **The laptop is connected to a power outlet.** Browsers may change their behavior in battery mode. For instance, Edge throttles `setTimeout()` to 16 milliseconds rather than the standard 4.
3. **The tests are repeatable.** Performance tests should have enough iterations that you can see a clear, measurable difference between runs; you don't want to interpret statistical noise as a performance boost or regression. If you want to get really fancy, you can use something like [BenchmarkJS](https://benchmarkjs.com/) which does enough iterations to ensure statistical significance.

Another important consideration when running performance tests is to **test in multiple browsers**. Many web developers have gotten into the habit of only ever testing in their browser of choice (usually Chrome), but this can be misleading, because browsers tend to differ enormously in their performance aspects. If you only test in one browser, you can miss performance opportunities (e.g. because the one browser happens to have already optimized a particular scenario) or over-engineer based on browser quirks (e.g. focusing only on [V8 deoptimizers](https://github.com/petkaantonov/bluebird/wiki/Optimization-killers)).

For PouchDB, it's especially crucial that we test in multiple browsers, because IndexedDB implementations vary wildly across the board. Chrome's version is implemented using [LevelDB](http://leveldb.org/), Firefox's and Safari's use [SQLite](https://sqlite.org/) (different implementations, though), and IE and Edge use [ESE](https://en.wikipedia.org/wiki/Extensible_Storage_Engine). In practice this leads to large and measurable differences between the various engines.

In the case of PouchDB, we also have to be careful to consider performance implications for non-IndexedDB databases, since we also support WebSQL, LevelDB (via [leveldown](https://github.com/level/leveldown)), in-memory (via [memdown](https://github.com/level/memdown)), and even exotic engines like [node-websql](https://github.com/nolanlawson/node-websql). However, IndexedDB is our primary target, since it's the most commonly-used adapter.

For this round of performance improvements, I chose to target a few different scenarios:

- Secondary index creation and querying, using IndexedDB
- Secondary index creation and querying, using in-memory (aka memdown)

I focused on secondary index creation and querying because, due to the way PouchDB is architected, this code path tends to hit lots of core PouchDB APIs, including `bulkDocs()`, `changes()`, and `allDocs()`. Furthermore, it's one of our slower scenarios, and one users frequently gripe about.

The reason I chose to focus on the IndexedDB and in-memory adapters was because 1) IndexedDB is our most important adapter, but 2) in-memory is extremely useful for running quick unit tests (e.g. via `pouchdb-server --in-memory`) and also helps isolate non-engine-specific issues, since it's pure JavaScript.

### Running the performance tests

For these tests, I focused on the PouchDB `temp-views` test, which can be accessed by checking out the PouchDB codebase, running
`npm install` and `npm run dev`, then opening `http://127.0.0.1:8000/tests/performance?grep=temp-views` in a browser. Different adapters can be tested by adding e.g. `&adapter=memory`.

These tests were run on an i5 Surface Book running Windows 10 RS1 (aka the Anniversary Update), using Edge 14, Chrome 55, and Firefox 55.

So without further ado, here's what we managed to speed up!

### Using native ES6 Map/Set

I mentioned earlier that you should always be testing in multiple browsers… but of course that doesn't prevent us from taking
advantage of useful features that only appear in one browser's Dev Tools.

Chrome Dev Tools recently added a neat feature called "Record Allocation Profile," which shows the memory allocation per function. Using this feature, I saw that our ES6 Map/Set shims were consuming a lot of memory:

<!-- RESULTS HERE -->

I also knew this was a non-negligible source of slowdown, because a regular Timeline profile showed lots of time spent in Garbage Collection:

<!-- RESULTS HERE -->

In our case, we use Map/Set heavily across the board, mostly to prevent issues where documents with `_id`s named for Object prototype fields (e.g. `constructor`, which is an [actual npm package](npmjs.com/package/constructor) and therefore [has caused problems](https://github.com/pouchdb/pouchdb/issues/2477) when replicating from the npm CouchDB reigstry). This means we are only ever using string keys, and our implementation is to simply namespace the keys by prefixing the keys with `$`. Unfortunately this leads to relatively high memory use because of all the strings we're creating. 

The fix was to ensure our Map/Set implementation would prefer the native implementations, and only fall back to the polyfill on older browsers. Once the fix was in place, the benchmark improved across the board:

Note that the [six-speed benchmark](http://kpdecker.github.io/six-speed/) seems to show that ES6 Map/Set is not always a clear winner for every API. However, for our usage patterns, it offers a nice little performance boost.

### Using getAll()/getAllKeys()

Next, I noticed that our secondary index implementation relied heavily on the PouchDB `changes()` API and the `allDocs()` APIs. In the case of the IndexedDB adapter, both of these were primarly based on [IDBCursor](https://w3c.github.io/IndexedDB/#cursor-interface), which is an interface for iteratively reading through entries in the database. Unfortunately because it's a one-at-a-time API, it tends to lead toward a stairstep pattern:

In our case, this was a waste, because our secondary index implementation was fully capable of using batched operations (with a fixed batch size of 50 documents), and in fact was already taking advantage of this for the WebSQL adapter. But for IndexedDB there was no easy way to do this.

Note I say "was," because in v2 of the IndexedDB spec, two interesting new APIs were added: [getAll()](https://w3c.github.io/IndexedDB/#dom-idbobjectstore-getall) and [getAllKeys()](https://w3c.github.io/IndexedDB/#dom-idbindex-getallkeys). These APIs allow you to pass in a single `IDBKeyRange` and immediately get back all matching entries in a single request. Furthermore, both APIs have been available since Chrome 48 and Firefox 44.

In the case of PouchDB, though, integrating these APIs proved difficult, and [we had put it off in the past](https://github.com/pouchdb/pouchdb/issues/4235#issuecomment-138387841) because of the difficulty in adapting these batch APIs to scenarios where filtering often had to be done in JavaScript, which was easier for `IDBCursor`s than `getAll()`/`getAllKeys()` (e.g. the `filter` function or the `doc_ids` option on the `changes()` API).

What I noticed when profiling, however, was that secondary indexes actually used a small enough and predictable enough subset of the `allDocs()` and `changes()` APIs that we could effectively fork our implementation – one for the general case (using the fast `getAll()`/`getAllKeys()` APIs, and one for the more niche case (using the slow `IDBCursor` API). So this is what I implemented.

So this is what I did! In [#6033](https://github.com/pouchdb/pouchdb/pull/6033) and [#6060](https://github.com/pouchdb/pouchdb/pull/6060) I implemented a [batched cursor](https://github.com/pouchdb/pouchdb/blob/fbc311b44f0ce2812fff73b1cbfd10099ce18eb8/packages/node_modules/pouchdb-adapter-idb/src/runBatchedCursor.js) that could read _n_ entries at a time, falling back to `IDBCursor` in special cases or when the browser didn't support `getAll()`/`getAllKeys()` (still the case with Edge, but of course I'd like to fix that &#x0001f609;). For `allDocs()`, it was a bit simpler; we just needed [a getAll() shim](https://github.com/pouchdb/pouchdb/blob/fbc311b44f0ce2812fff73b1cbfd10099ce18eb8/packages/node_modules/pouchdb-adapter-idb/src/getAll.js) and to use it [when certain conditions were met](https://github.com/pouchdb/pouchdb/blob/fbc311b44f0ce2812fff73b1cbfd10099ce18eb8/packages/node_modules/pouchdb-adapter-idb/src/allDocs.js#L179-L187).

The results speak for themselves:

<!-- RESULTS HERE -->

Note I only include Edge in order to demonstrate that there was no regression for browsers without `getAll()`/`getAllKeys()`.

After implementing these changes, I also went ahead and opened [an issue on the IndexedDB spec](https://github.com/w3c/IndexedDB/issues/130) since I noticed there's an awkward case where `descending` queries need to use `IDBCursor` instead of `getAll`, due to a quirk in the `getAll` API. It's always good to provide feedback to spec authors when you're working on this stuff!

### Using `immediate` instead of `setTimeout` in memdown

When profiling the in-memory adapter, I noticed a lot of time spent idle:

<!-- RESULTS HERE -->

Eventually I tracked this down to over-use of `process.nextTick()`, which in the browser is shimmed via [the node-process polyfill](https://github.com/defunctzombie/node-process) which ultimately relies on `setTimeout()`.

There was already [an interesting discussion in the memdown repo](https://github.com/Level/memdown/pull/59) about our choice of timers, and it wasn't clear what the best timer API would be. Clearly we wanted to avoid [releasing Zalgo](http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony), but as Mikeal Rogers points out in the issue, having too many tasks queued at once can lead to blocked UIs, jank, stuttering, etc. As Calvin Metcalf pointed out, [there's an inherent tradeoff between latency and throughput](https://github.com/Level/memdown/pull/59#issuecomment-260339876), i.e. you can have lots of tasks scheduled close to gether, which will be faster but more blocking, or you can spread the tasks out, which will be slower but allow other tasks to get scheduled in the interim. But as he wisely pointed out:
 
> At the end of the day we can have low latency by default or we can have no render blocking by default. No render blocking is possible to build on top of low latency, but the reverse is not possible. So we should probably default to to low latency.
 
So ultimately for memdown we decided to replace `process.nextTick` with [immediate](https://github.com/calvinmetcalf/immediate), which is a microtask library and thus optimized for low latency at the expense of potential render blocking. To address Mikeal's issue, the easiest way to avoid render-blocking would be to manually break up your own callbacks with `postMessage()` or `setTimeout()` (or use a web worker!).
 
So upgrading from memdown 1.2.2 to 1.2.4 (as we did in PouchDB 6.1.1) resulted in the following gains:
 
 <!-- RESULTS HERE -->

### Better `doc_count` optimization

PouchDB has built up a lot of tiny optimizations over the years, including an optimization for `doc_count` and `total_rows`. These
are values returned by the `info()` and `allDocs()` APIs that describe the total number of non-deleted, non-local documents
in the database, and are useful for things like pagination (e.g. "X results remaining") or replication progress (e.g. "X documents synced").

The calculation of the count itself can be expensive, though (`IDBKeyRange.count()` in IndexedDB or `SELECT COUNT(*)` in WebSQL), so PouchDB previously had an in-memory cache of the number, which would be updated whenever new documents were inserted or removed. Unfortunately I realized that this in-memory cache wasn't safe across threads, meaning that access to the same database across tabs or via Web Workers or Service Workers could return inconsistent results. So for correctness's sake I removed the optimization.
 
This caused an immediate IndexedDB regression, especially in Chrome:

<!-- RESULTS HERE -->

(Again, this is why it's good to test across browsers! Apparently this optimization really helped out Chrome, whereas Firefox and Edge seem to already have some built-in optimization for index counts.)

The right solution here was to re-implement the `doc_count` optimization, but using an in-database cache rather than an in-memory cache. This would allow the cached value to be consistent across threads, since IndexedDB has transaction guarantees.

After implementing the fix for IndexedDB, our numbers were back up:

<!-- RESULTS HERE -->

As of PouchDB 6.1.1 the `doc_count` optimization hasn't been reimplemented for WebSQL, but there's [an open issue to fix it](https://github.com/pouchdb/pouchdb/issues/6125).

### Conclusion

Hopefully this post has provided some insight into the concerns we have when optimizing PouchDB. As a database, PouchDB tends to have very different performance pressures compared to a UI library, so the kinds of issues you see discussed around React, Ember, Preact, InferoJS, etc. are rarely top-of-mind for the PouchDB team. In particular, we're rarely CPU-bound and are typically more IO-bound with respect to the underlying data store (IndexedDB, WebSQL, LevelDB, or CouchDB itself via HTTP).

After reading those discussions (e.g. [this great interview](http://survivejs.com/blog/inferno-interview/)  with InfernoJS creator Dominic Gannway), I've often considered implementing micro-optimizations for PouchDB (avoid polymorphism, reduce hidden classes, extract functions and `typeof` calls), but I rarely find it actually moves the needle.

When profiling, I usually see that the lion's share of PouchDB's costs are either in waiting for the database to respond, or dealing with UI-blocking overhead of IndexedDB calls themselves. IDB is asynchronous, but [it's not free](http://nolanlawson.com/2015/09/29/indexeddb-websql-localstorage-what-blocks-the-dom/), which is why I still recommend isolating PouchDB to a worker thread – completely if possible, or using  [worker-pouch](https://github.com/nolanlawson/worker-pouch) if refactoring your codebase to accommodate Web Workers is too difficult.

Understanding where your bottlenecks actually appear is the first step to tackling your performance problems. And to circle back to the original point at the top of the post, you can only learn this through careful measurements and analysis. Off-the-shelf performance advice can be good for educational reasons, but every site and every library is usually its own special snowflake that needs its own performance analysis.