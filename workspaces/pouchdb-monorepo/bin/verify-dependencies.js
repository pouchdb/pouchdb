'use strict';

// confirm that the build was generated the proper way, with the kind of
// bundling we expect

var findRequires = require('find-requires');
var path = require('path');
var fs = require('fs');
var chai = require('chai');
chai.should();

function getReqs(thisPath) {
  var fullPath = path.join('./packages/node_modules', thisPath);
  return findRequires(fs.readFileSync(fullPath, 'utf8'));
}

console.log('Verifying dependencies...');

// pouchdb package is aggressively bundled, shouldn't
// contain e.g. pouchdb-mapreduce
getReqs('pouchdb/lib/index.js').should.contain('vm');
getReqs('pouchdb/lib/index.js').should.not.contain('pouchdb-mapreduce');
getReqs('pouchdb/lib/index.js').should.not.contain('pouchdb');
getReqs('pouchdb/lib/index.js').should.not.contain('pouchdb-core');
getReqs('pouchdb/lib/index-browser.js').should.not.contain('vm');
getReqs('pouchdb/lib/index-browser.js').should.not.contain('pouchdb-mapreduce');
getReqs('pouchdb/lib/index-browser.js').should.not.contain('pouchdb');
getReqs('pouchdb/lib/index-browser.js').should.not.contain('leveldown');
getReqs('pouchdb/lib/index-browser.js').should.not.contain('pouchdb-core');

// pouchdb-node and pouchdb-browser are also aggressively bundled
getReqs('pouchdb-node/lib/index.js').should.not.contain('pouchdb-core');
getReqs('pouchdb-node/lib/index.js').should.contain('leveldown');
getReqs('pouchdb-browser/lib/index.js').should.not.contain('pouchdb-core');

// pouchdb-for-coverage is super-duper aggressively bundled
getReqs('pouchdb-for-coverage/lib/index.js').should.not.contain('pouchdb');
getReqs('pouchdb-for-coverage/lib/index.js').should.not.contain('pouchdb-core');
getReqs('pouchdb-for-coverage/lib/index.js')
  .should.not.contain('pouchdb-utils');

console.log('Dependencies look good!');
