/* eslint-disable curly */

// Current JSON reporter does not save suite names.  These are hardcoded from
// the test files.
const SUITE_FOR = {
  'basic-inserts':                    'basics',
  'bulk-inserts':                     'basics',
  'bulk-inserts-large-docs':          'basics',
  'bulk-inserts-massive-docs':        'basics',
  'basic-updates':                    'basics',
  'basic-gets':                       'basics',
  'all-docs-skip-limit':              'basics',
  'all-docs-startkey-endkey':         'basics',
  'all-docs-keys':                    'basics',
  'all-docs-include-docs':            'basics',
  'pull-replication-one-generation':  'basics',
  'pull-replication-two-generation':  'basics',
  'temp-views':                       'views',
  'build-secondary-index':            'views',
  'persisted-views':                  'views',
  'persisted-views-stale-ok':         'views',
  'create-index':                     'find',
  'simple-find-query':                'find',
  'simple-find-query-no-index':       'find',
  'complex-find-query':               'find',
  'complex-find-query-no-index':      'find',
  'multi-field-query':                'find',
  'basic-attachments':                'attachments',
  'many-attachments-base64':          'attachments',
  'many-attachments-binary':          'attachments',
};

module.exports = {
  loadResultFile,
  printComparisonReport,
  SUITE_FOR, // TODO instead of exporting here, do remapping inside printComparisonReport()
};

const fs = require('node:fs');

function loadResultFile(file) {
  console.error(`[compare-perf-results.lib]`, 'Loading file:', file, '...');
  const { adapter, client, srcRoot, tests:results } = JSON.parse(fs.readFileSync(file, { encoding:'utf8' }));

  const gitMatch = srcRoot.match(/^\.\.\/\.\.\/dist-bundles\/([0-9a-f]{40})$/);
  const description = (gitMatch && gitMatch[1].substr(0,7)) || srcRoot;

  const browserName = client.browser.name;

  return { adapter:`${adapter}:${description}`, client:browserName, results };
}

function report(...args) { console.log('   ', ...args); }

const colFormat = idx => {
  switch (idx) {
    case 0:  return { width:11, pad:'padEnd' };
    case 1:  return { width:31, pad:'padEnd' };
  }
  if (idx & 1) return { width:17, pad:'padStart' };
  else        return { width:17, pad:'padStart' };
};
function reportTableRow(...cols) {
  report(cols.map((c, i) => {
    const { width, pad } = colFormat(i);
    return ((c && c.toString()) || '-')[pad](width, ' ');
  }).join(' | '));
}
function reportTableDivider(results) {
  let totalWidth = -3;
  for (let i=(results.length*2)+1; i>=0; --i) {
    totalWidth += colFormat(i).width + 3;
  }
  report(''.padStart(totalWidth, '-'));
}

function forHumans(n) {
  return n != null ? n.toFixed(2) : null;
}

function printComparisonReport({ useStat }, ...results) {
  report();
  report('Using stat:', useStat);
  report('Comparing adapters:');
  results.map(({ adapter }) => report('  *', adapter));
  report();
  reportTableRow('', '', ...results.map(r  => [ r.adapter,   r.adapter ]).flat());
  reportTableRow('', '', ...results.map(() => [ 'iterations', useStat  ]).flat());

  const [ a, ...others ] = results;
  Object.entries(a.results)
    .forEach(([ suite, suiteResults ]) => {
      Object.entries(suiteResults)
        .forEach(([ test, testResults ], idx) => {
          if (!idx) reportTableDivider(results);
          const suiteName = idx ? '' : suite;

          const resA        = testResults[useStat];
          const iterationsA = testResults.numIterations;

          const resOthers       = others.map(b => b.results[suite][test][useStat]);
          const iterationsOther = others.map(b => b.results[suite][test].numIterations);
          reportTableRow(suiteName, test,
            iterationsA,
            forHumans(resA) + isBetter(resA, ...resOthers),
            ...others.map((_, i) => [
              iterationsOther[i],
              forHumans(resOthers[i]) + isBetter(resOthers[i], resA, ...arrWithout(resOthers, i)),
            ]).flat(),
          );
        });
    });
  report();
}

function isBetter(a, ...others) {
  const minOthers = Math.min(...others);

  if (Math.abs(a - minOthers) / a < 0.05) return ' ~'; // less than 5 percent different - is it significant?  do we care?
  if (a < minOthers) return ' !';
  if (a === minOthers) return ' !';
  return '  ';
}

function arrWithout(arr, idx) {
  return [ ...arr.slice(0, idx), ...arr.slice(idx+1) ];
}
