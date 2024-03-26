#!/usr/bin/env node
/* eslint-disable curly */

const { loadResultFile, printComparisonReport, SUITE_FOR } = require('./lib');

const [ , , ...files ] = process.argv;
if (files.length !== 2) throw new Error('Can currently only compare 2 results.');

const [ a, b ] = files.map(loadResultFile);

printComparisonReport({ useStat:'median' }, remap(a), remap(b));

function remap({ adapter, results }) {
  const suiteResults = {};
  for (const [ name, { median, numIterations } ] of Object.entries(results)) {
    const suiteName = SUITE_FOR[name];
    if (!suiteResults[suiteName]) suiteResults[suiteName] = {};
    suiteResults[suiteName][name] = { median, numIterations };
  }
  return {
    adapter,
    results: suiteResults,
  };
}
