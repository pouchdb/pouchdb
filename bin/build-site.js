#!/usr/bin/env node

'use strict';

var http_server = require('http-server');
var Promise = require('lie');
var fs = require('fs');
var watchGlob = require('watch-glob');
var replace = require('replace');
var exec = require('child-process-promise').exec;
var mkdirp = require('mkdirp');
var cssmin = require('cssmin');

var POUCHDB_CSS = __dirname + '/../docs/static/css/pouchdb.css';
var POUCHDB_LESS = __dirname + '/../docs/static/less/pouchdb/pouchdb.less';

process.chdir('docs');

function checkJekyll() {
  return exec('bundle check').catch(function (err) {
    throw new Error('Jekyll is not installed.  You need to do: npm run install-jekyll');
  });
}

function buildCSS() {
  mkdirp.sync(__dirname + '/../docs/static/css');
  var cmd = __dirname + '/../node_modules/less/bin/lessc ' + POUCHDB_LESS;
  return exec(cmd).then(function (child) {
    var minifiedCss = cssmin(child.stdout);
    fs.writeFileSync(POUCHDB_CSS, minifiedCss);
    console.log('Updated: ', POUCHDB_CSS);
  });
}

function buildJekyll(path) {
  // Dont rebuild on website artifacts being written
  if (path && /^_site/.test(path.relative)) {
    return;
  }
  return exec('bundle exec jekyll build').then(function () {
    console.log('=> Rebuilt jekyll');
    return highlightEs6();
  }).then(function () {
    console.log('=> Highlighted ES6');
  });
}

function highlightEs6() {
  var path = require('path').resolve(__dirname, '../docs/_site');

  // TODO: this is a fragile and hacky way to get
  // 'async' and 'await' to highlight correctly
  // in this blog post.
  replace({
    regex: '<span class="nx">(await|async|of)</span>',
    replacement: '<span class="kd">$1</span>',
    paths: [path],
    recursive: true
  });
}

function onError(err) {
  console.error(err);
  process.exit(1);
}

function buildEverything() {
  return Promise.resolve()
    .then(checkJekyll)
    .then(buildCSS)
    .then(buildJekyll)
    .catch(onError);
}

if (!process.env.BUILD) {
  watchGlob('**', buildJekyll);
  watchGlob('docs/static/less/*/*.less', buildCSS);
  http_server.createServer({root: '_site', cache: '-1'}).listen(4000);
  console.log('Server address: http://0.0.0.0:4000');
}

buildEverything();
