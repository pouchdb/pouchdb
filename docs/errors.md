---
layout: learn
title: PouchDB, the JavaScript Database that Syncs!
---

# Common Errors

### PouchDB is throwing `InvalidStateError`

Are you in private browsing mode? IndexedDB is [disabled in private browsing mode](https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB) of Firefox.

### Can't open second database on Android WebView/Cordova/Phone Gap

There is a limit of one database per app in Android Webview. Istall the [SQLite plugin](https://github.com/lite4cordova/Cordova-SQLitePlugin), PouchDB will use that if it is available.