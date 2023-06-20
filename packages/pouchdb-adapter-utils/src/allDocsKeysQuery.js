// eslint-disable-next-line no-unused-vars
export async function allDocsKeysQuery(api, {limit, skip: offset, keys,...subOpts}) {
  
  const finalResults = {
    offset, rows: await Promise.all(keys.map(async (key) => {
      return await new Promise((resolve) => (api._allDocs(Object.assign(
        {key: key, deleted: 'ok'}, subOpts
      ), (err, res) => {
        /* istanbul ignore if */
        if (err) {
          throw new Error(err);
        }
        /* istanbul ignore if */
        if (subOpts.update_seq && res.update_seq !== undefined) {
          finalResults.update_seq = res.update_seq;
        }
        finalResults.total_rows = res.total_rows;
        resolve(res.rows[0] || {key: key, error: 'not_found'});
      })));
    })),
  };
  
  return finalResults;
  
}

export default allDocsKeysQuery;
