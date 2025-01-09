#!/usr/bin/env node

'use strict';

var fs = require('fs');
var replace = require('replace');
var exec = require('child-process-promise').exec;
var mkdirp = require('mkdirp');
var cssmin = require('cssmin');

var POUCHDB_CSS = __dirname + '/../docs/static/css/pouchdb.css';
var POUCHDB_LESS = __dirname + '/../docs/static/less/pouchdb/pouchdb.less';

process.chdir('docs');

async function checkJekyll() {
  try {
    await exec('bundle check');
  } catch (err) {
    throw new Error('Jekyll is not installed.  You need to do: npm run install-jekyll');
  }
}

async function buildCSS() {
  mkdirp.sync(__dirname + '/../docs/static/css');
  var cmd = __dirname + '/../node_modules/less/bin/lessc ' + POUCHDB_LESS;
  const { stdout } = await exec(cmd);
  const minifiedCss = cssmin(stdout);
  fs.writeFileSync(POUCHDB_CSS, minifiedCss);
  console.log('Updated:', POUCHDB_CSS);
}

async function buildJekyll() {
  await exec('bundle exec jekyll build');
  console.log('=> Rebuilt jekyll');

  highlightEs6();
  console.log('=> Highlighted ES6');
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
  const http_server = require('http-server');
  const watchGlob = require('glob-watcher');

  fs.readdirSync('.')
    .forEach(path => {
      if (path === '_site' || path.startsWith('Gemfile')) {
        return;
      }

      if (fs.statSync(path).isDirectory()) {
        watchGlob(`${path}/**`, buildJekyll);
      } else {
        watchGlob(path, buildJekyll);
      }
    });

  watchGlob('static/less/*/*.less', buildCSS);

  http_server.createServer({root: '_site', cache: '-1'}).listen(4000);
  console.log('Server address: http://localhost:4000');
}

buildEverything();
