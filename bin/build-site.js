#!/usr/bin/env node

'use strict';

var fs = require('fs');

var http_server = require('http-server');
var execSync = require('exec-sync');
var mkdirp = require('mkdirp');
var watchGlob = require('watch-glob');

var POUCHDB_CSS = __dirname + '/../docs/static/css/pouchdb.css';
var POUCHDB_LESS = __dirname + '/../docs/static/less/pouchdb/pouchdb.less';

if (!execSync('gem list jekyll -i')) {
  console.log('Install Jekyll');
  process.exit(1);
}

mkdirp.sync(__dirname + '/../docs/static/css');

function buildCSS() {
  var css =
    execSync(__dirname + '/../node_modules/less/bin/lessc ' + POUCHDB_LESS);
  fs.writeFileSync(POUCHDB_CSS, css);
  console.log('Updated: ', POUCHDB_CSS);
}

if (!process.env.BUILD) {
  watchGlob('docs/static/less/*/*.less', buildCSS);
}
buildCSS();

process.chdir('docs');

function buildJekyll(path) {
  // Dont rebuild on website artifacts being written
  if (path && /^_site/.test(path.relative)) {
    return;
  }
  execSync('jekyll build');
  console.log('=> Rebuilt jekyll');
}

if (!process.env.BUILD) {
  watchGlob('**', buildJekyll);
  buildJekyll();
  http_server.createServer({root: '_site'}).listen(4000);
  console.log('Server address: http://0.0.0.0:4000');
} else {
  execSync('jekyll build');
}
