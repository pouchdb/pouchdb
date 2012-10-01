/*
 Copyright 2012 Facebook Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/* Compiled File */

(function (window, undefined) {
  var indexedDB = window.indexedDB = window.indexedDB || window.mozIndexedDB ||
    window.webkitIndexedDB || window.msIndexedDB || { polyfill : true };


  if (!indexedDB.polyfill) return;

  console.warn('This browser most likely does not support IndexedDB API. Initializing custom IndexedDB' +
    ' implementation using Web SQL Database API.');


  // Configuration
  indexedDB.SCHEMA_TABLE = "__IndexedDBSchemaInfo__";
  indexedDB.DB_PREFIX = "__IndexedDB__";
  //indexedDB.CURSOR_CHUNK_SIZE = 10;

  // Data types
  indexedDB.DOMStringList = function () { };
  indexedDB.DOMStringList.prototype = [];
  indexedDB.DOMStringList.constructor = indexedDB.DOMStringList;
  indexedDB.DOMStringList.prototype.contains = function (str) {
    return this.indexOf(str) >= 0;
  };

  // Util
  var util = indexedDB.util = new (function () {
    this.async = function (fn, async) {
      if (async == null || async) w_setTimeout(fn, 0);
      else fn();
    };

    this.error = function (name, message, innerError) {
      return {
        name : name,
        message : message,
        inner : innerError
      }
    };

    this.event = function (type, target) {
      return {
        type : type,
        target : target,
        currentTarget : target,
        preventDefault : function () { },
        stopPropagation : function () { }
      };
    };

    this.fireErrorEvent = function (request, error) {
      request.error = error;
      if (request.onerror == null) return;

      request.onerror(this.event("error", request));
    };

    this.fireSuccessEvent = function (request, result) {
      if (arguments.length === 2) request.result = result;
      if (request.onsuccess == null) return;

      request.onsuccess(this.event("success", request));
    };

    this.validateKeyPath = function (keyPath) {
      if (keyPath === "") return "";
      if (keyPath == null) return null;

      var r = /^([^\d\W]\w*\.)+$/i;
      if (keyPath instanceof Array) {
        var i = keyPath.length;
        if (i == 0) throw this.error("SyntaxError");

        while (i--) {
          if (!r.test(keyPath[i] + ".")) throw this.error("SyntaxError");
        }
        return keyPath;
      }
      if (!r.test(keyPath + ".")) throw this.error("SyntaxError");
      return keyPath;
    };

    this.arrayRemove = function (array, item) {
      var i = array.indexOf(item);
      if (i > -1) array.splice(i, 1);
    };

    this.indexTable = function (objectStoreName, name) {
      if (arguments.length == 1 && (objectStoreName instanceof this.IDBIndex)) {
        name = objectStoreName.name;
        objectStoreName = objectStoreName.objectStore.name;
      }
      return indexedDB.DB_PREFIX + "Index__" + objectStoreName + "__" + name;
    };

    this.extractKeyFromValue = function (keyPath, value) {
      var key;
      if (keyPath instanceof Array) {
        key = [];
        for (var i = 0; i < keyPath.length; i++) {
          key.push(this.extractKeyFromValue(keyPath[i], value));
        }
      }
      else {
        if (keyPath === "") return value;

        key = value;
        var paths = keyPath.split(".");
        for (var i = 0; i < paths.length; i++) {
          if (key == null) return null;
          key = key[paths[i]];
        }
      }
      return key;
    };

    this.validateKeyOrRange = function (key) {
      if (key == null) return null;
      if (!(key instanceof this.IDBKeyRange)) {
        key = this.encodeKey(key);
        if (key === null) throw this.error("DataError");
      }
      return key;
    };

    this.wait = function (conditionFunc, bodyFunc, async) {
      var me = this;
      this.async(function () {
          if (conditionFunc()) bodyFunc();
          else {
            w_setTimeout(function () {
              me.wait(conditionFunc, bodyFunc);
            }, 10);
          }
        },
        async);
    };
  });


  // Classes
  var IDBVersionChangeEvent = window.IDBVersionChangeEvent = indexedDB.util.IDBVersionChangeEvent =
    function (type, target, oldVersion, newVersion) {
      this.type = type;
      this.target = this.currentTarget = target;
      this.oldVersion = oldVersion;
      this.newVersion = newVersion;
    };

  var IDBDatabaseException = window.IDBDatabaseException = indexedDB.util.IDBDatabaseException =
  {
    ABORT_ERR : 8,
    CONSTRAINT_ERR : 4,
    DATA_ERR : 5,
    NON_TRANSIENT_ERR : 2,
    NOT_ALLOWED_ERR : 6,
    NOT_FOUND_ERR : 3,
    QUOTA_ERR : 11,
    READ_ONLY_ERR : 9,
    TIMEOUT_ERR : 10,
    TRANSACTION_INACTIVE_ERR : 7,
    UNKNOWN_ERR : 1,
    VERSION_ERR : 12
  };


  // Cached
  var w_setTimeout = window.setTimeout;


  /* IDBCursor */
  var IDBCursor = util.IDBCursor = window.IDBCursor = function (source, direction, request) {
    this.source = source;
    this.direction = direction || IDBCursor.NEXT;
    this.key = null;        // position
    this.primaryKey = null; // effective key

    this._request = request;
    this._range = null;
    this._gotValue = true;
    this._effectiveKeyEncoded = null;
  };

  IDBCursor.prototype.update = function (value) {
    var objectStore = getObjectStore(this);
    IDBTransaction._assertNotReadOnly(objectStore.transaction);
    if (!(this instanceof util.IDBCursorWithValue) || !this._gotValue) throw util.error("InvalidStateError");
    if (objectStore.keyPath != null) {
      var key = util.extractKeyFromValue(objectStore.keyPath, value);
      if (key != this.primaryKey) throw util.error("DataError");
    }
    var request = new util.IDBRequest(this);
    var me = this;
    objectStore.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      objectStore._insertOrReplaceRecord(
        {
          request : request,
          sqlTx : sqlTx,
          nextRequestCallback : nextRequestCallback,
          noOverwrite : false,
          value : value,
          encodedKey : me._effectiveKeyEncoded
        });
    });
    return request;
  };

  IDBCursor.prototype.advance = function (count) {
    count = parseInt(count);
    if (isNaN(count) || count <= 0) throw util.error("TypeError");

    advanceOrContinue(this, count, null);
  };

  IDBCursor.prototype.continue = function (key) {
    advanceOrContinue(this, 1, key);
  };

  IDBCursor.prototype.delete = function () {
    var objectStore = getObjectStore(this);
    IDBTransaction._assertNotReadOnly(objectStore.transaction);
    if (!(this instanceof util.IDBCursorWithValue) || !this._gotValue) throw util.error("InvalidStateError");

    var request = new util.IDBRequest(this);
    var me = this;
    objectStore.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      objectStore._deleteRecord(sqlTx, me._effectiveKeyEncoded,
        function () {
          util.fireSuccessEvent(request);
          nextRequestCallback();
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
          nextRequestCallback();
        });
    });
    return request;
  };

  // Internal methods
  function advanceOrContinue(me, count, key) {
    if (!me._gotValue) throw util.error("InvalidStateError");
    me._gotValue = false;

    var filter = util.IDBKeyRange._clone(me._range);
    filter.count = count;
    var isSourceIndex = me.source instanceof util.IDBIndex;
    var position = me.key;
    var noDuplicate = [IDBCursor.PREV_NO_DUPLICATE, IDBCursor.NEXT_NO_DUPLICATE].indexOf(me.direction) >= 0;
    if (key != null) {
      if (isDesc(me)) {
        if ((isSourceIndex && key > position) || key >= position) throw util.error("DataError");
        filter.upper = key;
        filter.upperOpen = false;
      }
      else {
        if ((isSourceIndex && key < position) || key <= position) throw util.error("DataError");
        filter.lower = key;
        filter.lowerOpen = false;
      }
    }
    else if (position != null) {
      var open = !isSourceIndex || noDuplicate;
      if (isDesc(me)) {
        filter.upper = position;
        filter.upperOpen = open;
      }
      else {
        filter.lower = position;
        filter.lowerOpen = open;
      }
    }
    if (isSourceIndex) iterateIndexCursor(me, filter);
    else iterateCursor(me, filter);
  }

  function iterateCursor(me, filter) {
    var tx = me.source.transaction;
    me._request.readyState = util.IDBRequest.LOADING;
    tx._queueOperation(function (sqlTx, nextRequestCallback) {
      var sql = ["SELECT hex(key) 'key', value FROM [" + me.source.name + "]"];
      var where = [];
      var args = [];
      if (filter.lower != null) {
        where.push("(key >" + (filter.lowerOpen ? "" : "=") + " X'" + util.encodeKey(filter.lower) + "')");
      }
      if (filter.upper != null) {
        where.push("(key <" + (filter.upperOpen ? "" : "=") + " X'" + util.encodeKey(filter.upper) + "')");
      }
      if (where.length > 0) {
        sql.push("WHERE", where.join(" AND "))
      }
      sql.push("ORDER BY key" + (isDesc(me) ? " DESC" : ""));
      sql.push("LIMIT", filter.count);

      sqlTx.executeSql(sql.join(" "), args,
        function (tx, results) {
          var request = me._request;
          request.readyState = util.IDBRequest.DONE;
          if (results.rows.length < filter.count) {
            me.key = me.primaryKey = me._effectiveKeyEncoded = undefined;
            if (typeof me.value !== "undefined") me.value = undefined;
            request.result = null;
          }
          else {
            var found = results.rows.item(filter.count - 1);
            me._effectiveKeyEncoded = found.key;
            me.key = me.primaryKey = util.decodeKey(found.key);
            if (typeof me.value !== "undefined") me.value = w_JSON.parse(found.value);
            me._gotValue = true;
            request.result = me;
          }
          util.fireSuccessEvent(request);
          nextRequestCallback();
        },
        function (tx, error) {
          util.fireErrorEvent(me._request, error);
          nextRequestCallback();
        });
    });
  }

  function iterateIndexCursor(me, filter) {
    var tx = me.source.objectStore.transaction;
    me._request.readyState = util.IDBRequest.LOADING;
    tx._queueOperation(function (sqlTx, nextRequestCallback) {
      var withValue = me instanceof IDBCursorWithValue;
      var desc = isDesc(me);
      var objectStoreName = me.source.objectStore.name;
      var tableName = util.indexTable(objectStoreName, me.source.name);
      var sql = ["SELECT hex(i.key) 'key', hex(i.primaryKey) 'primaryKey'" + (withValue ? ", t.value" : ""),
        "FROM [" + tableName + "] as i"];

      if (withValue) {
        sql.push("LEFT JOIN [" + objectStoreName + "] as t ON t.Id = i.recordId");
      }
      var where = [], args = [], encoded;
      if (filter.lower != null) {
        encoded = util.encodeKey(filter.lower);
        if (filter.lowerOpen) {
          where.push("(i.key > X'" + encoded + "')");
        }
        else {
          if (me._effectiveKeyEncoded == null || desc) {
            where.push("(i.key >= X'" + encoded + "')");
          }
          else {
            where.push("((i.key > X'" + encoded + "') OR (i.key = X'" + encoded +
              "' AND i.primaryKey > X'" + me._effectiveKeyEncoded + "'))");
          }
        }
      }
      if (filter.upper != null) {
        encoded = util.encodeKey(filter.upper);
        if (filter.upperOpen) {
          where.push("(i.key < X'" + encoded + "')");
        }
        else {
          if (me._effectiveKeyEncoded == null || !desc) {
            where.push("(i.key <= X'" + encoded + "')");
          }
          else {
            where.push("((i.key < X'" + encoded + "') OR (i.key = X'" + encoded +
              "' AND i.primaryKey < X'" + me._effectiveKeyEncoded + "'))");
          }
        }
      }
      if (where.length > 0) {
        sql.push("WHERE", where.join(" AND "))
      }
      var sDesc = desc ? " DESC" : "";
      sql.push("ORDER BY i.key" + sDesc + ", i.primaryKey" + sDesc);
      sql.push("LIMIT", filter.count);

      sqlTx.executeSql(sql.join(" "), args,
        function (sqlTx, results) {
          var request = me._request;
          request.readyState = util.IDBRequest.DONE;
          if (results.rows.length < filter.count) {
            me.key = me.primaryKey = me._effectiveKeyEncoded = undefined;
            if (typeof me.value !== "undefined") me.value = undefined;
            request.result = null;
          }
          else {
            var found = results.rows.item(filter.count - 1);
            me.key = util.decodeKey(found.key);
            me._effectiveKeyEncoded = found.primaryKey;
            me.primaryKey = util.decodeKey(found.primaryKey);
            if (typeof me.value !== "undefined") me.value = w_JSON.parse(found.value);
            me._gotValue = true;
            request.result = me;
          }
          util.fireSuccessEvent(request);
          nextRequestCallback();
        },
        function (_, error) {
          util.fireErrorEvent(me._request, error);
          nextRequestCallback();
        });
    });
  }

  // Utils
  var w_JSON = window.JSON;

  function isDesc(cursor) {
    return [IDBCursor.PREV, IDBCursor.PREV_NO_DUPLICATE].indexOf(cursor.direction) >= 0;
  }

  function getObjectStore(cursor) {
    if (cursor.source instanceof util.IDBObjectStore) {
      return cursor.source;
    }
    else if (cursor.source instanceof util.IDBIndex) {
      return cursor.source.objectStore;
    }
    return null;
  }

  IDBCursor.NEXT = "next";
  IDBCursor.NEXT_NO_DUPLICATE = "nextunique";
  IDBCursor.PREV = "prev";
  IDBCursor.PREV_NO_DUPLICATE = "prevunique";

  var IDBCursorWithValue = function (source, direction, request) {
    IDBCursor.apply(this, arguments);
    this.value = null;
  };
  IDBCursorWithValue.prototype = new IDBCursor();
  IDBCursorWithValue.prototype.constructor = IDBCursorWithValue;
  util.IDBCursorWithValue = window.IDBCursorWithValue = IDBCursorWithValue;

  /* IDBDatabase */
  var IDBDatabase = util.IDBDatabase = window.IDBDatabase = function (name, webdb) {
    this.name = name;
    this.version = null;
    this.objectStoreNames = new indexedDB.DOMStringList();
    this.onabort = null;
    this.onerror = null;
    this.onversionchange = null;

    this._webdb = webdb;
    this._objectStores = null;  // TODO: ObjectStores are specific to IDBTransaction
    this._closePending = false;
    this._activeTransactionCounter = 0;
    this._closed = false;
  };

  IDBDatabase.prototype.createObjectStore = function (name, optionalParameters) {
    IDBTransaction._assertVersionChange(this._versionChangeTransaction);
    // Validate existence of ObjectStore
    if (this.objectStoreNames.indexOf(name) >= 0) {
      throw util.error("ConstraintError");
    }

    var params = optionalParameters || { };
    var keyPath = util.validateKeyPath(params.keyPath);
    var autoIncrement = params.autoIncrement && params.autoIncrement != false || false;

    if (autoIncrement && (keyPath === "" || (keyPath instanceof Array))) {
      throw util.error("InvalidAccessError");
    }
    return createObjectStore(this, name, keyPath, autoIncrement);
  };

  IDBDatabase.prototype.deleteObjectStore = function (name) {
    var tx = this._versionChangeTransaction;
    IDBTransaction._assertVersionChange(tx);
    if (this.objectStoreNames.indexOf(name) == -1) {
      throw util.error("NotFoundError");
    }
    util.arrayRemove(this.objectStoreNames, name);
    var objectStore = this._objectStores[name];
    delete this._objectStores[name];
    var me = this;
    var errorCallback = function () {
      me.objectStoreNames.push(name);
      me._objectStores[name] = objectStore;
    };
    tx._queueOperation(function (sqlTx, nextRequestCallback) {
      sqlTx.executeSql("DROP TABLE [" + name + "]", null, null, errorCallback);
      sqlTx.executeSql("DELETE FROM " + indexedDB.SCHEMA_TABLE + " WHERE type = 'table' AND name = ?",
        [name], null, errorCallback);

      nextRequestCallback();
    });
  };

  IDBDatabase.prototype.transaction = function (storeNames, mode) {
    // TODO: 4.2.1. throw InvalidStateError if a transaction being creating within transaction callback
    if (storeNames instanceof Array || storeNames == null) {
      if (storeNames.length == 0) throw util.error("InvalidAccessError");
    }
    else {
      storeNames = [storeNames.toString()];
    }
    for (var i = 0; i < storeNames.length; i++) {
      if (!this.objectStoreNames.contains(storeNames[i])) throw util.error("NotFoundError");
    }
    if (this._closePending || this._closed) throw util.error("InvalidStateError");
    return new util.IDBTransaction(this, storeNames, mode || util.IDBTransaction.READ_ONLY);
  };

  IDBDatabase.prototype.close = function () {
    this._closePending = true;
    needDBClose(this);
  };

  IDBDatabase.prototype._loadObjectStores = function (sqlTx, successCallback, errorCallback) {
    var me = this;
    sqlTx.executeSql("SELECT * FROM " + indexedDB.SCHEMA_TABLE +
      " ORDER BY type DESC", null,
      function (sqlTx, resultSet) {
        me._objectStores = { };
        var item, objectStore;
        for (var i = 0; i < resultSet.rows.length; i++) {
          item = resultSet.rows.item(i);
          if (item.type == "table") {
            me.objectStoreNames.push(item.name);
            objectStore = new util.IDBObjectStore(item.name, w_JSON.parse(item.keyPath), item.autoInc);
            objectStore._metaId = item.id;
            me._objectStores[item.name] = objectStore;
          }
          else if (item.type == "index") {
            for (var name in me._objectStores) {
              objectStore = me._objectStores[name];
              if (objectStore._metaId == item.tableId) break;
            }
            objectStore.indexNames.push(item.name);
            objectStore._indexes[item.name] = new util.IDBIndex(objectStore,
              item.name, item.keyPath, item.unique, item.multiEntry)
          }
        }
        if (successCallback) successCallback();
      },
      function (_, error) {
        if (errorCallback) errorCallback(error);
      });
  };

  IDBDatabase.prototype._transactionCompleted = function () {
    this._activeTransactionCounter--;
    needDBClose(this);
  };

  // Utils
  var w_JSON = window.JSON;

  function createObjectStore(me, name, keyPath, autoIncrement) {
    var objectStore = new util.IDBObjectStore(name, keyPath, autoIncrement, me._versionChangeTransaction);
    me.objectStoreNames.push(name);
    me._objectStores[name] = objectStore;
    var errorCallback = function () {
      util.arrayRemove(me.objectStoreNames, name);
      delete me._objectStores[name];
    };
    me._versionChangeTransaction._queueOperation(function (sqlTx, nextRequestCallback) {
      sqlTx.executeSql("CREATE TABLE [" + name + "] (id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "key BLOB UNIQUE, value BLOB)", null, null, errorCallback);

      sqlTx.executeSql("CREATE INDEX INDEX_" + name + "_key ON [" + name + "] (key)", null, null, errorCallback);

      sqlTx.executeSql("INSERT INTO " + indexedDB.SCHEMA_TABLE +
        " (type, name, keyPath, autoInc) VALUES ('table', ?, ?, ?)",
        [name, w_JSON.stringify(keyPath), autoIncrement ? 1 : 0],
        function (sqlTx, results) {
          objectStore._metaId = results.insertId;
        },
        errorCallback);

      nextRequestCallback();
    });
    return objectStore;
  }

  function needDBClose(me) {
    if (me._closePending && me._activeTransactionCounter == 0) {
      me._closePending = false;
      me._closed = true;
      indexedDB._notifyConnectionClosed(me);
    }
  }

  /* IDBFactory */
  var origin = { };

  indexedDB.open = function (name, version) {
    if (arguments.length == 2 && version == undefined) throw util.error("TypeError");
    if (version !== undefined) {
      version = parseInt(version.valueOf());
      if (isNaN(version) || version <= 0)
        throw util.error("TypeError", "The method parameter is missing or invalid.");
    }
    var request = new util.IDBOpenDBRequest(null);
    util.async(function () {
      request.readyState = util.IDBRequest.DONE;
      runStepsForOpeningDB(name, version, request);
    });
    return request;
  };

  function runStepsForOpeningDB(name, version, request) {
    var sqldb = util.openDatabase(name);
    if (sqldb.version !== "" && isNaN(parseInt(sqldb.version))) // sqldb.version is corrupt
    {
      util.fireErrorEvent(request, util.error("VersionError"));
      return;
    }

    var connection = new util.IDBDatabase(name, sqldb);
    var oldVersion = sqldb.version == "" ? 0 : parseInt(sqldb.version);
    connection.version = (version === undefined) ? (oldVersion === 0 ? 1 : oldVersion) : version;
    var database = getOriginDatabase(name);

    util.wait(function () {
        // www.w3.org/TR/IndexedDB 4.1.3
        if (database.deletePending) return false;
        for (var i = 0; i < database.connections.length; i++) {
          if (database.connections[i]._versionChangeTransaction != null) return false;
        }
        return true;
      },
      function () {
        if (oldVersion < connection.version) {
          runStepsForVersionChangeTransaction(request, connection, oldVersion);
        }
        else if (oldVersion == connection.version) {
          openVersionMatch(request, connection, sqldb);
        }
        else {
          util.fireErrorEvent(request, util.error("VersionError"));
        }
      });
  }

  function runStepsForVersionChangeTransaction(request, connection, oldVersion) {
    fireVersionChangeEvent(request, connection.name, oldVersion, connection.version);
    util.wait(function () {
        return getOriginDatabase(name).connections.length == 0;
      },
      function () {
        startVersionChangeTransaction(request, connection, oldVersion);
      });
  }

  function startVersionChangeTransaction(request, connection, oldVersion) {
    var database = getOriginDatabase(connection.name);
    database.connections.push(connection);
    var tx = new util.IDBTransaction(connection, [], util.IDBTransaction.VERSION_CHANGE);
    if (oldVersion == 0) {
      tx._queueOperation(function (sqlTx, nextRequestCallback) {
        sqlTx.executeSql("CREATE TABLE [" + indexedDB.SCHEMA_TABLE + "] (" +
          "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
          "type TEXT NOT NULL, " +
          "name TEXT NOT NULL, " +
          "keyPath TEXT, " +
          "currentNo INTEGER NOT NULL DEFAULT 1, " +
          // specific to tables
          "autoInc BOOLEAN, " +
          // specific to indexes
          "tableId INTEGER, " +
          "[unique] BOOLEAN, " +
          "multiEntry BOOLEAN, " +
          "UNIQUE (type, name) ON CONFLICT ROLLBACK)");

        nextRequestCallback();
      });
    }
    tx._queueOperation(function (sqlTx, nextRequestCallback) {
      connection._loadObjectStores(sqlTx,
        function () {
          request.result = connection;
          if (request.onupgradeneeded) {
            request.transaction = connection._versionChangeTransaction = tx;
            var e = new util.IDBVersionChangeEvent("onupgradeneeded",
              request, oldVersion, connection.version);
            request.onupgradeneeded(e);
          }
          nextRequestCallback();
        },
        function (error) {
          nextRequestCallback();
        });
    });
    tx.onabort = function (e) {
      request.error = tx.error;
      connection._versionChangeTransaction = null;
      if (request.onerror) request.onerror(util.event("abort", request));
    };
    tx.onerror = function (e) {
      request.transaction = connection._versionChangeTransaction = null;
      util.fireErrorEvent(request, tx.error);
    };
    tx.oncomplete = function (e) {
      request.transaction = connection._versionChangeTransaction = null;
      util.fireSuccessEvent(request);
    };
  }

  function openVersionMatch(request, connection, sqldb) {
    sqldb.transaction(
      function (sqlTx) {
        connection._loadObjectStores(sqlTx);
      },
      function (error) {
        util.fireErrorEvent(request, error);
      },
      function () {
        util.fireSuccessEvent(request, connection);
      }
    );
  }

  // IDBFactory.deleteDatabase
  indexedDB.deleteDatabase = function (name) {
    // INFO: There is no way to delete database in Web SQL Database API.
    var database = getOriginDatabase(name);
    database.deletePending = true;
    var request = new util.IDBOpenDBRequest(null);
    util.async(function () {
      request.readyState = util.IDBRequest.DONE;
      var sqldb = util.openDatabase(name);
      if (sqldb.version == "") {
        database.deletePending = false;
        util.fireSuccessEvent(request);
      }
      else {
        fireVersionChangeEvent(request, name, parseInt(sqldb.version), null);
        util.wait(function () {
            return database.connections.length == 0;
          },
          function () {
            deleteDatabase(request, sqldb, database);
          });
      }
    });
    return request;
  };

  // IDBFactory.cmp
  indexedDB.cmp = function (first, second) {
    first = util.encodeKey(first);
    second = util.encodeKey(second);
    return first > second ? 1 : (first == second ? 0 : -1);
  };

  indexedDB._notifyConnectionClosed = function (connection) {
    var database = getOriginDatabase(connection.name);
    var i = database.connections.indexOf(connection);
    if (i >= 0) database.connections.splice(i, 1);
  };

  // Utils
  function getOriginDatabase(name) {
    var db = origin[name];
    if (db == null) {
      db = {
        name : name,
        deletePending : false,
        connections : []    // openDatabases
      };
      origin[name] = db;
    }
    return db;
  }

  function fireVersionChangeEvent(request, name, oldVersion, newVersion) {
    var database = getOriginDatabase(name);
    var anyOpenConnection = false;
    for (var i = 0; i < database.connections.length; i++) {
      var conn = database.connections[i];
      if (conn._closePending) continue;

      anyOpenConnection = true;
      var event = new util.IDBVersionChangeEvent("versionchange", request, oldVersion, newVersion);
      if (conn.onversionchange) conn.onversionchange(event);
    }
    if (anyOpenConnection) {
      var event = new util.IDBVersionChangeEvent("blocked", request, oldVersion, newVersion);
      if (request.onblocked) request.onblocked(event);
    }
  }

  function deleteDatabase(request, sqldb, database) {
    sqldb.changeVersion(sqldb.version, "",
      function (sqlTx) {
        sqlTx.executeSql("SELECT a.type, a.name, b.name 'table' FROM " + indexedDB.SCHEMA_TABLE +
          " a LEFT JOIN " + indexedDB.SCHEMA_TABLE + " b ON a.type = 'index' AND a.tableId = b.Id",
          null,
          function (sqlTx, results) {
            var name;
            for (var i = 0; i < results.rows.length; i++) {
              var item = results.rows.item(i);
              name = item.type == 'table' ? item.name : util.indexTable(item.table, item.name);
              sqlTx.executeSql("DROP TABLE [" + name + "]");
            }
            sqlTx.executeSql("DROP TABLE " + indexedDB.SCHEMA_TABLE);
          });
      },
      function (error) {
        database.deletePending = false;
        util.fireErrorEvent(request, error);
      },
      function () {
        database.deletePending = false;
        util.fireSuccessEvent(request);
      });
  }

  /* IDBIndex */
  var IDBIndex = util.IDBIndex = window.IDBIndex = function (objectStore, name, keyPath, unique, multiEntry) {
    this.objectStore = objectStore;
    this.name = name;
    this.keyPath = keyPath;
    this.unique = unique;
    this.multiEntry = multiEntry;

    this._ready = true;
  };

  IDBIndex.prototype.openCursor = function (range, direction) {
    return performOpeningCursor(this, util.IDBCursorWithValue, range, direction);
  };

  IDBIndex.prototype.openKeyCursor = function (range, direction) {
    return performOpeningCursor(this, util.IDBCursor, range, direction);
  };

  IDBIndex.prototype.get = function (key) {
    var encodedKeyOrRange = util.validateKeyOrRange(key);
    var request = new util.IDBRequest(this);
    var me = this;
    this.objectStore.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var sql = ["SELECT s.value FROM [" + util.indexTable(me) + "] AS i INNER JOIN"];
      sql.push("[" + me.objectStore.name + "] AS s ON s.id = i.recordId");
      if (encodedKeyOrRange instanceof util.IDBKeyRange) {
        sql.push("WHERE", encodedKeyOrRange._getSqlFilter("i.key"));
      }
      else if (encodedKeyOrRange != null) {
        sql.push("WHERE (i.key = X'" + encodedKeyOrRange + "')");
      }
      sql.push("ORDER BY i.key, i.primaryKey LIMIT 1");
      sqlTx.executeSql(sql.join(" "), null,
        function (_, results) {
          util.fireSuccessEvent(request, results.rows.length > 0 ?
            w_JSON.parse(results.rows.item(0).value) : undefined)
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
        });

      nextRequestCallback();
    });
    return request;
  };

  IDBIndex.prototype.getKey = function (key) {
    var encodedKeyOrRange = util.validateKeyOrRange(key);
    var request = new util.IDBRequest(this);
    var me = this;
    this.objectStore.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var sql = ["SELECT hex(primaryKey) 'primaryKey' FROM [" + util.indexTable(me) + "]"];
      if (encodedKeyOrRange instanceof util.IDBKeyRange) {
        sql.push("WHERE", encodedKeyOrRange._getSqlFilter());
      }
      else if (encodedKeyOrRange != null) {
        sql.push("WHERE (key = X'" + encodedKeyOrRange + "')");
      }
      sql.push("LIMIT 1");
      sqlTx.executeSql(sql.join(" "), null,
        function (_, results) {
          util.fireSuccessEvent(request, results.rows.length > 0 ?
            util.decodeKey(results.rows.item(0).primaryKey) : undefined);
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
        });

      nextRequestCallback();
    });
    return request;
  };

  IDBIndex.prototype.count = function (key) {
    var encodedKeyOrRange = util.validateKeyOrRange(key);
    var request = new util.IDBRequest(this);
    var me = this;
    this.objectStore.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var sql = ["SELECT COUNT(recordId) AS 'count' FROM [" + util.indexTable(me) + "]"];
      if (encodedKeyOrRange instanceof util.IDBKeyRange) {
        sql.push("WHERE", encodedKeyOrRange._getSqlFilter());
      }
      else if (encodedKeyOrRange != null) {
        sql.push("WHERE (key = X'" + encodedKeyOrRange + "')");
      }
      sqlTx.executeSql(sql.join(" "), null,
        function (_, results) {
          util.fireSuccessEvent(request, results.rows.item(0).count);
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
        });

      nextRequestCallback();
    });
    return request;
  };

  // Utils
  var w_JSON = window.JSON;

  function performOpeningCursor(me, cursorType, range, direction) {
    var request = new util.IDBRequest(me);
    var cursor = new cursorType(me, direction, request);
    cursor._range = util.IDBKeyRange._ensureKeyRange(range);
    cursor.continue();
    return request;
  }

  /* IDBKeyRange */
  var IDBKeyRange = util.IDBKeyRange = window.IDBKeyRange = function (lower, upper, lowerOpen, upperOpen) {
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen || false;
    this.upperOpen = upperOpen || false;
  };

  IDBKeyRange.only = function (value) {
    return new IDBKeyRange(value, value, false, false)
  };

  IDBKeyRange.lowerBound = function (lower, open) {
    return new IDBKeyRange(lower, undefined, open || false, true);
  };

  IDBKeyRange.upperBound = function (upper, open) {
    return new IDBKeyRange(undefined, upper, true, open || false);
  };

  IDBKeyRange.bound = function (lower, upper, lowerOpen, upperOpen) {
    return new IDBKeyRange(lower, upper, lowerOpen || false, upperOpen || false);
  };

  IDBKeyRange._ensureKeyRange = function (arg) {
    if (arg == null) {
      return util.IDBKeyRange.bound();
    }
    if ((arg instanceof util.IDBKeyRange)) {
      return arg;
    }
    return util.IDBKeyRange.only(arg);
  };

  IDBKeyRange._clone = function (range) {
    return util.IDBKeyRange.bound(range.lower, range.upper, range.lowerOpen, range.upperOpen);
  };

  IDBKeyRange.prototype._getSqlFilter = function (keyColumnName) {
    if (keyColumnName == undefined) keyColumnName = "key";
    var sql = [], hasLower = this.lower != null, hasUpper = this.upper != null;
    if (this.lower == this.upper) {
      sql.push("(" + keyColumnName + " = X'" + util.encodeKey(this.lower) + "')");
    }
    else {
      if (hasLower) {
        sql.push("(X'" + util.encodeKey(this.lower) + "' <" +
          (this.lowerOpen ? "" : "=") + " " + keyColumnName + ")");
      }
      if (hasUpper) {
        sql.push("(" + keyColumnName + " <" +
          (this.upperOpen ? "" : "=") + " X'" + util.encodeKey(this.upper) + "')");
      }
    }
    return sql.join(" AND ");
  };

  /* IDBObjectStore */
  var IDBObjectStore = util.IDBObjectStore = window.IDBObjectStore = function (name, keyPath, autoIncrement, tx) {
    this.name = name;
    this.keyPath = keyPath;
    this.indexNames = new indexedDB.DOMStringList();
    this.transaction = tx;
    this.autoIncrement = autoIncrement == true;

    this._metaId = null;
    this._indexes = { };
  };

  IDBObjectStore.prototype.put = function (value, key) {
    return storeRecord(this, value, key, false);
  };

  IDBObjectStore.prototype.add = function (value, key) {
    return storeRecord(this, value, key, true);
  };

  //region add & put helper functions
  function storeRecord(me, value, key, noOverwrite) {
    util.IDBTransaction._assertNotReadOnly(me.transaction);
    var validation = validateObjectStoreKey(me.keyPath, me.autoIncrement, value, key);

    var request = new util.IDBRequest(me);
    me.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var context = {
        request : request,
        sqlTx : sqlTx,
        nextRequestCallback : nextRequestCallback,
        noOverwrite : noOverwrite,
        value : value,
        key : validation.key,
        encodedKey : validation.encodedKey
      };
      runStepsForStoringRecord(context);
    });
    return request;
  }

  function validateObjectStoreKey(keyPath, autoIncrement, value, key) {
    var key = key, encodedKey;
    if (keyPath != null) {
      if (key != null) throw util.error("DataError");

      key = util.extractKeyFromValue(keyPath, value);
    }
    if (key == null) {
      if (!autoIncrement) throw util.error("DataError");
    }
    else {
      encodedKey = util.encodeKey(key);
      if (encodedKey === null) throw util.error("DataError");
    }
    return { key : key, encodedKey : encodedKey };
  }

  function runStepsForStoringRecord(context) {
    var request = context.request, key = context.key;
    var me = request.source;
    request.readyState = util.IDBRequest.DONE;
    if (me.autoIncrement && (key == null || isPositiveFloat(key))) {
      context.sqlTx.executeSql("SELECT currentNo FROM " + indexedDB.SCHEMA_TABLE +
        " WHERE type='table' AND name = ?", [me.name],
        function (sqlTx, results) {
          if (results.rows.length != 1) {
            // error
          }
          var currentNo = results.rows.item(0).currentNo;
          if (key == null) {
            context.key = key = currentNo;
            context.encodedKey = util.encodeKey(key);
            if (me.keyPath != null) assignKeyToValue(context.value, me.keyPath, key);
          }
          if (key >= currentNo) incrementCurrentNumber(sqlTx, me.name, Math.floor(key + 1));
          context.sqlTx = sqlTx;
          me._insertOrReplaceRecord(context);
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
          context.nextRequestCallback();
        });
    }
    else {
      me._insertOrReplaceRecord(context);
    }
  }

  function incrementCurrentNumber(sqlTx, tableName, currentNo) {
    sqlTx.executeSql("UPDATE " + indexedDB.SCHEMA_TABLE + " SET currentNo = ? " +
      "WHERE type='table' AND name = ?", [currentNo, tableName]);
  }

  function assignKeyToValue(value, keyPath, key) {
    if (!(value instanceof Object) && !(value instanceof Array)) throw util.error("DataError");

    var path = keyPath.split(".");
    var attr = null;
    for (var i = 0; i < path.length - 1; i++) {
      attr = path[i];
      if (value[attr] == null) value[attr] = { };
      value = value[attr];
    }
    value[path[path.length - 1]] = key;

  }

  function storeIndexes(context) {
    var request = context.request;
    var me = context.objectStore;
    var indexes = [], strKeys = [];
    for (var indexName in me._indexes) {
      var index = me._indexes[indexName];
      if (!index._ready) continue;

      var strKey = getValidIndexKeyString(index, context.value);
      if (strKey == null) continue;

      strKeys.push(strKey);
      indexes.push(index);
    }

    if (indexes.length == 0) {
      util.fireSuccessEvent(request, context.key);
      context.nextRequestCallback();
    }
    else {
      var lastIndex = indexes.length - 1;
      for (var i = 0; i < indexes.length; i++) {
        storeIndex(context, indexes[i], strKeys[i], i == lastIndex);
      }
    }
  }

  function getValidIndexKeyString(index, value) {
    var key = util.extractKeyFromValue(index.keyPath, value);
    if (key == null) return null;

    if (key instanceof Array) {
      if (key.length == 0) return null;
    }
    var encodedKey = util.encodeKey(key);
    if (encodedKey === null) return null;

    if (index.multiEntry && (key instanceof Array)) {
      // clean-up
      var tmp = [];
      for (var i = 0; i < key.length; i++) {
        encodedKey = util.encodeKey(key[i]);
        if (encodedKey === null || tmp.indexOf(encodedKey) >= 0) continue;
        tmp.push(encodedKey);
      }
      if (tmp.length == 0) return null;
      return tmp;
    }
    return encodedKey;
  }

  function storeIndex(context, index, encodedKey, isLast) {
    var indexTable = util.indexTable(index.objectStore.name, index.name);

    var sql = ["INSERT INTO", indexTable, "(recordId, key, primaryKey)"];
    var args = [];
    if (index.multiEntry && (encodedKey instanceof Array)) {
      var select = [];
      for (var i = 0; i < encodedKey.length; i++) {
        sql.push("SELECT ?, X'" + encodedKey[i] + "', X'" + context.encodedKey + "'");
        args.push(context.recordId);
      }
      sql.push(select.join(" UNION ALL "))
    }
    else {
      sql.push("VALUES (?, X'" + encodedKey + "', X'" + context.encodedKey + "')");
      args.push(context.recordId);
    }
    var request = context.request;
    context.sqlTx.executeSql(sql.join(" "), args,
      function (_, results) {
        if (!isLast) return;

        util.fireSuccessEvent(request, context.key);
        context.nextRequestCallback();
      },
      function (_, error) {
        util.fireErrorEvent(request, error);
        context.nextRequestCallback();
      });
  }

  //endregion

  IDBObjectStore.prototype.delete = function (key) {
    util.IDBTransaction._assertNotReadOnly(this.transaction);
    key = util.validateKeyOrRange(key);
    var request = new util.IDBRequest(this);
    var me = this;
    this.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      me._deleteRecord(sqlTx, key,
        function () {
          util.fireSuccessEvent(request);
          nextRequestCallback();
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
          nextRequestCallback();
        });
    });
    return request;
  };

  IDBObjectStore.prototype.get = function (key) {
    var encodedKeyOrRange = util.validateKeyOrRange(key);
    var request = new util.IDBRequest(this);
    var me = this;
    me.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var where = "", args = [];
      if (encodedKeyOrRange instanceof util.IDBKeyRange) {
        where = "WHERE " + encodedKeyOrRange._getSqlFilter();
      }
      else if (encodedKeyOrRange != null) {
        where = "WHERE (key = X'" + encodedKeyOrRange + "')";
      }

      sqlTx.executeSql("SELECT [value] FROM [" + me.name + "] " + where + " LIMIT 1", args,
        function (_, results) {
          util.fireSuccessEvent(request, results.rows.length > 0 ?
            w_JSON.parse(results.rows.item(0).value) : undefined)
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
        });

      nextRequestCallback();
    });
    return request;
  };

  IDBObjectStore.prototype.clear = function () {
    util.IDBTransaction._assertNotReadOnly(this.transaction);
    var request = new util.IDBRequest(this);
    var me = this;
    this.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var errorCallback = function (_, error) {
        util.fireErrorEvent(request, error);
      };
      for (var indexName in me._indexes) {
        var tableName = util.indexTable(me._indexes[indexName]);
        sqlTx.executeSql("DELETE FROM [" + tableName + "]", null, null, errorCallback);
      }
      sqlTx.executeSql("DELETE FROM [" + me.name + "]", null,
        function (_, results) {
          util.fireSuccessEvent(request, undefined);
        },
        errorCallback);
    });
    return request;
  };

  IDBObjectStore.prototype.openCursor = function (range, direction) {
    var request = new util.IDBRequest(this);
    var cursor = new util.IDBCursorWithValue(this, direction, request);
    cursor._range = util.IDBKeyRange._ensureKeyRange(range);
    cursor.continue();
    return request;
  };

  IDBObjectStore.prototype.createIndex = function (name, keyPath, optionalParameters) {
    util.IDBTransaction._assertVersionChange(this.transaction);
    if (this.indexNames.indexOf(name) >= 0) {
      throw util.error("ConstraintError");
    }
    var keyPath = util.validateKeyPath(keyPath);
    var params = optionalParameters || { };
    var unique = params.unique && params.unique != false || false;
    var multiEntry = params.multiEntry && params.multiEntry != false || false;

    if (keyPath instanceof Array && multiEntry) {
      throw util.error("NotSupportedError");
    }
    return createIndex(this, name, keyPath, unique, multiEntry);
  };

  IDBObjectStore.prototype.index = function (name) {
    if (!this.transaction._active) {
      throw util.error("InvalidStateError");
    }
    var index = this._indexes[name];
    if (index == null) {
      throw util.error("NotFoundError");
    }
    return index;
  };

  IDBObjectStore.prototype.deleteIndex = function (indexName) {
    util.IDBTransaction._assertVersionChange(this.transaction);
    if (this.indexNames.indexOf(indexName) == -1) {
      throw util.error("ConstraintError");
    }
    util.arrayRemove(this.indexNames, indexName);
    var index = this._indexes[indexName];
    delete this._indexes[indexName];
    var me = this;
    var errorCallback = function (_, sqlError) {
      me.indexNames.push(indexName);
      me._indexes[indexName] = index;
    };
    this.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      sqlTx.executeSql("DROP TABLE " + util.indexTable(me.name, indexName), null, null, errorCallback);

      sqlTx.executeSql("DELETE FROM " + indexedDB.SCHEMA_TABLE + " WHERE type = 'index' AND name = ?",
        [indexName], null, errorCallback);

      nextRequestCallback();
    });
  };

  IDBObjectStore.prototype.count = function (key) {
    var encodedKeyOrRange = util.validateKeyOrRange(key);
    var request = new util.IDBRequest(this);
    var me = this;
    this.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var where = "", args = [];
      if (encodedKeyOrRange instanceof util.IDBKeyRange) {
        where = "WHERE " + encodedKeyOrRange._getSqlFilter();
      }
      else if (encodedKeyOrRange != null) {
        where = "WHERE (key = X'" + encodedKeyOrRange + "')";
      }
      sqlTx.executeSql("SELECT COUNT(id) AS 'count' FROM [" + me.name + "] " + where, args,
        function (_, results) {
          util.fireSuccessEvent(request, results.rows.item(0).count);
        },
        function (_, error) {
          util.fireErrorEvent(request, error);
        });

      nextRequestCallback();
    });
    return request;
  };

  IDBObjectStore.prototype._deleteRecord = function (sqlTx, encodedKeyOrRange, onsuccess, onerror) {
    var objectStore = this;
    var sql, where;
    if (encodedKeyOrRange instanceof util.IDBKeyRange) {
      where = "WHERE " + encodedKeyOrRange._getSqlFilter();
    }
    else {
      where = "WHERE (key = X'" + encodedKeyOrRange + "')";
    }
    for (var indexName in objectStore._indexes) {
      var index = objectStore._indexes[indexName];
      sql = ["DELETE FROM [" + util.indexTable(objectStore.name, index.name) + "]"];
      if (where) {
        sql.push("WHERE recordId IN (SELECT id FROM [" + objectStore.name + "]", where + ")");
      }
      sqlTx.executeSql(sql.join(" "), null, null, onerror);
    }
    sqlTx.executeSql("DELETE FROM [" + objectStore.name + "] " + where, null, onsuccess, onerror);
  };

  IDBObjectStore.prototype._insertOrReplaceRecord = function (context) {
    var request = context.request;
    if (!context.noOverwrite) {
      this._deleteRecord(context.sqlTx, context.encodedKey, null,
        function (_, error) {
          util.fireErrorEvent(request, error);
          context.nextRequestCallback();
        });
    }
    var me = this;
    var encodedValue = w_JSON.stringify(context.value);
    context.sqlTx.executeSql("INSERT INTO [" + me.name + "] (key, value) VALUES (X'" + context.encodedKey + "', ?)",
      [encodedValue],
      function (sqlTx, results) {
        request.result =
          context.objectStore = me;
        context.sqlTx = sqlTx;
        context.recordId = results.insertId;
        storeIndexes(context);
      },
      function (_, error) {
        util.fireErrorEvent(request, error);
        context.nextRequestCallback();
      });
  };

  // Utils
  var w_JSON = window.JSON;

  function isPositiveFloat(value) {
    return typeof value == "number" && value > 0;
  }

  function createIndex(me, name, keyPath, unique, multiEntry) {
    var index = new util.IDBIndex(me, name, keyPath, unique, multiEntry);
    index._ready = false;
    me.indexNames.push(name);
    me._indexes[name] = index;
    var errorCallback = function () {
      util.arrayRemove(me.indexNames, name);
      delete me._indexes[name];
    };
    me.transaction._queueOperation(function (sqlTx, nextRequestCallback) {
      var indexTable = util.indexTable(me.name, name);
      sqlTx.executeSql("CREATE TABLE " + indexTable + " (recordId INTEGER, key BLOB" +
        (unique ? " UNIQUE" : "") + ", primaryKey BLOB)", null, null, errorCallback);

      sqlTx.executeSql("CREATE INDEX INDEX_" + indexTable + "_key ON [" + indexTable + "] (key)",
        null, null, errorCallback);

      sqlTx.executeSql("INSERT INTO " + indexedDB.SCHEMA_TABLE +
        " (name, type, keyPath, tableId, [unique], multiEntry) VALUES (?, 'index', ?, " +
        "(SELECT Id FROM " + indexedDB.SCHEMA_TABLE + " WHERE type = 'table' AND name = ?), ?, ?)",
        [name, w_JSON.stringify(keyPath), me.name, unique ? 1 : 0, multiEntry ? 1 : 0],
        null, errorCallback);

      sqlTx.executeSql("SELECT id, hex(key) 'key', value FROM [" + me.name + "]", null,
        function (sqlTx, results) {
          if (results.rows.length == 0) return;

          var sql = ["INSERT INTO [" + util.indexTable(me.name, name) + "]"];
          var select = [], args = [];
          for (var i = 0; i < results.rows.length; i++) {
            var item = results.rows.item(i);
            var encodedKey = getValidIndexKeyString(index, w_JSON.parse(item.value));
            if (encodedKey == null) continue;

            if (index.multiEntry && (encodedKey instanceof Array)) {
              for (var j = 0; j < encodedKey.length; j++) {
                select.push("SELECT ?, X'" + encodedKey[j] + "', X'" + item.key + "'");
                args.push(item.id);
              }
            }
            else {
              select.push("SELECT ?, X'" + encodedKey + "', X'" + item.key + "'");
              args.push(item.id);
            }
          }
          sql.push(select.join(" UNION ALL "));
          sqlTx.executeSql(sql.join(" "), args, null,
            function (_, error) {
              throw util.error("AbortError");
            });
        });

      index._ready = true;
      nextRequestCallback();
    });
    return index;
  }

  /* IDBRequest */
  var IDBRequest = util.IDBRequest = window.IDBRequest = function (source) {
    this.result = undefined;
    this.error = null;
    this.source = source;
    this.transaction = null;
    this.readyState = util.IDBRequest.LOADING;
    this.onsuccess = null;
    this.onerror = null;
  };
  IDBRequest.LOADING = "pending";
  IDBRequest.DONE = "done";

  var IDBOpenDBRequest = util.IDBOpenDBRequest = window.IDBOpenDBRequest = function (source) {
    IDBRequest.apply(this, arguments);
    this.onblocked = null;
    this.onupgradeneeded = null;
  };
  IDBOpenDBRequest.prototype = new IDBRequest();
  IDBOpenDBRequest.prototype.constructor = IDBOpenDBRequest;

  /* IDBTransaction */
  var IDBTransaction = util.IDBTransaction = window.IDBTransaction = function (db, storeNames, mode) {
    this.db = db;
    this.mode = mode;
    this.onabort = null;
    this.oncomplete = null;
    this.onerror = null;

    this._active = true;
    this._requests = [];
    var sqldb = this.db._webdb;

    // Main
    db._activeTransactionCounter++;

    var txFn;
    if (mode === IDBTransaction.READ_ONLY) txFn = sqldb.readTransaction;
    else if (mode === IDBTransaction.READ_WRITE) txFn = sqldb.transaction;
    else if (mode === IDBTransaction.VERSION_CHANGE) {
      txFn = function (x, y, z) { sqldb.changeVersion(sqldb.version, db.version, x, y, z); };
    }

    var me = this;
    txFn && txFn.call(sqldb,
      function (sqlTx) { performOperation(me, sqlTx, 0); },
      function (sqlError) {
        db.close();

        db._transactionCompleted();

        me.error = util.error("AbortError", null, sqlError);
        if (me.onabort) me.onabort(util.event("abort", me));
      },
      function () {
        db._transactionCompleted();

        if (me.oncomplete) me.oncomplete(util.event("success", me));
      });
  };

  function performOperation(me, sqlTx, operationIndex) {
    if (!me._active) return;

    if (operationIndex >= me._requests.length) {
      me._active = false;
      me._requests = [];
      /*for (var name in me.db._objectStores)
       {
       me.db._objectStores[name].transaction = null;
       }*/
      return;
    }
    me._requests[operationIndex](sqlTx, function () {
      performOperation(me, sqlTx, operationIndex + 1);
    });
  }

  IDBTransaction.prototype.objectStore = function (name) {
    validateActive(this);
    var objectStore = this.db._objectStores[name];
    if (objectStore) {
      objectStore.transaction = this;
      return objectStore;
    }
    else {
      throw util.error("NotFoundError");
    }
  };

  IDBTransaction.prototype.abort = function () {
    if (!this._active) throw util.error("InvalidStateError");
    this._queueOperation(function (sqlTx, nextRequestCallback) {
      throw util.error("AbortError");
    });
  };

  IDBTransaction.prototype._queueOperation = function (sqlTxCallback) {
    validateActive(this);
    this._requests.push(sqlTxCallback);
  };

  IDBTransaction._assertNotReadOnly = function (tx) {
    if (tx.mode === util.IDBTransaction.READ_ONLY) {
      throw util.error("ReadOnlyError", "A mutation operation was attempted in a READ_ONLY transaction.");
    }
  };

  IDBTransaction._assertVersionChange = function (tx) {
    if (!tx || tx.mode !== util.IDBTransaction.VERSION_CHANGE) {
      throw util.error("InvalidStateError");
    }
  };

  IDBTransaction.READ_ONLY = "readonly";
  IDBTransaction.READ_WRITE = "readwrite";
  IDBTransaction.VERSION_CHANGE = "versionchange";

  // Utils
  function validateActive(me) {
    if (!me._active) throw new util.error("TransactionInactiveError");
  }

  /* key.js */
  var ARRAY_TERMINATOR = { };
  var BYTE_TERMINATOR = 0;
  var TYPE_NUMBER = 1;
  var TYPE_DATE = 2;
  var TYPE_STRING = 3;
  var TYPE_ARRAY = 4;
  var MAX_TYPE_BYTE_SIZE = 12; // NOTE: Cannot be greater than 255

  util.encodeKey = function (key) {
    var stack = [key], writer = new HexStringWriter(), type = 0, dataType, obj;
    while ((obj = stack.pop()) !== undefined) {
      if (type % 4 === 0 && type + TYPE_ARRAY > MAX_TYPE_BYTE_SIZE) {
        writer.write(type);
        type = 0;
      }
      dataType = typeof obj;
      if (obj instanceof Array) {
        type += TYPE_ARRAY;
        if (obj.length > 0) {
          stack.push(ARRAY_TERMINATOR);
          var i = obj.length;
          while (i--) stack.push(obj[i]);
          continue;
        }
        else {
          writer.write(type);
        }
      }
      else if (dataType === "number") {
        type += TYPE_NUMBER;
        writer.write(type);
        encodeNumber(writer, obj);
      }
      else if (obj instanceof Date) {
        type += TYPE_DATE;
        writer.write(type);
        encodeNumber(writer, obj.valueOf());
      }
      else if (dataType === "string") {
        type += TYPE_STRING;
        writer.write(type);
        encodeString(writer, obj);
      }
      else if (obj === ARRAY_TERMINATOR) {
        writer.write(BYTE_TERMINATOR);
      }
      else return null;
      type = 0;
    }
    return writer.trim().toString();
  };

  util.decodeKey = function (encodedKey) {
    var rootArray = []; // one-element root array that contains the result
    var parentArray = rootArray;
    var type, arrayStack = [], depth, tmp;
    var reader = new HexStringReader(encodedKey);
    while (reader.read() != null) {
      if (reader.current === 0) // end of array
      {
        parentArray = arrayStack.pop();
        continue;
      }
      if (reader.current === null) {
        return rootArray[0];
      }
      do
      {
        depth = reader.current / 4 | 0;
        type = reader.current % 4;
        for (var i = 0; i < depth; i++) {
          tmp = [];
          parentArray.push(tmp);
          arrayStack.push(parentArray);
          parentArray = tmp;
        }
        if (type === 0 && reader.current + TYPE_ARRAY > MAX_TYPE_BYTE_SIZE) {
          reader.read();
        }
        else break;
      } while (true);

      if (type === TYPE_NUMBER) {
        parentArray.push(decodeNumber(reader));
      }
      else if (type === TYPE_DATE) {
        parentArray.push(new Date(decodeNumber(reader)));
      }
      else if (type === TYPE_STRING) {
        parentArray.push(decodeString(reader));
      }
      else if (type === 0) // empty array case
      {
        parentArray = arrayStack.pop();
      }
    }
    return rootArray[0];
  };

  // Utils
  var p16 = 0x10000;
  var p32 = 0x100000000;
  var p48 = 0x1000000000000;
  var p52 = 0x10000000000000;
  var pNeg1074 = 5e-324;                      // 2^-1074);
  var pNeg1022 = 2.2250738585072014e-308;     // 2^-1022

  function ieee754(number) {
    var s = 0, e = 0, m = 0;
    if (number !== 0) {
      if (isFinite(number)) {
        if (number < 0) {
          s = 1;
          number = -number;
        }
        var p = 0;
        if (number >= pNeg1022) {
          var n = number;
          while (n < 1) {
            p--;
            n *= 2;
          }
          while (n >= 2) {
            p++;
            n /= 2;
          }
          e = p + 1023;
        }
        m = e ? Math.floor((number / Math.pow(2, p) - 1) * p52) : Math.floor(number / pNeg1074);
      }
      else {
        e = 0x7FF;
        if (isNaN(number)) {
          m = 2251799813685248; // QNan
        }
        else {
          if (number === -Infinity) s = 1;
        }
      }
    }
    return { sign : s, exponent : e, mantissa : m };
  }

  function encodeNumber(writer, number) {
    var number = ieee754(number);
    if (number.sign) {
      number.mantissa = p52 - 1 - number.mantissa;
      number.exponent = 0x7FF - number.exponent;
    }
    var word, m = number.mantissa;

    writer.write((number.sign ? 0 : 0x80) | (number.exponent >> 4));
    writer.write((number.exponent & 0xF) << 4 | (0 | m / p48));

    m %= p48;
    word = 0 | m / p32;
    writer.write(word >> 8, word & 0xFF);

    m %= p32;
    word = 0 | m / p16;
    writer.write(word >> 8, word & 0xFF);

    word = m % p16;
    writer.write(word >> 8, word & 0xFF);
  }

  function decodeNumber(reader) {
    var b = reader.read() | 0;
    var sign = b >> 7 ? false : true;

    var s = sign ? -1 : 1;

    var e = (b & 0x7F) << 4;
    b = reader.read() | 0;
    e += b >> 4;
    if (sign) e = 0x7FF - e;

    var tmp = [sign ? (0xF - (b & 0xF)) : b & 0xF];
    var i = 6;
    while (i--) tmp.push(sign ? (0xFF - (reader.read() | 0)) : reader.read() | 0);

    var m = 0;
    i = 7;
    while (i--) m = m / 256 + tmp[i];
    m /= 16;

    if (m === 0 && e === 0) return 0;
    return (m + 1) * Math.pow(2, e - 1023) * s;
  }

  var secondLayer = 0x3FFF + 0x7F;

  function encodeString(writer, string) {
    /* 3 layers:
     Chars 0         - 7E            are encoded as 0xxxxxxx with 1 added
     Chars 7F        - (3FFF+7F)     are encoded as 10xxxxxx xxxxxxxx with 7F subtracted
     Chars (3FFF+80) - FFFF          are encoded as 11xxxxxx xxxxxxxx xx000000
     */
    for (var i = 0; i < string.length; i++) {
      var code = string.charCodeAt(i);
      if (code <= 0x7E) {
        writer.write(code + 1);
      }
      else if (code <= secondLayer) {
        code -= 0x7F;
        writer.write(0x80 | code >> 8, code & 0xFF);
      }
      else {
        writer.write(0xC0 | code >> 10, code >> 2 | 0xFF, (code | 3) << 6);
      }
    }
    writer.write(BYTE_TERMINATOR);
  }

  function decodeString(reader) {
    var buffer = [], layer = 0, unicode = 0, count = 0, $byte, tmp;
    while (true) {
      $byte = reader.read();
      if ($byte === 0 || $byte == null) break;

      if (layer === 0) {
        tmp = $byte >> 6;
        if (tmp < 2) {
          buffer.push(String.fromCharCode($byte - 1));
        }
        else // tmp equals 2 or 3
        {
          layer = tmp;
          unicode = $byte << 10;
          count++;
        }
      }
      else if (layer === 2) {
        buffer.push(String.fromCharCode(unicode + $byte + 0x7F));
        layer = unicode = count = 0;
      }
      else // layer === 3
      {
        if (count === 2) {
          unicode += $byte << 2;
          count++;
        }
        else // count === 3
        {
          buffer.push(String.fromCharCode(unicode | $byte >> 6));
          layer = unicode = count = 0;
        }
      }
    }
    return buffer.join("");
  }

  var HexStringReader = function (string) {
    this.current = null;

    var string = string;
    var lastIndex = string.length - 1;
    var index = -1;

    this.read = function () {
      return this.current = index < lastIndex ? parseInt(string[++index] + string[++index], 16) : null;
    }
  };

  var HexStringWriter = function () {
    var buffer = [], c;
    this.write = function ($byte) {
      for (var i = 0; i < arguments.length; i++) {
        c = arguments[i].toString(16);
        buffer.push(c.length === 2 ? c : c = "0" + c);
      }
    };
    this.toString = function () {
      return buffer.length ? buffer.join("") : null;
    };
    this.trim = function () {
      var length = buffer.length;
      while (buffer[--length] === "00");
      buffer.length = ++length;
      return this;
    }
  };

  /* webSql.js */
  var DEFAULT_DB_SIZE = 5 * 1024 * 1024;

  util.openDatabase = function (name) {
    return new Database(window.openDatabase(indexedDB.DB_PREFIX + name, "", "IndexedDB " + name, DEFAULT_DB_SIZE));
  };

  var Database_prototype = function (db) {
    var db = db;

    this.version = db && db.version;

    this.transaction = function (callback, errorCallback, successCallback) {
      db.transaction(function (tx) {
          if (callback) callback(new Transaction(tx));
        },
        function (error) {
          if (errorCallback) errorCallback(wrapSqlError(error));
        },
        function () {
          if (successCallback) successCallback();
        });
    };

    this.readTransaction = function (callback, errorCallback, successCallback) {
      db.readTransaction(function (tx) {
          if (callback) callback(new Transaction(tx));
        },
        function (error) {
          if (errorCallback) errorCallback(wrapSqlError(error));
        },
        function () {
          if (successCallback) successCallback();
        });
    };

    this.changeVersion = function (oldVersion, newVersion, callback, errorCallback, successCallback) {
      db.changeVersion(oldVersion, newVersion,
        function (tx) {
          if (callback) callback(new Transaction(tx));
        },
        function (error) {
          if (errorCallback) errorCallback(wrapSqlError(error));
        },
        function () {
          if (successCallback) successCallback();
        });
    };
  };

  var Database = function (db) {
    Database_prototype.call(this, db);
  };
  Database.prototype = new Database_prototype();
  Database.prototype.constructor = Database;


  var Transaction_prototype = function (tx) {
    var tx = tx;

    this.executeSql = function (sql, args, callback, errorCallback) {
      //console.log("[SQL]: %s; args: %o", sql, args);
      tx.executeSql(sql, args,
        function (tx, resultSet) {
          if (callback) callback(new Transaction(tx), resultSet);
        },
        function (tx, error) {
          console.error("[SQL Error]: ", error);
          if (errorCallback) errorCallback(new Transaction(tx), wrapSqlError(error));
        });
    }
  };

  var Transaction = function (tx) {
    Transaction_prototype.call(this, tx);
  };
  Transaction.prototype = new Transaction_prototype();
  Transaction.prototype.constructor = Transaction;

  // Utils
  function wrapSqlError(error) {
    // UnknownError
    if (error == null || error.message == null) return util.error("UnknownError", undefined, error);

    var msg = error.message.toLowerCase();

    // ConstraintError
    if (msg.indexOf("constraint failed") >= 0 || msg.indexOf("is not unique")) {
      return util.error("ConstraintError");
    }
  }

}(window));
