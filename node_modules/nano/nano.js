/* minimal couch in node
 *
 * copyright 2011 nuno job <nunojob.com> (oO)--',--
 *
 * licensed under the apache license, version 2.0 (the "license");
 * you may not use this file except in compliance with the license.
 * you may obtain a copy of the license at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * unless required by applicable law or agreed to in writing, software
 * distributed under the license is distributed on an "as is" basis,
 * without warranties or conditions of any kind, either express or implied.
 * see the license for the specific language governing permissions and
 * limitations under the license.
 */
var request     = require('request').defaults({ jar: false })
  , fs          = require('fs')
  , qs          = require('querystring')
  , u           = require('url')
  , errs        = require('errs')
  , follow
  , nano
  ;

try { follow = require('follow'); } catch (err) {}

function isEmpty(object) {
  for(var property in object) {
    if(object.hasOwnProperty(property)) return false; }
  return true;
}

/*
 * nano is a library that helps you building requests to couchdb
 * that is built on top of mikeal/request
 *
 * no more, no less
 * be creative. be silly. have fun! relax (and don't forget to compact).
 *
 * dinosaurs spaceships!
 *
 */
module.exports = exports = nano = function database_module(cfg) {
  var public_functions = {}
    , request_opts     = {}
    , logging
    , path
    , path_array
    , db
    , auth
    , port
    ;

 /***************************************************************************
  * relax                                                                   *
  ***************************************************************************/
 /*
  * relax
  *
  * base for all request using nano
  * this function assumes familiarity with the couchdb api
  *
  * e.g.
  * nano.request( { db: "alice"
  *               , doc: "rabbit"
  *               , method: "GET"
  *               , params: { rev: "1-967a00dff5e02add41819138abb3284d"}
  *               },
  *   function (_,b) { console.log(b) });
  *
  * @error {request:socket} problem connecting to couchdb
  * @error {couch:*} an error proxied from couchdb
  *
  * @param {opts:object|string} request options;
  *          e.g. {db: "test", method: "GET"}
  *        {opts.db:string} database name
  *        {opts.method:string:optional} http method, defaults to "GET"
  *        {opts.path:string:optional} a full path, override `doc` and `att`
  *        {opts.doc:string:optional} document name
  *        {opts.att:string:optional} attachment name
  *        {opts.headers:object:optional} additional http headers
  *        {opts.content_type:string:optional} content type, default to json
  *        {opts.body:object|string|binary:optional} document or attachment
  *        body
  *        {opts.encoding:string:optional} encoding for attachments
  * @param {callback:function:optional} function to call back
  */
  function relax(opts,callback) {
    // most simple case is no opts, which returns the root
    if(typeof opts === "function") {
      callback = opts;
      opts     = {path: ""};
    }

    // string is the same as a simple get request to that path
    if(typeof opts === 'string') {
      opts = {path: opts};
    }

    // no opts, meaning stream root
    if(!opts) {
      opts     = {path: ""};
      callback = null;
    }

    var log     = logging()
      , params  = opts.params
      , headers = { "content-type": "application/json"
                  , "accept"      : "application/json"
                  }
      , req     = { method  : (opts.method || "GET")
                  , headers : headers
                  , uri     : cfg.url }
      , status_code
      , parsed
      , rh
      ;

    // cookie jar support
    // check github.com/mikeal/request for docs
    if (opts.jar) {
      req.jar = opts.jar;
    }

    if(opts.db) {
      req.uri = u.resolve(req.uri, opts.db);
    }

    if (opts.headers) {
      for (var k in opts.headers) {
        req.headers[k] = opts.headers[k];
      }
    }

    if(opts.path) {
      req.uri += "/" + opts.path;
    }
    else if(opts.doc)  {
      // not a design document
      if(!/^_design/.test(opts.doc)) {
        try {
          req.uri += "/" + encodeURIComponent(opts.doc);
        }
        catch (error) {
          return errs.handle(errs.merge(error,
            { "message": "couldnt encode: "+(opts && opts.doc)+" as an uri"
            , "scope"  : "nano"
            , "errid"  : "encode_uri"
            }), callback);
        }
      }
      else {
        // design document
        req.uri += "/" + opts.doc;
      }

      if(opts.att) {
        req.uri += "/" + opts.att;
      }
    }

    if(opts.encoding !== undefined && callback) {
      req.encoding = opts.encoding;
      delete req.headers["content-type"];
      delete req.headers.accept;
    }

    if(opts.content_type) {
      req.headers["content-type"] = opts.content_type;
      delete req.headers.accept; // undo headers set
    }

    if(cfg.cookie) {
      req.headers["X-CouchDB-WWW-Authenticate"] = "Cookie";
      req.headers.cookie = cfg.cookie;
    }

    // these need to be encoded
    if(!isEmpty(params)) {
      try {
        ['startkey', 'endkey', 'key', 'keys'].forEach(function (key) {
          if (key in params) {
            try { params[key] = JSON.stringify(params[key]); }
            catch (err) {
              return errs.handle(errs.merge(err,
                { "message": "bad params: " + key + " = " + params[key]
                , "scope"  : "nano"
                , "errid"  : "encode_keys"
                }), callback);
            }
          }
        });
      } catch (err6) {
        return errs.handle(errs.merge(err6,
          { "messsage": "params is not an object"
          , "scope"   : "nano"
          , "errid"   : "bad_params"
          }), callback);
      }

      try {
        req.uri += "?" + qs.stringify(params);
      }
      catch (err2) {
        return errs.handle(errs.merge(err2,
           { "message": "invalid params: " + params.toString()
           , "scope"  : "nano"
           , "errid"  : "encode_params"
           }), callback);
      }
    }

    if(opts.body) {
      if (Buffer.isBuffer(opts.body)) {
        req.body = opts.body; // raw data
      }
      else {
        try {
          req.body = JSON.stringify(opts.body, function (key, value) {
            // don't encode functions
            // this allows functions to be given without pre-escaping
            if (typeof(value) === 'function') {
              return value.toString();
            } else {
              return value;
            }
          });
        } catch (err3) {
          return errs.handle(errs.merge(err3,
             { "message": "body seems to be invalid json"
             , "scope"  : "nano"
             , "errid"  : "encode_body"
             }), callback);
        }
      } // json data
    }

    if(opts.form) {
      req.headers['content-type'] = 
        'application/x-www-form-urlencoded; charset=utf-8';
      req.body = qs.stringify(opts.form).toString('utf8');
    }

    log(req);

    // streaming mode
    if(!callback) {
      try {
        return request(req);
      } catch (err4) {
        return errs.handle(errs.merge(err4,
           { "message": "request threw when you tried to stream"
           , "scope"  : "request"
           , "errid"  : "stream"
           }), callback);
      }
    }

    try {
      var stream = request(req, function(e,h,b) {
        // make sure headers exist
        rh = (h && h.headers || {});
        rh['status-code'] = status_code = (h && h.statusCode || 500);
        rh.uri            = req.uri;

        if(e) {
          log({err: 'socket', body: b, headers: rh });
          errs.handle(errs.merge(e,
             { "message": "error happened in your connection"
             , "scope"  : "socket"
             , "errid"  : "request"
             }), callback);
          return stream;
        }

        delete rh.server;
        delete rh['content-length'];

        try { parsed = JSON.parse(b); } catch (err) { parsed = b; }

        if (status_code >= 200 && status_code < 400) {
          log({err: null, body: parsed, headers: rh});
          callback(null,parsed,rh);
          return stream;
        }
        else { // proxy the error directly from couchdb
          log({err: 'couch', body: parsed, headers: rh});
          if (!parsed) {
            parsed = {};
          }
          if (typeof parsed === "string") { // a stacktrace from couch
            parsed = {message: parsed};
          }
          if (!parsed.message && (parsed.reason || parsed.error)) {
            parsed.message = (parsed.reason || parsed.error);
          }
          errs.handle(errs.merge(errs.create(parsed),
             { "scope"       : "couch"
             , "status_code" : status_code
             , "status-code" : status_code
             , "request"     : req
             , "headers"     : rh
             , "errid"       : "non_200"
             , "message"     : parsed.reason || "couch returned "+status_code
             }), callback);
          return stream;
        }
      });
      return stream;
    } catch(err5) {
      return errs.merge(err5,
         { "message": "request threw when you tried to create the object"
         , "scope"  : "request"
         , "errid"  : "callback"
         });
    }
  }

 /***************************************************************************
  * auth                                                                    *
  ***************************************************************************/
  /*
   * gets a session going on for you
   *
   * e.g.
   * nano.auth(username, password, function (err, body, headers) {
   *   if (err) { 
   *     return console.log("oh noes!")
   *   }
   * 
   *   if (headers && headers['set-cookie']) {
   *     console.log("cookie monster likes " + headers['set-cookie']);
   *   }
   * });
   * 
   * @param {username:string} username
   * @param {password:string} password
   *
   * @see relax
   */
  function auth_server(username, password, callback) {
    return relax(
      { method       : "POST"
      , db           : "_session"
      , form         : { "name" : username, "password" : password }
      , content_type : "application/x-www-form-urlencoded; charset=utf-8"
      }, callback);
  }

 /***************************************************************************
  * db                                                                      *
  ***************************************************************************/
 /*
  * creates a couchdb database
  * http://wiki.apache.org/couchdb/HTTP_database_API
  *
  * e.g. function recursive_retries_create_db(tried,callback) {
  *        nano.db.create(db_name, function (e,b) {
  *          if(tried.tried === tried.max_retries) {
  *            callback("Retries work");
  *            return;
  *          }
  *          else {
  *            tried.tried += 1;
  *            recursive_retries_create_db(tried,callback);
  *          }
  *        });
  *      }
  *
  * @param {db_name:string} database name
  *
  * @see relax
  */
  function create_db(db_name, callback) {
    return relax({db: db_name, method: "PUT"},callback);
  }

 /*
  * annihilates a couchdb database
  *
  * e.g. nano.db.destroy(db_name);
  *
  * even though this examples looks sync it is an async function
  *
  * @param {db_name:string} database name
  *
  * @see relax
  */
  function destroy_db(db_name, callback) {
    return relax({db: db_name, method: "DELETE"},callback);
  }

 /*
  * gets information about a couchdb database
  *
  * e.g. nano.db.get(db_name, function(e,b) {
  *        console.log(b);
  *      });
  *
  * @param {db_name:string} database name
  *
  * @see relax
  */
  function get_db(db_name, callback) {
    return relax({db: db_name, method: "GET"},callback);
  }

 /*
  * lists all the databases in couchdb
  *
  * e.g. nano.db.list(function(e,b) {
  *        console.log(b);
  *      });
  *
  * @see relax
  */
  function list_dbs(callback) {
    return relax({db: "_all_dbs", method: "GET"},callback);
  }

 /*
  * compacts a couchdb database
  *
  * e.g. nano.db.compact(db_name);
  *
  * @param {db_name:string} database name
  * @param {design_name:string:optional} design document name
  *
  * @see relax
  */
  function compact_db(db_name, design_name, callback) {
    if(typeof design_name === "function") {
      callback = design_name;
      design_name = null;
    }
    return relax(
      { db: db_name, doc: "_compact", att: design_name
      , method: "POST" }, callback);
  }

 /*
  * couchdb database _changes feed
  *
  * e.g. nano.db.changes(db_name, {since: 2}, function (e,r,h) {
  *        console.log(r);
  *      });
  *
  * @param {db_name:string} database name
  * @param {params:object:optional} additions to the querystring
  *
  * @see relax
  */
  function changes_db(db_name, params, callback) {
    if(typeof params === "function") {
      callback = params;
      params   = {};
    }
    return relax(
      { db: db_name, path: "_changes", params: params
      , method: "GET" }, callback);
  }

  /*
   * couchdb database follow support
   *
   * e.g. var feed = nano.db.follow(db_name, {since: "now"});
   *      feed.on('change', function (change) { console.log(change); });
   *      feed.follow();
   *
   * @param {db_name:string} database name
   * @param {params:object:optional} additions to the querystring
   *   check the follow documentation for the full api
   *   https://github.com/iriscouch/follow
   *
   *
   * @see relax
   */
  function follow_db(db_name, params, callback) {
    if(typeof params === "function") {
      callback = params;
      params   = {};
    }

    // case only db name is given
    params     = params || {};
    params.db  = u.resolve(cfg.url, db_name);

    if(!follow) {
      var stream = errs.handle(
        { "message": "follow is only supported on node 0.6+"
        , "scope"  : "follow"
        , "errid"  : "no_soup_for_you"
        }, callback);
      // streaming mode will call unexisting follow stream
      stream.follow = function () {
        return errs.handle(
          { "message": "follow is only supported on node 0.6+"
          , "scope"  : "follow"
          , "errid"  : "no_soup_for_you"
          }, callback);
      };
      return stream;
    }

    if(typeof callback === "function") {
      return follow(params, callback);
    } else {
      return new follow.Feed(params);
    }
  }

 /*
  * replicates a couchdb database
  *
  * e.g. nano.db.replicate(db_1, db_2);
  *
  * @param {source:string|object} name of the source database, or database
  * @param {target:string|object} name of the target database, or database
  * @param {opts:object:optional} options to the replicator
  *
  * @see relax
  */
  function replicate_db(source, target, opts, callback) {
    if(typeof opts === "function") {
      callback  = opts;
      opts      = {};
    }
    if(typeof target === "object") {
      var target_cfg = target.config || {};
      if(target_cfg.url && target_cfg.db) {
        target = u.resolve(target_cfg.url, target_cfg.db);
      }
      else {
        return errs.handle(errs.create(
          { "message": "replication target is invalid"
          , "scope"  : "nano"
          , "errid"  : "replication_target"
          }), callback);
      }
    }
    if(typeof source === "object") {
      var source_cfg = source.config || {};
      if(source_cfg.url && source_cfg.db) {
        source = u.resolve(source_cfg.url, source_cfg.db);
      }
      else {
        return errs.handle(errs.create(
          { "message": "replication source is invalid"
          , "scope"  : "nano"
          , "errid"  : "replication_source"
          }), callback);
      }
    }
    opts.source = source;
    opts.target = target;
    return relax({db: "_replicate", body: opts, method: "POST"}, callback);
  }

 /****************************************************************************
  * doc                                                                      *
  ***************************************************************************/
  function document_module(db_name) {
    var public_functions = {};

   /*
    * inserts a document in a couchdb database
    * http://wiki.apache.org/couchdb/HTTP_Document_API
    *
    * @param {doc:object|string} document body
    * @param {doc_name:string:optional} document name
    * @param {params:string:optional} additions to the querystring
    *
    * @see relax
    */
    function insert_doc(doc,params,callback) {
      var opts = {db: db_name, body: doc, method: "POST"};

      if(typeof params === "function") {
        callback = params;
        params   = {};
      }

      if(typeof params === "string") {
        params   = {doc_name: params};
      }

      if (params) {
        if(params.doc_name) {
          opts.doc    = params.doc_name;
          opts.method = "PUT";
          delete params.doc_name;
        }
        opts.params = params;
      }

      return relax(opts,callback);
    }

   /*
    * destroy a document from a couchdb database
    *
    * @param {doc_name:string} document name
    * @param {rev:string} previous document revision
    *
    * @see relax
    */
    function destroy_doc(doc_name,rev,callback) {
      return relax(
        { db: db_name, doc: doc_name, method: "DELETE"
        , params: {rev: rev} }, callback);
    }

   /*
    * get a document from a couchdb database
    *
    * e.g. db2.get("foo", {revs_info: true}, function (e,b,h) {
    *        console.log(e,b,h);
    *        return;
    *      });
    *
    * @param {doc_name:string} document name
    * @param {params:object:optional} additions to the querystring
    *
    * @see relax
    */
    function get_doc(doc_name,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      return relax(
        { db: db_name, doc: doc_name, method: "GET"
        , params: params }, callback);
    }

   /*
    * get the head of a document from a couchdb database
    *
    * e.g. db2.head("foo", function (e,b,h) {
    *        console.log(e,b,h);
    *        return;
    *      });
    *
    * @param {doc_name:string} document name
    *
    * @see relax
    */
    function head_doc(doc_name,callback) {
      return relax(
        { db: db_name, doc: doc_name, method: "HEAD"
        , params: {} }, callback);
    }

   /*
    * copy a document to a new document, or overwrite an existing document
    * [1]: http://wiki.apache.org/couchdb/HTTP_Document_API#COPY
    *
    * e.g. db2.copy("source", "target", { overwrite: true }, function(e,b,h) {
    *        console.log(e,b,h);
    *        return;
    *      });
    *
    * @param {doc_src:string} source document name
    * @param {doc_dest:string} destination document name
    * @param {opts:object:optional} set overwrite preference
    *
    * @see relax
    */
    function copy_doc(doc_src, doc_dest, opts, callback) {
      if(typeof opts === "function") {
        callback = opts;
        opts     = {};
      }
      var params =
        { db: db_name, doc: doc_src, method: "COPY"
        , headers: { "Destination": doc_dest } 
        };
      if(opts.overwrite) {
        return head_doc(doc_dest, function (e,b,h) {
          if (typeof h.etag === "string") {
            params.headers.Destination += "?rev=" + 
              h.etag.substring(1, h.etag.length - 1);
          }
          return relax(params, callback);
        });
      } else {
        return relax(params, callback);
      }
    }

   /*
    * lists all the documents in a couchdb database
    *
    * @param {params:object:optional} additions to the querystring
    *
    * @see get_doc
    * @see relax
    */
    function list_docs(params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      return relax(
        { db: db_name, path: "_all_docs", method: "GET"
        , params: params }, callback);
    }

   /*
    * bulk fetch functionality
    * [1]: http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API
    *
    * @param {doc_names:object} document keys as per the couchdb api[1]
    * @param {params:object} additions to the querystring, note 
    * that include_docs is always set to true
    *
    * @see get_doc
    * @see relax
    */
    function fetch_docs(doc_names,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      params.include_docs = true;
      return relax(
        { db: db_name, path: "_all_docs", method: "POST"
        , params: params, body: doc_names }, callback);
    }

   /*
    * calls a view
    *
    * @param {design_name:string} design document name
    * @param {view_name:string} view to call
    * @param {params:object:optional} additions to the querystring
    *
    * @see relax
    */
    function view_docs(design_name,view_name,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      var view_path = '_design/' + design_name + '/_view/'  + view_name;
      if (params.keys) {
        var body = {keys: params.keys};
        delete params.keys;
        return relax({db: db_name, path: view_path
                     , method: "POST", params: params, body: body}, callback);
      }
      else {
        return relax({db: db_name, path: view_path
                     , method: "GET", params: params},callback);
      }
    }

    /*
    * calls a show function
    *
    * @param {design_name:string} design document name
    * @param {show_fn_name:string} show function to call
    * @param {docId:string} id of the doc
    * @param {params:object:optional} additions to the querystring
    *
    * @see relax
    */
    function show_doc(design_name,show_fn_name,docId,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      var show_fn_path = '_design/' + design_name + '/_show/'  + show_fn_name + '/' + docId;
      return relax({db: db_name, path: show_fn_path
                   , method: "GET", params: params},callback);
    }

   /*
    * calls document update handler design document
    *
    *
    * @param {design_name:string} design document name
    * @param {update_name:string} update method to call
    * @param {doc_name:string} document name to update
    * @param {params:object} additions to the querystring
    */
   function update_with_handler_doc(design_name, update_name,
     doc_name, body, callback) {
     if(typeof body === "function") {
       callback = body;
       body     = {};
     }
     var update_path = '_design/' + design_name + '/_update/' +
       update_name + '/' + doc_name;
     return relax(
       { db: db_name, path: update_path, method: "PUT"
       , body: body }, callback);
   }

   /*
    * bulk update/delete/insert functionality
    * [1]: http://wiki.apache.org/couchdb/HTTP_Bulk_Document_API
    *
    * @param {docs:object} documents as per the couchdb api[1]
    * @param {params:object} additions to the querystring
    *
    * @see get_doc
    * @see relax
    */
    function bulk_docs(docs,params,callback) {
     if(typeof params === "function") {
       callback = params;
       params = {};
     }
     return relax(
       { db: db_name, path: "_bulk_docs", body: docs
       , method: "POST", params: params}, callback);
    }

   /**************************************************************************
    * attachment                                                             *
    *************************************************************************/
   /*
    * inserting an attachment
    * [2]: http://wiki.apache.org/couchdb/HTTP_Document_API
    *
    * e.g.
    * db.attachment.insert("new", "att", buffer, "image/bmp", {rev: b.rev},
    *   function(_,response) {
    *     console.log(response);
    * });
    *
    * don't forget that params.rev is required in most cases. only exception
    * is when creating a new document with a new attachment. consult [2] for
    * details
    *
    * @param {doc_name:string} document name
    * @param {att_name:string} attachment name
    * @param {att:buffer} attachment data
    * @param {content_type:string} attachment content-type
    * @param {params:object:optional} additions to the querystring
    *
    * @see relax
    */
    function insert_att(doc_name,att_name,att,content_type,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      return relax(
        { db: db_name, att: att_name, method: "PUT"
        , content_type: content_type, doc: doc_name, params: params
        , body: att}, callback);
    }

   /*
    * get an attachment
    *
    * @param {doc_name:string} document name
    * @param {att_name:string} attachment name
    * @param {params:object:optional} additions to the querystring
    *
    * @see relax
    */
    function get_att(doc_name,att_name,params,callback) {
      if(typeof params === "function") {
        callback = params;
        params   = {};
      }
      return relax({ db: db_name, att: att_name, method: "GET", doc: doc_name
                   , params: params, encoding: null},callback);
    }

   /*
    * destroy an attachment
    *
    * @param {doc_name:string} document name
    * @param {att_name:string} attachment name
    * @param {rev:string} previous document revision
    *
    * @see relax
    */
    function destroy_att(doc_name,att_name,rev,callback) {
      return relax({ db: db_name, att: att_name, method: "DELETE"
                  , doc: doc_name, params: {rev: rev}},callback);
    }

    // db level exports
    public_functions =
      { info              : function(cb) { return get_db(db_name,cb); }
      , replicate         : function(target, opts, cb) {
          return replicate_db(db_name,target,opts,cb);
        }
      , compact           : function(cb) {
          return compact_db(db_name,cb);
        }
      , changes           : function(params,cb) {
          return changes_db(db_name,params,cb);
        }
      , follow            : function(params,cb) {
            return follow_db(db_name,params,cb);
        }
      , auth              : auth_server                      // alias
      , insert            : insert_doc
      , get               : get_doc
      , head              : head_doc
      , copy              : copy_doc
      , destroy           : destroy_doc
      , bulk              : bulk_docs
      , list              : list_docs
      , fetch             : fetch_docs
      , config            : {url: cfg.url, db: db_name}
      , attachment        :
        { insert          : insert_att
        , get             : get_att
        , destroy         : destroy_att
        }
      , show              : show_doc
      , atomic            : update_with_handler_doc
      , updateWithHandler : update_with_handler_doc          // alias
      };

    public_functions.view         = view_docs;
    public_functions.view.compact = function(design_name,cb) {
      return compact_db(db_name,design_name,cb);
    };

    return public_functions;
  }

  // server level exports
  public_functions =
    { db          :
      { create    : create_db
      , get       : get_db
      , destroy   : destroy_db
      , list      : list_dbs
      , use       : document_module   // alias
      , scope     : document_module   // alias
      , compact   : compact_db
      , replicate : replicate_db
      , changes   : changes_db
      , follow    : follow_db
      }
    , use         : document_module
    , scope       : document_module        // alias
    , request     : relax
    , relax       : relax                  // alias
    , dinosaur    : relax                  // alias
    , auth        : auth_server
    };

  // handle different type of configs
  if(typeof cfg === "string") {
    // just an url
    if(/^https?:/.test(cfg)) { cfg = {url: cfg}; } // url
    else {
      // a file that you can require
      try {
        cfg   = require(cfg);
      }
      catch(error) {
        throw errs.merge(error,
           { "scope"       : "init"
           , "message"     : "couldn't read config file " + cfg
           , "errid"       : "bad_file"
           });
      }
    }
  }

  if(!(cfg && cfg.url)) {
    throw errs.create(
        { "scope"       : "init"
        , "message"     : "no configuration with a valid url was given"
        , "errid"       : "bad_url"
        });
  }

  // alias so config is public in nano once set
  public_functions.config = cfg;

  // configuration for request
  // please send pull requests if you want to use a option
  // in request that is not exposed
  if(cfg.request_defaults) {
    request = require('request').defaults(cfg.request_defaults);
  }

  // assuming a cfg.log inside cfg
  logging    = require('./logger')(cfg);

  path       = u.parse(cfg.url);
  path_array = path.pathname.split('/').filter(function(e) { return e; });

  // nano('http://couch.nodejitsu.com/db1')
  //   should return a database
  // nano('http://couch.nodejitsu.com')
  //   should return a nano object
  if(path.pathname && path_array.length > 0) {
    auth    = path.auth ? path.auth + '@' : '';
    port    = path.port ? ':' + path.port : '';
    db      = path_array[0];
    cfg.url = u.format(
      {protocol:path.protocol,host: auth + path.hostname + port});
    return document_module(db);
  }
  else   { return public_functions; }

};

/*
 * and now an ascii dinosaur
 *              _
 *            / _) ROAR! i'm a vegan!
 *     .-^^^-/ /
 *  __/       /
 * /__.|_|-|_|
 *
 * thanks for visiting! come again!
 */

// nano level exports
nano.version = JSON.parse(
  fs.readFileSync(__dirname + "/package.json")).version;
nano.path    = __dirname;
