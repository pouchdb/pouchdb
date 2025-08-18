#!/usr/bin/env node
/* eslint-disable curly,max-len */

const { loadResultFile, printComparisonReport, SUITE_FOR } = require('./lib');

const [ , , ...files ] = process.argv;

const rawResults = files.map(loadResultFile);

const adapters = [];
const testSuites = {};
const resultsByAdapter = {};

const clientFilter  = process.env.CLIENT;
const adapterFilter = process.env.ADAPTERS && process.env.ADAPTERS.split(',');
const gitFilter     = process.env.COMMITS  && process.env.COMMITS.split(',').map(commit => commit.substring(0, 7));

rawResults.forEach(({ adapter, client, results }) => {
  if (adapterFilter) {
    if (!adapterFilter.includes(adapter.split(':')[0])) return;
  }
  if (gitFilter) {
    if (!gitFilter.includes(adapter.split(':')[1])) return;
  }
  if (clientFilter) {
    if (client.toLowerCase() !== clientFilter.toLowerCase()) return;
  }

  if (!adapters.includes(adapter)) {
    adapters.push(adapter);
    resultsByAdapter[adapter] = {};
  }

  Object.entries(results).forEach(([ t, { median } ]) => {
    const suite = SUITE_FOR[t] || 'TODO:suite-mapping';

    if (!testSuites[suite]) testSuites[suite] = [];
    if (!testSuites[suite].includes(t)) testSuites[suite].push(t);

    if (!resultsByAdapter[adapter][suite])    resultsByAdapter[adapter][suite]    = {};
    if (!resultsByAdapter[adapter][suite][t]) resultsByAdapter[adapter][suite][t] = { numIterations:0, min:Number.MAX_VALUE };

    resultsByAdapter[adapter][suite][t].min = Math.min(resultsByAdapter[adapter][suite][t].min, median);
    resultsByAdapter[adapter][suite][t].numIterations++;
  });
});

if (adapters.length < 2) {
  console.log('!!! At least 2 different adapters are required to make comparisons!');
  process.exit(1);
}

adapters.sort();

const sortedResults = adapters.map(adapter => ({
  adapter, results:resultsByAdapter[adapter]
}));

printComparisonReport({ useStat:'min' }, ...sortedResults);
