---
layout: 2ColLeft
title: Common Errors
sidebar: nav.html
---

### No 'Access-Control-Allow-Origin' header

If you see the error:

> XMLHttpRequest cannot load [...]
> No 'Access-Control-Allow-Origin' header is present on the requested resource.
> Origin [...] is therefore not allowed access.

it's because you need to enable [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS) on CouchDB/IrisCouch/whatever you're using. Otherwise, your scripts can only access the server database if they're served from the same domain.

To enable CORS, just run the following commands on a command prompt (Mac/Linux) and substitute your user name, password, and the URL of your database:

```
HOST=http://adminname:password@localhost:5984 # or whatever you got

curl -X POST $HOST/_config/httpd/enable_cors -d '"true"'
curl -X PUT $HOST/_config/cors/origins -d '"*"'
curl -X PUT $HOST/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT $HOST/_config/cors/headers -d '"accept, content-type, origin"'
```

### iOS/Safari: "there was not enough remaining storage space"

On iOS and Safari, if you expect your app to use more than 5MB of space, you will need to request the space up-front from the user.  In certain versions, notably Safari/iOS 7, you can never request more than what the user originally grants you.

![Safari storage quota popup](static/img/safari_popup.png)

To get around this, when you create your PouchDB, use the `opts.size` option for the expected _maximum_ size of the database in MB.  Valid increments are 10, 50, 100, 500, and 1000.  For instance, if you request 50, then Safari will show a popup saying "allow 50MB?" but if you request 51, then Safari will show a popup saying "allow 100MB?".

If you don't use the `size` option, then you'll be able to use up to 5MB without any popup, but then once you use more, there will be a popup asking for 10.

```js
new PouchDB('mydb', {size: 10}); // request 10 MB with a popup
new PouchDB('mydb', {size: 50}); // request 50 MB with a popup
new PouchDB('mydb'); // implicitly request 5 MB, no popup until you exceed 5MB
```

This does not affect any backend other than Web SQL. Chrome, Android, and Opera do not show the popup. On PhoneGap/Cordova apps, you can also use the [SQLite plugin][sqlite] to get around this problem. Here's [more information about storage quotas](http://www.html5rocks.com/en/tutorials/offline/quota-research) and [details on the Safari/iOS 7 bug](https://github.com/pouchdb/pouchdb/issues/2347).

### PouchDB throws 404 (Object Not Found) for '_local' document

Don't worry, nothing is amiss, this is expected behaviour:
During PouchDB's initial replication PouchDB will check for a checkpoint, if it doesn't exist a 404 will be returned and a checkpoint will subsequently be written.

### PouchDB is throwing `InvalidStateError`

Are you in private browsing mode? IndexedDB is [disabled in private browsing mode](https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB) in Firefox.

### Can't open second database on Android WebView with Cordova/Phone Gap

There is a limit of one database per app in some versions of the Android WebView. Install the [SQLite plugin][sqlite], then PouchDB will use that if it is available.

  [sqlite]: https://github.com/lite4cordova/Cordova-SQLitePlugin

### Database size limitation of ~5MB on iOS with Cordova/Phone Gap

If you're storing large amounts of data, such as PNG attachments, the [SQLite plugin][sqlite] is again your friend. (See [issue #1260](https://github.com/daleharvey/pouchdb/issues/1260) for details.)

### CouchDB returns a 404 for GETs from a CouchApp

Certain URL rewrites are broken by PouchDB's cache-busting; try adding `{cache : false}` to the PouchDB constructor. (See [issue #1233](https://github.com/daleharvey/pouchdb/issues/1233) for details.)

### Uncaught TypeError: object is not a function

Did you include the [es6-promise shim library](https://github.com/jakearchibald/es6-promise)?  Not every browser implements ES6 Promises correctly. (See [issue #1747](https://github.com/daleharvey/pouchdb/issues/1747) for details.)

### SyntaxError: Parse error (Cordova on Android)

Did you include the [es5-shim library](https://github.com/es-shims/es5-shim)?  PouchDB is written in ES5, which is supported by modern browsers, but requires shims for older browsers (e.g. IE 9, Android 2.1 WebView).

In Android, if you're loading PouchDB directly via `webView.loadUrl('javascript://' + js')`, you should prefer the minified PouchDB javascript file to the unminified one, since code comments can also cause parse errors.

### PouchDB object fails silently (Safari)

Safari requires users to confirm that they want to allow an app to store data locally ("Allow this website to use space on your disk?").  If PouchDB is loaded in an `iframe` or some other unusual way, the dialog might not be shown, and the database will silently fail.

### window.localStorage is not available (Chrome apps)

In Chrome apps, you'll see the warning "window.localStorage is not available in packaged apps. Use chrome.storage.local instead."  This is harmless; since PouchDB doesn't use localStorage if it's not available.