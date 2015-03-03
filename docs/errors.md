---
layout: 2ColLeft
title: Common Errors
sidebar: nav.html
---

{% include anchor.html class="h3" title="No 'Access-Control-Allow-Origin' header" hash="no_access_control_allow_origin_header" %}

If you see the error:

> XMLHttpRequest cannot load [...]
> No 'Access-Control-Allow-Origin' header is present on the requested resource.
> Origin [...] is therefore not allowed access.

or this one:

> Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource at http://[couchDBIP]:[couchDBPort]/[dbname]/?_nonce=[request hash]. This can be fixed by moving the resource to the same domain or enabling CORS

it's because you need to enable [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS) on CouchDB/IrisCouch/whatever you're using. Otherwise, your scripts can only access the server database if they're served from the same origin &#8212; the protocol (ex: _http://_, _https://_), domain, and port number must match. 

You can enable CORS in CouchDB using `curl` or the Futon web interface, but we've saved you some time by making a Node script called [add-cors-to-couchdb](https://github.com/pouchdb/add-cors-to-couchdb). Just run:

{% highlight bash %}
$ npm install -g add-cors-to-couchdb
$ add-cors-to-couchdb
{% endhighlight %}

Or if your database is not at `127.0.0.1:5984`:

{% highlight bash %}
$ add-cors-to-couchdb http://me.iriscouch.com \
    -u myusername -p mypassword
{% endhighlight %}

