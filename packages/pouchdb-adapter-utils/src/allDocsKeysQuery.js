export async function allDocsKeysQuery(api, opts) {
  
  const finalResults = {
    offset: opts.skip,
    rows: Promise.all(opts.keys.map(async (key) => {
      const filterOpts = ({limit,skip,keys,...subOpts}) => subOpts;            
      api._allDocs(Object.assign(
        {key: key, deleted: 'ok'}, filterOpts(opts)
      ), (err, res) => {
        /* istanbul ignore if */
        if (err) {
          throw new Error(err);
        }
        /* istanbul ignore if */
        if (opts.update_seq && res.update_seq !== undefined) {
          finalResults.update_seq = res.update_seq;
        }
        finalResults.total_rows = res.total_rows;
        resolve(res.rows[0] || {key: key, error: 'not_found'});
      });
    })),
  };
  
  return finalResults;
  
}

export default allDocsKeysQuery;
