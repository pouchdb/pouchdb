---
layout: post

title: 10 things I learned from reading (and writing) the PouchDB source

author: Nolan Lawson

---

In the spirit of [Paul Irish](http://www.paulirish.com/2010/10-things-i-learned-from-the-jquery-source/), here's a list of some surprising things I learned while reading (and writing) the PouchDB source code.

To set the stage: I first joined the project around December of last year, at which point PouchDB was already fairly mature. (The [first commit from Mikeal Rodgers](https://github.com/pouchdb/pouchdb/commit/d600081962d3f54b410e5cfcf78cd413ad94abb9) is already 4 years old!) My own background was mostly in Android development, but I had some knowledge of Web SQL thanks to [a PhoneGap app](http://www.kaahe.org/app/support_en.html) I had worked on.  

The main goals I had with PouchDB were to increase its performance and browser compatibility.  And having dealt with that ugly F-word that haunts the Android ecosystem ("fragmentation"), I figured compatibility in the web dev world couldn't be much worse. Could it?

**Warning: graphic content ahead.** If you've ever been a soldier on the front lines of the browser compatibility war, the following may make you relive some of those past horrors. Be prepared to weep.

Also, if you're not familiar with [LocalStorage](http://www.w3.org/TR/webstorage/), [Web SQL](http://www.w3.org/TR/webdatabase/), or [IndexedDB](http://www.w3.org/TR/IndexedDB/), you may want to read up on those first.

### 1. Nobody can agree on what the Web SQL "estimated size" means

When you open a Web SQL database, you use [openDatabase()](http://www.w3.org/TR/webdatabase/#dom-opendatabase), e.g.:

```js
var db = openDatabase('documents', '1.0', 'some description', 5000000);
```

That last parameter is the so-called *estimated size*. And [here's](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/websql.js#L118-L132) how we set it in PouchDB:

```js
function getSize(opts) {
  /* ... */
  var isAndroid = /Android/.test(window.navigator.userAgent);
  return isAndroid ? 5000000 : 1;
}
``` 

User agent sniffing! Yes, we should be ashamed of ourselves. But here's why we do it:

* In modern **Chrome** and **Android 4.4+**, the size is simply ignored. The browser calculates the remaining size on disk and sets a limit based on that.
* Aha, but in **Android < 4.4**, this is actually a hard limit! So if you ask for 5000000, you'll only ever get 5 MB.
* Oh, but in **Safari/iOS**, it gets trickier. If you ask for > 5000000, then it will show an [annoying popup](http://pouchdb.com/errors.html#not_enough_space) when the app is first loaded, which is a great way to spook your users. But if you ask for less, then there's another popup when the database reaches 5MB, and  beyond that there's a bug in iOS 7.1 where the browser will no longer show any more popups, so you're forever capped at 10MB. To store more than 10MB, you need to ask for more than 10MB up-front.
* Additionally, if you specify anywhere between 0 and 5000000, Safari and iOS will use that size as a hint for when, precisely, to show the popup. And in the case of PouchDB, we need to avoid the popup in our automated tests, because Selenium doesn't give us a way to press the "OK" button, meaning our tests would just fail if we request too much. So the ideal size to request is 0.
* However, in **PhantomJS** and older WebKit (Safari ~5), if you request 0, then it will blow up.

For the recored, here's what the dreaded Safari popup looks like:

{% include img.html src="safari_popup.png" alt="annoying Safari popup" %}

So that's why we sniff for Android and only bump the size to 5000000 in those cases. In all other cases, we set it to 1.

Additionally, the W3C has done everyone a disservice by using `5*1024*1024` in [their sample code](http://www.w3.org/TR/webdatabase/#introduction), because this has no relation to the 5MB limit in iOS/Safari. The actual cutoff to avoid the popup is 5000000 (i.e. 5 megabytes, aka 5MB), not `5*1024*1024` (5 *mebibytes*, aka 5MiB). And yet, if you read blog posts and Stack Overflow comments about Web SQL, you'll see the mistaken `1024*1024` repeated all over the place.


### 2. IE has race conditions in IndexedDB

Microsoft has a very fast implementation of IndexedDB &ndash; it's a bit slower than Chrome's, but much faster than Firefox's ([here are some tests](https://gist.github.com/nolanlawson/11100235)). However, to get that speed, they must have taken some shortcuts, because both IE10 and IE11 have some [nasty](https://connect.microsoft.com/IE/feedbackdetail/view/1009247) [race](https://connect.microsoft.com/IE/feedbackdetail/view/866489) [conditions](https://connect.microsoft.com/IE/feedbackdetail/view/866495).

Due to that, you'll often see PouchDB code [like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L1369-L1372): 

```js
//Close open request for "name" database to fix ie delay.
if (IdbPouch.openReqList[name] && IdbPouch.openReqList[name].result) {
  IdbPouch.openReqList[name].result.close();
}
```

Or code [like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L1390-L1398), where we ensure all "open" and "destroy" operations on the databases are done sequentially:

```js
taskQueue.queue.push({
  action: function (thisCallback) {
    destroy(name, opts, thisCallback);
  },
  callback: callback
});
```

Or code [like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L1215-L1226), where we keep a cache of all databases by name, since IE will not allow us to open two databases with the same name at the same time:

```js
var cached = cachedDBs[name];

if (cached) {
  idb = cached.idb;
  /* ... */
}
```

To their credit, though, the IE team has been [very responsive](https://twitter.com/jacobrossi/status/525715434838827009) to our bug reports, so this might be fixed soon.


### 3. Binary data in Web SQL is a mess

At the time the Web SQL spec was hammered out, nothing like [Blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or [ArrayBuffers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) had been standardized. SQLite of course has support for the [binary BLOB type](https://www.sqlite.org/datatype3.html), but in order to store binary data in WebSQL, you need to do it the old-fashioned way, and pass in a JavaScript binary string.

This produces two interesting problems:

* There is a bug in both [WebKit](https://bugs.webkit.org/show_bug.cgi?id=137637) and [Chromium](https://code.google.com/p/chromium/issues/detail?id=422690), where the `\u0000` character is treated as a null terminator, and although you can insert and sort on the full string, when you retrieve it, it will be truncated. And since BLOBs must be inserted as binary strings, this means *any binary data containing the 0 byte will be truncated*. The only workaround is to use `SELECT HEX(columnName)`, which returns the full binary data in hexadecimal format.
* However, `HEX()` presents its own problems, because Safari < 7.1 and iOS < 8 [coerce all strings to UTF-16](https://github.com/pouchdb/pouchdb/pull/1733#issuecomment-38723096), meaning that the hexadecimal format must be parsed differently in UTF-8 browsers (Chrome/Opera/Android as well as modern Safari/iOS) vs. UTF-16 browsers (early Safari/iOS).

Thus you will see fun code [like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/websql.js#L89-L101):

```js
function parseHexString(str, encoding) {
  var result = '';
  var charWidth = encoding === 'UTF-8' ? 2 : 4;
  for (var i = 0, len = str.length; i < len; i += charWidth) {
    var substring = str.substring(i, i + charWidth);
    if (charWidth === 4) { // UTF-16, twiddle the bits
      substring = substring.substring(2, 4) + substring.substring(0, 2);
    }
    result += String.fromCharCode(parseInt(substring, 16));
  }
  result = encoding === 'UTF-8' ? decodeUtf8(result) : result;
  return result;
}
```

(That "twiddle the bits" comment is a bit inaccurate; the technical term is, of course, [nibble-swizzling](http://grepcode.com/file/repository.grepcode.com/java/ext/com.google.android/android/2.2_r1.1/com/android/internal/telephony/IccUtils.java#IccUtils.bcdToString%28byte%5B%5D%2Cint%2Cint%29). In the future we will correct this gross oversight by finding some way to work the word "swizzle" into the source code.)

You'll also see us detect UTF-8 vs. UTF-16 encoding [like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/websql.js#L306-L315):

```js
function checkDbEncoding(tx) {
  // check db encoding - utf-8 (chrome, opera) or utf-16 (safari)?
  tx.executeSql('SELECT dbid, hex(dbid) AS hexId FROM ' + META_STORE, [],
    function (tx, result) {
      var id = result.rows.item(0).dbid;
      var hexId = result.rows.item(0).hexId;
      encoding = (hexId.length === id.length * 2) ? 'UTF-8' : 'UTF-16';
    }
  );
}
```

In this code, we know based on the length of the hexadecimal string returned whether the database is UTF-16 or not. So thankfully, because it's feature-detected, this "just works" in Safari 7.1+ and iOS 8+.

As of PouchDB 3.1.0, we will also [avoid hexing entirely](https://github.com/pouchdb/pouchdb/pull/2900) for large binary attachments, because it causes performance problems. The new workaround will be to just remove `\u0000` characters while preserving enough information to put them back in later.


### 4. Binary data in IndexedDB is a mess too

IndexedDB, as Web SQL's younger, hipper sibling, is supposed to have native support for Blob objects. In practice, though, Blobs [were not supported in Chrome until v37](https://code.google.com/p/chromium/issues/detail?id=108012), and assuming Apple fixes [the more fundamental problems in IndexedDB](http://www.raymondcamden.com/2014/9/25/IndexedDB-on-iOS-8--Broken-Bad), they also apparently [will not support them](http://html5test.com/s/9b895f1cfb68b0d5.html).

In those cases, PouchDB falls back to storing Blobs as base64-encoded strings. And we use [feature detection to test it](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L1303-L1344):

```js
try {
  var blob = utils.createBlob([''], {type: 'image/png'});
  txn.objectStore(DETECT_BLOB_SUPPORT_STORE).put(blob, 'key');
  txn.oncomplete = function () {
    /* ... */
    blobSupport = true;
    /* ... */
  };
} catch (err) {
  blobSupport = false;
  /* ... */
}
```

Ah, but if only it were so easy! It turns out that Chrome v37 also [implemented Blob support incorrectly](https://code.google.com/p/chromium/issues/detail?id=408120), returning the wrong MIME type when you fetch it. So in Chrome v37, we need to detect the broken blob support, whereas in v38 we can finally start treating it like the other browsers:

```js
var storedBlob = e.target.result;
var url = URL.createObjectURL(storedBlob);
utils.ajax({
  url: url,
  cache: true,
  binary: true
}, function (err, res) {
  if (err && err.status === 405) {
    // firefox won't let us do that. but firefox doesn't
    // have the blob type bug that Chrome does, so that's ok
    blobSupport = true;
  } else {
    blobSupport = !!(res && res.type === 'image/png');
  }
});
```

And yes, Firefox has [a tiny bug here](https://bugzilla.mozilla.org/show_bug.cgi?id=1081668) as well! Luckily, it's fixed in the nightly build.

So for those keeping score, PouchDB has three different strategies for each of Chrome v36, v37, and v38. And since Android represents different versions of Chromium frozen in amber, all three variations will be out there in the wild for the near future.


### 5. IE doesn't support complex keys

CouchDB is one of the grandaddies of NoSQL databases, so unsurprisingly it influenced IndexedDB's design. One of the more useful but tricky features of CouchDB is *complex keys*, [best described by Christopher Lenz](https://connect.microsoft.com/IE/feedbackdetail/view/866474):

> Obvious to Damien [Katz, creator of CouchDB], but not at all obvious to the rest of us: it's fairly simple to make a view that includes both the content of the blog post document, and the content of all the comments associated with that post. The way you do that is by using *complex keys*. Until now we've been using simple string values for the view keys, but in fact they can be arbitrary JSON values, so let's make some use of that:


The example given is:

```js
function(doc) {
  if (doc.type == "post") {
    map([doc._id, 0], doc);
  } else if (doc.type == "comment") {
    map([doc.post, 1], doc);
  }
}
```

See that? The key is actually an array containing a string and an integer, meaning it would sort first by the string, then by the integer. Cool, right?

This feature [is in the IndexedDB spec](http://www.w3.org/TR/IndexedDB/#key-construct), and would be a great fit for PouchDB, since we're basically trying to rewrite CouchDB on top of IndexedDB. However, in the source code you will see [pseudo-complex keys like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L512-L514):

```js
docInfo.data._doc_id_rev = docInfo.data._id + "::" + docInfo.data._rev;
var seqStore = txn.objectStore(BY_SEQ_STORE);
var index = seqStore.index('_doc_id_rev');
```

Leading to [gnarly queries like this](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L174-L179):

```js
var start = docId + "::";
var end = docId + "::~";
var index = seqStore.index('_doc_id_rev');
var range = global.IDBKeyRange.bound(start, end, false, false);
var seqCursor = index.openCursor(range);
```

Did we mess up? Nope, it's intentional: we concatenate the strings together, because [IE does not support complex keys](https://connect.microsoft.com/IE/feedbackdetail/view/866474).

This also heavily influenced our design for [persistent map/reduce](http://pouchdb.com/2014/05/01/secondary-indexes-have-landed-in-pouchdb.html), because instead of assuming the underlying database can sort by more than one value, we invented [a toIndexableString() function](https://github.com/pouchdb/collate/blob/0e22e6e833e24ee5d677d73df2620c20b58aba1f/lib/index.js#L116-L165) that converts any JSON object into a big CouchDB-collation-ordered string. Yeah, we went there.


### 6. IndexedDB throws an error if you try to iterate backwards with start/end keys

{% include alert/start.html variant="info" %}

{% markdown %}

**Update:** it turned out I just misunderstood the IndexedDB spec. You can actually swap the start and end in the `IDBKeyRange`, and that allows you to iterate backwards in all browsers. [We updated PouchDB accordingly](https://github.com/pouchdb/pouchdb/issues/3488).

{% endmarkdown %}

{% include alert/end.html %}

This is one of those wonderful "bugs" that is actually part of the IndexedDB spec, so it's faithfully reproduced in all three of Firefox, IE, and Chrome. I guess we should be thankful?

Anyway, [here's the code](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L746-L776):

```js
try {
  if (start && end) {
    keyRange = global.IDBKeyRange.bound(start, end, false, !inclusiveEnd);
  } else if (start) {
    /* ... */
  }
} catch (e) {
  if (e.name === "DataError" && e.code === 0) {
    // data error, start is less than end
    return callback(null, {
      total_rows : totalRows,
      offset : opts.skip,
      rows : []
    });
  } else {
    return callback(errors.error(errors.IDB_ERROR, e.name, e.message));
  }
}
```

In IndexedDB, an error will be thrown for any `IDBKeyRange` where the start is greater than the end, even if you're iterating backwards. We work around this by [manually checking for the end key](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L832-L838):

```js
if (manualDescEnd) {
  if (inclusiveEnd && doc.key < manualDescEnd) {
    return;
  } else if (!inclusiveEnd && doc.key <= manualDescEnd) {
    return;
  }
}
```

Luckily, this doesn't really have a big performance impact, except that we fetch one more key than necessary.

### 7. IndexedDB and Web SQL are jealous of other callbacks

In both IndexedDB and Web SQL, you can forget about using [Promises](https://promisesaplus.com/) or even invoking another callback within a transaction. Whenever control is returned to the event loop, [the transaction auto-closes](https://twitter.com/nolanlawson/status/515893338474831872).

So although your own PouchDB-using code can be elegant and Promisey (thanks especially to Calvin Metcalf's work on [lie](https://github.com/calvinmetcalf/lie)), under the hood, PouchDB's own code is pure callback hell.

Here's a taste of [our IndexedDB code](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L209-L635) and [our WebSQL code](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/websql.js#L456-L899). We party like it's 2009, because you'll see lots of callback patterns like this:

```js
verifyAttachments(function (err) {
  if (err) {
    return callback(err);
  }
  /* ... */
});
```

Or this wannabe `Promise.all()`: 

```js
function checkDoneWritingDocs() {
  if (++numDocsWritten === docInfos.length) {
    complete();
  }
}
```

And if we need to use some other callback API, such as [FileReader](https://developer.mozilla.org/en-US/docs/Web/API/FileReader), we need to be careful to do it outside of the transaction. Hence you'll see functions like [preprocessAttachments()](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/websql.js#L886-L898):

```js
preprocessAttachments(function () {
  db.transaction(function (txn) {
    /* ... */
  });
});
```

Suffice it to say, if we didn't have extensive integration tests, we'd barely be sure the code worked at all.

### 8. Recursion is a double-edged sword

Consider [this code](https://github.com/pouchdb/pouchdb/blob/c32597564160dcaad7b3e715ddf1c0dc923b59cd/lib/adapters/idb.js#L45-L58):

```js
// Unfortunately, the metadata has to be stringified
// when it is put into the database, because otherwise
// IndexedDB can throw errors for deeply-nested objects.
// Originally we just used JSON.parse/JSON.stringify; now
// we use this custom vuvuzela library that avoids recursion.
// If we could do it all over again, we'd probably use a
// format for the revision trees other than JSON.
function encodeMetadata(metadata, winningRev, deleted) {
  var storedObject = {data: vuvuzela.stringify(metadata)};
  storedObject.winningRev = winningRev;
  storedObject.deletedOrLocal = deleted ? '1' : '0';
  storedObject.id = metadata.id;
  return storedObject;
}
```

As it turns out, this is [a very tricky bug](https://github.com/pouchdb/pouchdb/issues/2543) that ended up affecting all browsers, and even Node.js.

The gist is that any native JavaScript function that takes an object as input, such as `JSON.stringify()` or IndexedDB's `put()`, has a maximum limit on the depth of the object  you can pass in. By depth I mean:

```js
var object = {
  enhance: {
    enhance: {
      enhance: {
        /* and so on */
      }
    }
  }
};
```

The limit itself will vary based on the available memory, but in any case, if you hit that limit, you get a "too much recursion" or "maximum call stack" error. As well as an unhappy PouchDB user.

Calvin and I solved this by writing [a non-recursive JSON library with a silly name](https://github.com/nolanlawson/vuvuzela). It's slower than the native methods, but in cases where we can't afford to have a crash, this code turned out to be a lifesaver.

### 9. In IndexedDB, unique indexes throw constraint errors, but keyPaths don't 

This is one of those counter-intuitive things that probably made sense to IndexedDB creator [Nikunj Mehta](http://blog.o-micron.com/), but surprised the hell out of me.

In SQLite and Web SQL, you can create a table with a primary key:

```sql
CREATE TABLE employees (id PRIMARY KEY UNIQUE, name);
```

And you can also add a unique index:

```sql
CREATE TABLE employees (id, name);
CREATE UNIQUE INDEX id_index ON employees (id);
```

And these two are essentially equivalent, because if you try to `INSERT` a row with an `id` that already exists, you'll get a constraint error.

In IndexedDB, however, object stores with primary keys will *not* throw an error upon insertion, but instead silently overwrite the existing object. In other words, the `put()` is an [upsert](http://en.wiktionary.org/wiki/upsert). Unique indexes, however, behave totally differently and will indeed throw.

Here's [a live example](http://bl.ocks.org/nolanlawson/1afe3b5e98e4111c67c4). The big takeaway is that the following two examples are *not* equivalent:

With a primary key:

```js
db.createObjectStore('employees', {keyPath : 'id'});
```

With a unique index:

```js
db.createObjectStore('employees').createIndex('id', 'id', {unique: true});
```

Better hope you choose the right one the first time! Otherwise you may get a constraint error when you don't expect one, or vice versa.

**Edit:** As pointed out by [Simon Friis Vindum](https://twitter.com/paldepind/status/539012069061033984), you can use `add()` instead of `put()` to get a constraint error with keyPaths. Here's [a live example](http://bl.ocks.org/nolanlawson/c9a4673830de2b185b8b). Thanks for the tip!

### 10. CouchDB influenced IndexedDB influenced LevelDB influenced...

Databases are not designed in a vacuum, and the more I learn about this stuff, the more I find that everything is related somehow.

Web SQL was originally inspired by [Google Gears](http://gearsblog.blogspot.com/2011/03/stopping-gears.html), which in 2008 [was poised](https://code.google.com/p/gears/wiki/GearsHistory) to become the standard for storing data in mobile webapps. And of course neither would have been possible without SQLite, which, according to creator Richard Hipp, [was heavily influenced](http://use-the-index-luke.com/blog/2014-05/what-i-learned-about-sqlite-at-a-postgresql-conference) by PostgreSQL. In fact, I find [his presentation](http://www.pgcon.org/2014/schedule/attachments/319_PGCon2014OpeningKeynote.pdf) especially inspiring, because Hipp's process of using Postgres as a gold standard for building SQLite reminds me a lot of how PouchDB has been molded in CouchDB's image.

And although [the Web SQL spec was eventually abandoned](http://nolanlawson.com/2014/04/26/web-sql-database-in-memoriam/), it certainly influenced its younger sibling IndexedDB. Among other family traits, they share the same asynchronous structure, auto-closing transactions, and security models. (Compare the "security" sections for [both](http://www.w3.org/TR/webdatabase/) [specs](http://www.w3.org/TR/IndexedDB/), and note how much of the language is simply copied over).

Web SQL also lives on indirectly in IndexedDB, given that both [Mozilla's](https://hacks.mozilla.org/2010/06/beyond-html5-database-apis-and-the-road-to-indexeddb/) and [Apple's](https://bugs.webkit.org/show_bug.cgi?id=132176) implementations are independently (!) implemented on top of SQLite.

What's more intriguing is that you can even find [the influence of CouchDB](http://lists.w3.org/Archives/Public/public-webapps/2009AprJun/0106.html) in early discussions of IndexedDB. This might explain features like complex keys, start/end key iteration, and the document-esque data model. Nikunj Mehta [even said way back in 2009](http://t.co/9N6O9qkn4S):

> Some people find [IndexedDB] good for a JavaScript CouchDB.

In a sense, this statement may be the earliest expression of what eventually became PouchDB!

Furthermore, Google went on to create LevelDB as their implementation of the IndexedDB spec, which is currently enjoying [enormous popularity in the Node.js ecosystem](http://dailyjs.com/2013/04/19/leveldb-and-node-1/), especially thanks to [the LevelUP project](https://github.com/rvagg/node-levelup). PouchDB itself [has hopped on the LevelUP bandwagon](http://pouchdb.com/2014/07/25/pouchdb-levels-up.html), and today we have PouchDB Server, which is a nearly-complete implementation of CouchDB's HTTP API, but based on Node.js and LevelDB. 

So from the earliest discussions of IndexedDB, influenced as it was by CouchDB and Web SQL, through LevelDB and the LevelUP ecosystem, we now have a database that unites them all: PouchDB.

When I look through the PouchDB source code, this enormous accomplishment still gives me chills. It's enough to make you overlook all the odd hacks, workarounds, and inelegancies. The fact that PouchDB works at all is a tiny miracle.
