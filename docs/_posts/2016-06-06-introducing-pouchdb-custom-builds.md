---
layout: post

title: Introducing PouchDB custom builds
author: Nolan Lawson

---

> "Hold the pickles, hold the lettuce; special orders don't upset us."
>
> _– Burger King jingle_

When you're building a large open-source project, the challenge often becomes less about "how do we add new features?" and more about "how do we let people opt-out of the features they don't want?".

This is especially important in JavaScript projects, where the code is usually shipped to users' browsers, meaning every byte counts. Furthermore, with modern build systems based on npm, it's painful to sit and wait for a large dependency to be `npm install`ed, especially if you're only using a small part of it.

Large dependencies can mean a loading spinner in your user's browser, as well as an npm spinner in your own console.

### PouchDB – not so pocket-sized anymore

PouchDB is an ambitious project, and as such it's grown a lot over the years. It started out as a simple way to sync CouchDB to IndexedDB (originally [only supporting Firefox Nightly](https://github.com/pouchdb/pouchdb/blob/e46433351bbda4adfbea8849e38c44edd9260a98/README)!), whereas now it's used in a variety of contexts:

- In Node.js using [LevelDB][LevelDOWN]
- In hybrid apps using [native SQLite][SQLitePlugin2]
- As its own [server][pouchdb-server]
- As an AJAX interface to CouchDB
- As a layer over WebSQL, LocalStorage, or even in-memory

With each new addition, PouchDB's codebase has steadily swollen to support the new use case. And while we've been pretty good at keeping the core size down (45kB min+gz is hefty for a JavaScript library, but not enormous), users still often ask us these sorts of questions:

- What if I don't want map/reduce?
- What if I'm only using the IndexedDB adapter?
- What if I'm only using PouchDB to talk to CouchDB?

If you're not using any of the dependencies, it's a shame to include them in the bundle that gets shipped to your users. We feel ya.

Also, because PouchDB has some large native dependencies (such as LevelDB), the first `npm install` can take a very long time, and it can even fail on certain operating systems (Windows, looking at you). This is especially bothersome when you consider that those dependencies are only required if you're using PouchDB in Node.js. (And even then, you could just use the in-memory adapter instead.)

So unfortunately, folks who are only using PouchDB in the browser still have to pay the extra cost of installing LevelDB. And ditto for SQLite, even though it's only used for the optional `node-websql` adapter! This is a less-than-ideal scenario.

### Breaking up is hard to do

With PouchDB 5.4.0, though, we've made a huge architectural change to support users who want a slimmer or more customized PouchDB experience. Starting with this release, many of the core
modules that were previously internal to PouchDB can now be `npm install`ed and configured separately.

By adopting this pattern, PouchDB is joining the likes of [Babel][], [Lodash][], [Ember][], and other projects that have been unbundled for quite some time. However, even though many JavaScripters now take this kind of unbundling for granted, it's still [very difficult for library authors to implement](https://medium.com/@jonathanewerner/thoughts-about-package-modularization-d9631f7a41f1). npm itself does not come with built-in tools to manage multi-package projects, and even [npm link](https://docs.npmjs.com/cli/link) can quickly break down if you're trying to run a large test suite with multiple projects across multiple repos.

