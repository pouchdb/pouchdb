export async function allDocsKeysQuery(api, opts) {
  var keys = opts.keys;
  var finalResults = {
    offset: opts.skip
  };
  
  keys.map(async (key) => {
    var subOpts = Object.assign({key: key, deleted: 'ok'}, opts);
    ['limit', 'skip', 'keys'].forEach(function (optKey) {
      delete subOpts[optKey];
    });
    await new Promise(function (resolve, reject) {
      api._allDocs(subOpts, function (err, res) {
        /* istanbul ignore if */
        if (err) {
          return reject(err);
        }
        /* istanbul ignore if */
        if (opts.update_seq && res.update_seq !== undefined) {
          finalResults.update_seq = res.update_seq;
        }
        finalResults.total_rows = res.total_rows;
        resolve(res.rows[0] || {key: key, error: 'not_found'});
      });
    });
  })
  finalResults.rows = results;
  return finalResults;
  
}

export default allDocsKeysQuery;
