import pick from '../deps/pick';

// shim for P/CouchDB adapters that don't directly implement _bulk_get
function bulkGet(db, opts, callback) {
  var requests = Array.isArray(opts) ? opts : opts.docs;

  // consolidate into one request per doc if possible
  var requestsById = {};
  requests.forEach(function (request) {
    if (request.id in requestsById) {
      requestsById[request.id].push(request);
    } else {
      requestsById[request.id] = [request];
    }
  });

  var numDocs = Object.keys(requestsById).length;
  var numDone = 0;
  var perDocResults = new Array(numDocs);

  function collapseResults() {
    var results = [];
    perDocResults.forEach(function (res) {
      res.docs.forEach(function (info) {
        results.push({
          id: res.id,
          docs: [info]
        });
      });
    });
    callback(null, {results: results});
  }

  function checkDone() {
    if (++numDone === numDocs) {
      collapseResults();
    }
  }

  function gotResult(i, id, docs) {
    perDocResults[i] = {id: id, docs: docs};
    checkDone();
  }

  Object.keys(requestsById).forEach(function (docId, i) {

    var docRequests = requestsById[docId];

    // just use the first request as the "template"
    // TODO: The _bulk_get API allows for more subtle use cases than this,
    // but for now it is unlikely that there will be a mix of different
    // "atts_since" or "attachments" in the same request, since it's just
    // replicate.js that is using this for the moment.
    // Also, atts_since is aspirational, since we don't support it yet.
    var docOpts = pick(docRequests[0], ['atts_since', 'attachments']);
    docOpts.open_revs = docRequests.map(function (request) {
      // rev is optional, open_revs disallowed
      return request.rev;
    });

    // remove falsey / undefined revisions
    docOpts.open_revs = docOpts.open_revs.filter(function (e) { return e; });

    var formatResult = function (result) { return result; };

    if (docOpts.open_revs.length === 0) {
      delete docOpts.open_revs;

      // when fetching only the "winning" leaf,
      // transform the result so it looks like an open_revs
      // request
      formatResult = function (result) {
        return [{
          ok: result
        }];
      };
    }

    // globally-supplied options
    ['revs', 'attachments', 'binary'].forEach(function (param) {
      if (param in opts) {
        docOpts[param] = opts[param];
      }
    });
    db.get(docId, docOpts, function (err, res) {
      gotResult(i, docId, err ? [{error: err}] : formatResult(res));
    });
  });
}

export default bulkGet;