You can check that CORS is now enabled by visiting [http://localhost:5984/_utils/config.html](http://localhost:5984/_utils/config.html) in your browser. You should see something like this:

{% include img.html src="cors_in_couchdb.png" alt="CORS settings in CouchDB" %}

{% include anchor.html class="h3" title="PouchDB throws a `No valid adapter found` error" hash="no_valid_adapter" %}

Reading from/writing to a local database from an `iframe` with a different origin will cause PouchDB to throw a `No valid adapter found` error in Firefox. This is due to Firefox's IndexedDB implementation. 

IndexedDB has a same-origin restriction. Read/write operations from another origin will always fail, but only Firefox triggers a `No valid adapter found` error. Chrome / Opera will instead throw an [`UnknownError`](#unknown_error_chrome). 

{% include anchor.html class="h3" title="iOS/Safari: \"there was not enough remaining storage space\"" hash="not_enough_space" %}

On iOS and Safari, if you expect your app to use more than 5MB of space, you will need to request the space up-front from the user.  In certain versions, notably Safari/iOS 7, you can never request more than what the user originally grants you.

{% include img.html src="safari_popup.png" alt="Safari storage quota popup" %}

To get around this, when you create your PouchDB, use the `opts.size` option for the expected _maximum_ size of the database in MB.  Valid increments are 10, 50, 100, 500, and 1000.  For instance, if you request 50, then Safari will show a popup saying "allow 50MB?" but if you request 51, then Safari will show a popup saying "allow 100MB?".

If you don't use the `size` option, then you'll be able to use up to 5MB without any popup, but then once you use more, there will be a popup asking for 10.

```js
new PouchDB('mydb', {size: 10}); // request 10 MB with a popup
new PouchDB('mydb', {size: 50}); // request 50 MB with a popup
new PouchDB('mydb'); // implicitly request 5 MB, no popup until you exceed 5MB
```

This does not affect any backend other than Web SQL. Chrome, Android, and Opera do not show the popup. On PhoneGap/Cordova apps, you can also use the [SQLite plugin][sqlite] to get around this problem. Here's [more information about storage quotas](http://www.html5rocks.com/en/tutorials/offline/quota-research) and [details on the Safari/iOS 7 bug](https://github.com/pouchdb/pouchdb/issues/2347).

{% include anchor.html class="h3" title="PouchDB throws 404 (Object Not Found) for '_local' document" hash="404__local_document" %}

Don't worry, nothing is amiss, this is expected behaviour:
During PouchDB's initial replication PouchDB will check for a checkpoint, if it doesn't exist a 404 will be returned and a checkpoint will subsequently be written.

{% include anchor.html class="h3" title="PouchDB is throwing `InvalidStateError`" hash="throwing_invalidstateerror" %}

Are you in private browsing mode? IndexedDB is [disabled in private browsing mode](https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB) in Firefox.

{% include anchor.html class="h3" title="Can't open second database on Android WebView with Cordova/Phone Gap" hash="phonegap_cordova_second_database" %}

There is a limit of one database per app in some versions of the Android WebView. Install the [SQLite plugin][sqlite], then PouchDB will use that if it is available.

{% include anchor.html class="h3" title="Database size limitation of ~5MB on iOS with Cordova/Phone Gap" hash="size_limitation_5mb" %}

If you're storing large amounts of data, such as PNG attachments, the [SQLite plugin][sqlite] is again your friend. (See [issue #1260](https://github.com/pouchdb/pouchdb/issues/1260) for details.)

{% include anchor.html class="h3" title="CouchDB returns a 404 for GETs from a CouchApp" hash="404_get_couchapp" %}

Certain URL rewrites are broken by PouchDB's cache-busting; try adding `{cache : false}` to the PouchDB constructor. (See [issue #1233](https://github.com/pouchdb/pouchdb/issues/1233) for details.)

{% include anchor.html class="h3" title="Uncaught TypeError: object is not a function" hash="typeerror_object_is_not_a_function" %}

Did you include the [es6-promise shim library](https://github.com/jakearchibald/es6-promise)?  Not every browser implements ES6 Promises correctly. (See [issue #1747](https://github.com/pouchdb/pouchdb/issues/1747) for details.)

{% include anchor.html class="h3" title="Uncaught TypeError: 'undefined' is not a function" hash="undefined_is_not_a_function" %}

Did you include the [es5-shim library][es5shim]? In particular this shows up in PhantomJS because of [this bug](https://github.com/ariya/phantomjs/issues/10522).

{% include anchor.html class="h3" title="SyntaxError: Parse error (Cordova on Android)" hash="cordova_android_parse_error" %}

Did you include the [es5-shim library][es5shim]?  PouchDB is written in ES5, which is supported by modern browsers, but requires shims for older browsers (e.g. IE 9, Android 2.1 WebView).

In Android, if you're loading PouchDB directly via `webView.loadUrl('javascript://' + js')`, you should prefer the minified PouchDB javascript file to the unminified one, since code comments can also cause parse errors.

{% include anchor.html class="h3" title="PouchDB object fails silently (Safari)" hash="safari_object_silent_fail" %}

Safari requires users to confirm that they want to allow an app to store data locally ("Allow this website to use space on your disk?").  If PouchDB is loaded in an `iframe` or some other unusual way, the dialog might not be shown, and the database will silently fail.

{% include anchor.html class="h3" title="window.localStorage is not available (Chrome apps)" hash="window_localstorage_chrome_apps" %}

In Chrome apps, you'll see the warning "window.localStorage is not available in packaged apps. Use chrome.storage.local instead."  This is harmless; since PouchDB doesn't use localStorage if it's not available.

{% include anchor.html class="h3" title="Error: UnknownError (Firefox)" hash="unknown_error_ff" %}

Are you using a webserver to host and run your code? This error can be caused by running your script/file locally using the `file:///` setting in Firefox, since Firefox does not [allow access to IndexedDB locally](https://bugzilla.mozilla.org/show_bug.cgi?id=643318). You can use the SimpleHTTPServer to deploy your script by running `python -m SimpleHTTPServer` from the directory containing the script, or use the Apache webserver and then access the script by using `http://localhost/{path_to_your_script}`.

{% include anchor.html class="h3" title="Error: UnknownError (Chrome / Opera)" hash="unknown_error_chrome" %}

This can occur when attempting to read from or write to IndexedDB from a different origin. IndexedDB has a same-origin restriction. Attempting to write to the database associated with _http://example.com_ from an `iframe` served from _http://api.example.com_, for example, will fail. 

In Firefox, PouchDB instead throws a [`No valid adapter found`](#no_valid_adapter) error.

{% include anchor.html class="h3" title="DataCloneError: An object could not be cloned" hash="could_not_be_cloned" %}

If you ever see:

    Uncaught DataCloneError:
      Failed to execute 'put' on 'IDBObjectStore':
      An object could not be cloned.

Or:

    DataCloneError: The object could not be cloned.

Then the problem is that the document you are trying to store is not a pure JSON object. For example, an object with its own class (`new Foo()`) or with special methods like getters and setters cannot be stored in PouchDB/CouchDB.

If you are ever unsure, then run this on the document:

```js
JSON.parse(JSON.stringify(myDocument));
```

If the object you get out is the same as the object you put in, then you are storing the right kind of object.

Note that this also means that you cannot store `Date`s in your document. You must convert them to strings or numbers first. `Date`s will be stored as-is in IndexedDB, but in the other adapters and in CouchDB, they will be automatically converted to ISO string format, e.g. `'2015-01-01T12:00:00.000Z'`. This can caused unwanted results. See [#2351](https://github.com/pouchdb/pouchdb/issues/2351) and [#2158](https://github.com/pouchdb/pouchdb/issues/2158) for details.

{% include anchor.html class="h3" title="DOM Exception 18 in Android pre-Kitkat WebView" hash="android_pre_kitkat" %}

This applies to hybrid apps designed to run in Android pre-Kitkat (i.e. before 4.4).

If you are directly using a `WebView` and not using Cordova/PhoneGap, you will probably either run into an error where PouchDB silently fails or you see `Error: SECURITY_ERR: DOM Exception 18` in the console. As a sanity test, you can run this JavaScript:

```js
openDatabase('mydatabase', 1, 'mydatabase', 5000000, function (db) { console.log('it works!'); });
```

If you see "it works" in the console, then everything's peachy. Otherwise there are a few things you have to do.

First, make sure Web SQL is enabled on your `WebView` in the first place using [setDatabaseEnabled](http://developer.android.com/reference/android/webkit/WebSettings.html#setDatabaseEnabled%28boolean%29):

```java
myWebView.getSettings().setDatabaseEnabled(true);
```

Second, specify a path for the database. Yes, you need to do this, even though it's deprecated in Kitkat:

```java
String databasePath = getContext().getApplicationContext().getDir(
  "database", Context.MODE_PRIVATE).getPath();
webView.getSettings().setDatabasePath(databasePath);
```

Third, you'll need to set an `onExceededDatabaseQuota` handler. Yes, it's also deprecated in Kitkat. Yes, you still need to do it.

```java
webView.setWebChromeClient(new WebChromeClient() {

  @Override
  public void onExceededDatabaseQuota(String url, String databaseIdentifier, long currentQuota, long estimatedSize,
                                      long totalUsedQuota, WebStorage.QuotaUpdater quotaUpdater) {
    quotaUpdater.updateQuota(estimatedSize * 2);
  }
});
```

If you skip any one of these three steps, then you will get the `DOM Exception 18` error. You need to do all three.

Alternatively, you can also load the `WebView` with a fake `http://` URL, but this may cause other errors when you try to fetch files based on a relative path:

```java
webView.loadDataWithBaseURL("http://www.example.com", 
    htmlContent, 
    "text/html", 
    "utf-8", 
    null);
```

{% include anchor.html class="h3" title="PouchDB on Windows" hash="windows_leveldown" %}

It is known that building/compiling Node modules with native code on Windows can be frustrating, as there are lots of required dependencies to be installed, which may take many Gigabytes, as opossed to Unix platforms, where compiling is a breeze. Installing PouchDB on Node for Windows gave many headaches, specifically with the leveldown dep. 

Since v3.2.1 leveldown was changed to be an *optional dependency*: this way, npm will not refuse installing PouchDB even when having compiling errors. That way, you can use PouchDB normally, and will get an error only when trying to use leveldown as the backend. To avoid that, you can specify any compatible adapter, as pointed in the [Adapters](/adapters.html#pouchdb_in_node_js) section.

For example, if you want a SQLite backend, you can install:

{% highlight bash %}
npm install sqlite3
npm install sqldown
{% endhighlight %}

and then use PouchDB with:

```js
var db = new PouchDB('database', { db: require('sqldown') });

```

Also, you have the option to use [leveldown-prebuilt](https://github.com/mafintosh/leveldown-prebuilt), which avoids native leveldown building when installing. Then for use leveldown-prebuilt as backend, you can install:

{% highlight bash %}
npm install leveldown-prebuilt
{% endhighlight %}

and instance your PouchDB like this:

```js
var db = new PouchDB('database', { db: require('leveldown-prebuilt') });

```

[es5shim]: https://github.com/es-shims/es5-shim
[sqlite]: https://github.com/brodysoft/Cordova-SQLitePlugin
