#!/usr/bin/env node

'use strict';

const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').exec);

var fs = require('fs');
const Path = require('node:path');

var replace = require('replace');
var cssmin = require('cssmin');
const terser = require('terser');

const POUCHDB_CSS = resolvePath('docs/static/css/pouchdb.css');
const POUCHDB_LESS = resolvePath('docs/src/less/pouchdb/pouchdb.less');

process.chdir('docs');

async function checkJekyll() {
  try {
    await exec('bundle check');
  } catch (err) {
    throw new Error('Jekyll is not installed.  You need to do: npm run install-jekyll');
  }
}

async function buildCSS() {
  fs.mkdirSync(__dirname + '/../docs/static/css', { recursive:true });
  const cmd = [ resolvePath('node_modules/less/bin/lessc'), POUCHDB_LESS ].join(' ');
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

  const srcPath = resolvePath('docs/src/code.js');
  const targetPath = resolvePath('docs/_site/static/js/code.min.js');
  const src = fs.readFileSync(srcPath, { encoding:'utf8' });
  const mangle = { toplevel: true };
  const output = { ascii_only: true };
  const { code, error } = terser.minify(src, { mangle, output });
  if (error) {
    if (process.env.BUILD) {
      throw error;
    } else {
      console.log(
        `Javascript minification failed on line ${error.line} col ${error.col}:`,
        error.message,
      );
    }
  } else {
    fs.writeFileSync(targetPath, code);
    console.log('Minified javascript.');
  }
}

function highlightEs6() {
  const path = resolvePath('docs/_site');

  // TODO: this is a fragile and hacky way to get
  // 'async' and 'await' to highlight correctly
  // in blog posts & documentation.
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

function resolvePath(projectLocalPath) {
  return Path.resolve(__dirname, '..', projectLocalPath);
}

if (!process.env.BUILD) {
  const http_server = require('http-server');
  const watchGlob = require('glob-watcher');

  // Simpler ways of blacklisting certain paths here would be very welcome.
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


  watchGlob('static/src/*/*.less', buildCSS);

  http_server.createServer({root: '_site', cache: '-1'}).listen(4000);
  console.log('Server address: http://localhost:4000');
}

buildEverything();
