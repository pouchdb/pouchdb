const { loadResultFile, printComparisonReport } = require('./lib');

const [ , , ...files ] = process.argv;
if(files.length !== 2) throw new Error('Can currently only compare 2 results.');

const [ a, b ] = files.map(loadResultFile);

printComparisonReport(a, b, { useStat:'median' });