Luckily, the Babel authors have risen to the occasion and created [Lerna](http://lernajs.com/), which is the tool they use to manage [Babel's numerous sub-packages](https://github.com/babel/babel/tree/f7c6afe594202104b6047ec67b3cbe2987b04aa8/packages). Lerna allows JavaScript library authors to define multiple packages for a single repo, and then link and test them all as one. In other words, it's a tool to manage [monorepos](https://github.com/babel/babel/blob/f7c6afe594202104b6047ec67b3cbe2987b04aa8/doc/design/monorepo.md).

As it turns out, this monorepo strategy is perfect for PouchDB. Logically, we have many small interdependent components (such as the replication module, the map/reduce module, or the IndexedDB adapter), but we prefer to test them all in one large test suite, because a change in one module can have cascading effects in another module. Breaking everything up into many tiny repos, which would be tested, versioned, and developed independently, is just not practical for us.

Using Lerna, though, we can keep all of PouchDB's codebase in one repo, and still release it as separate packages. There are some tricky bits – such as how to manage source code versus bundled code, and how to measure code coverage – but in those cases [Rollup](http://rollupjs.org/) remains a great tool to allow us to de-bundle and re-bundle at will. In particular, Rollup allows us to build a "debug" version of PouchDB with many more endpoints exposed, which we then test as a single `index.js` for measuring code coverage. Then, we are still free to ship a "production" version of PouchDB with those endpoints disabled.

With this release, we are also committing to the `jsnext:main` standard [as promoted by Rollup](https://github.com/rollup/rollup/wiki/jsnext:main), meaning that all of our packages (including `pouchdb` itself) now ship with both ES modules and CommonJS, and you are free to use whichever one you want. In general, the ES modules will tend to give you smaller bundle sizes (assuming you are using Rollup, SystemJS, or Webpack 2 as your bundler), whereas the CommonJS bundle is more appropriate for backwards compatibility. (Neither release makes use of ES6 features aside from ES modules, so you do not need a transpiler like Babel or [Bublé](http://buble.surge.sh/)).

### Cool, how does it work?

PouchDB now ships with a few presets, which are a good demonstration of how the new plugin feature works. Here's `pouchdb-browser` (as CommonJS), which is the "browser" version of PouchDB:

```js
var PouchDB = require('pouchdb-core');

PouchDB.plugin(require('pouchdb-adapter-idb'))
  .plugin(require('pouchdb-adapter-websql'))
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-mapreduce'))
  .plugin(require('pouchdb-replication'));

module.exports = PouchDB;
```

As you can see, `pouchdb-browser` is just an extension of `pouchdb-core`, with some key modules added in: the IndexedDB adapter, the WebSQL adapter, the HTTP adapter, map/reduce, and replication. If you're not using any of these features, you can just delete that plugin and enjoy the file savings.

Additionally, you'll notice that `pouchdb-browser` does not depend on LevelDB at all. Instead, that lives in `pouchdb-node`, a.k.a. the "Node" version of PouchDB:

```js
var PouchDB = require('pouchdb-core');

PouchDB.plugin(require('pouchdb-adapter-leveldb'))
  .plugin(require('pouchdb-adapter-http'))
  .plugin(require('pouchdb-mapreduce'))
  .plugin(require('pouchdb-replication'));

module.exports = PouchDB;
```

The only difference here is that `pouchdb-browser` uses IndexedDB and WebSQL, whereas `pouchdb-node` uses LevelDB. Hence, LevelDB is not installed if you do `npm install pouchdb-browser`.

Also, if you'd like to use a custom adapter, those are now shipped separately. So if you want to use PouchDB in a purely in-memory mode, you can do:

```js
var PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-memory'));
```

Or if you're only using PouchDB to talk to CouchDB:

```js
var PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-http'));
```

This applies to all of the plugins we previously shipped in the ["extras" API](http://pouchdb.com/api.html#extras). Any of these can now be mixed and matched as desired:

* `pouchdb-adapter-fruitdown`
* `pouchdb-adapter-localstorage`
* `pouchdb-adapter-memory`
* `pouchdb-adapter-node-websql`

Note that the plugin order of the non-HTTP adapters matters. So for instance, if you wanted to fall back from IndexedDB to WebSQL to LocalStorage to in-memory, you would do:

```js
var PouchDB = require('pouchdb-core')
  .plugin(require('pouchdb-adapter-idb'))
  .plugin(require('pouchdb-adapter-websql'))
  .plugin(require('pouchdb-adapter-localstorage'))
  .plugin(require('pouchdb-adapter-memory'));
```

This also opens up the possibility of more easily including custom third-party adapters, such
as [worker-pouch](https://github.com/nolanlawson/worker-pouch) and [socket-pouch](https://github.com/nolanlawson/socket-pouch).

### How many bytes can it save?

Here is a breakdown of the bundle size of various possible PouchDB configurations, using Browserify, [bundle-collapser](https://github.com/substack/bundle-collapser), and Uglify.

<div class="table-responsive">
<table class="table"><thead>
<tr>
<th>Preset</th>
<th>Browserify + Uglify</th>
<th>Browserify + Uglify + Gzip</th>
</tr>
</thead><tbody>
<tr>
<td><code>pouchdb</code></td>
<td>140.06 kB</td>
<td>45.15 kB</td>
</tr>
<tr>
<td><code>pouchdb-browser</code></td>
<td>148.3 kB</td>
<td>47.54 kB</td>
</tr>
<tr>
<td><code>pouchdb-http</code></td>
<td>64.29 kB</td>
<td>21.54 kB</td>
</tr>
<tr>
<td>PouchDB, IndexedDB only</td>
<td>83.47 kB</td>
<td>27.79 kB</td>
</tr>
<tr>
<td>PouchDB, WebSQL only</td>
<td>85.15 kB</td>
<td>28.16 kB</td>
</tr>
<tr>
<td>PouchDB, replication only</td>
<td>76.28 kB</td>
<td>25.26 kB</td>
</tr>
<tr>
<td>PouchDB, in-memory only</td>
<td>350.74 kB</td>
<td>100.81 kB</td>
</tr>
</tbody></table></div>

Note that `pouchdb-browser` is slightly bigger than `pouchdb`, because `pouchdb`
is heavily optimized with Rollup before publishing, whereas `pouchdb-browser` is
not. Also, some optional plugins (like `pouchdb-adapter-memory`) are still quite large. In the future, we may consider using Rollup more aggressively, or trying to reduce the size of `pouchdb-core`. Or we might just wait
for the ecosystem to switch to tools that do automatic tree-shaking for ES modules,
such as Rollup or Webpack 2. (If you use such a tool, and it supports `jsnext:main`, then you should already be able to get smaller bundle sizes.)

In the meantime, though, a major benefit of PouchDB unbundling is still in reduced `npm install` times, as well as avoiding compatibility issues with native dependencies like `leveldown` and `sqlite3`.

### Backwards compatibility?

Yes indeed, as suggested by the 5.4.0 release version, this is a fully _backwards-compatible change_. The `pouchdb` module will still act exactly as it did before, including the `dist/` and `extras/` APIs. Essentially, a `npm install pouchdb` will install the kitchen sink. We believe this is the best approach, because it provides a batteries-included experience for beginners, without having to burden them with understanding a vast plugin API.

However, the `extras/` API is deprecated, and will be removed in a later version. Furthermore, the `PouchDB.utils`, `PouchDB.ajax`, and `PouchDB.Errors` APIs, which have been undocumented and unrecommended for years, are now removed. Plugin authors should update their code to use the new sub-packages.

That said, there is an important note about the new sub-packages: all of them are pegged to PouchDB's version number, meaning that when PouchDB cuts a new release, each of the sub-packages will also be released with the same version number. Furthermore, not all of these sub-packages follow [semantic versioning](http://semver.org/), because conceptually they are internal modules, which are only exposed on npm as an implementation detail. The APIs for these packages may change at any time, so you should use exact versioning if you decide to use them directly. These packages will be clearly marked as non-semver in their READMEs.

In the new system, the packages that serve as "plugins" (as well as `pouchdb` itself) are considered user-facing and semver-compliant. In particular, these packages follow semver:

* `pouchdb`
* `pouchdb-adapter-fruitdown`
* `pouchdb-adapter-http`
* `pouchdb-adapter-idb`
* `pouchdb-adapter-leveldb`
* `pouchdb-adapter-localstorage`
* `pouchdb-adapter-memory`
* `pouchdb-adapter-node-websql`
* `pouchdb-adapter-websql`
* `pouchdb-browser`
* `pouchdb-http`
* `pouchdb-mapreduce`
* `pouchdb-node`
* `pouchdb-replication`

Other modules, such as `pouchdb-ajax`, `pouchdb-checkpointer`, and `pouchdb-promise`, may be freely used, but they make no guarantees as to semver. As we did with the `extras/` API, all of these are used at your own risk.

### Scoped packages?

We considered using [scoped packages](https://www.npmjs.com/private-modules) (e.g. `@pouchdb/foo`) as opposed to prefixed packages (e.g. `pouchdb-foo`) for the new monorepo architecture. In fact, we even asked the community to [vote on the issue](https://github.com/pouchdb/pouchdb/issues/5165), and as of today the vote stands at 27 for scopes and 24 for prefixes.

However, the core team ultimately decided that it's too early to hop onto the scoping bandwagon. There are still plenty of thorny issues with scopes, such as the fact that npm organizations are not free for open-source yet, meaning we would have to register a single `pouchdb` account and share it among all the contributors. (See [the voting issue](https://github.com/pouchdb/pouchdb/issues/5165) for discussion about other issues with scopes.) We look forward to these issues being resolved as scoping matures, at which point we may consider moving over to scoped packages.

For the foreseeable future, though, PouchDB's sub-packages will sport names like `pouchdb-browser`, `pouchdb-ajax`, and `pouchdb-replication`. Even if it's a bit old-fashioned, we hope that PouchDB's users will experience fewer surprises and confusion with this more traditional naming convention. And considering the popularity of `ember-*`, `babel-*`, and `react-*` packages, it's safe to say PouchDB is in good company.

### Build-a-bear, build-a-pouch

Since there are dozens of combinations for building your own PouchDB, we encourage the community to mix-and-match, and to publish any presets that they find useful. As of 5.4.0, there are three presets that PouchDB will officially support as first-party packages:

* `pouchdb-browser` – the "browser" version of PouchDB
* `pouchdb-node` – the "Node" version of PouchDB
* `pouchdb-http` – PouchDB as an HTTP interface to CouchDB (sans map/reduce)

In the future, we also plan to move some packages that have previously existed in third-party repos (including `pouchdb-server`, `pouchdb-express-router`, and `pouchdb-find`) into the main PouchDB repository, so that they can be tested, versioned, and released at the same time as PouchDB.

So please, try out the new customizable PouchDB, and let us know what you think! And if there are any bugs, there's only one repo you need to worry about, so please direct your bugs to [the PouchDB issues page](http://github.com/pouchdb/pouchdb/issues/). Happy unbundling!

[LevelDOWN]: https://github.com/Level/leveldown
[SQLitePlugin2]: https://github.com/nolanlawson/cordova-plugin-sqlite-2
[pouchdb-server]: https://github.com/pouchdb/pouchdb-server/
[Lodash]: http://lodash.com/
[Babel]: http://babeljs.io/
[Ember]: http://emberjs.com/
