#!/usr/bin/env node

'use strict';

var TARGET_DIR = __dirname + '/../docs/_site/custom';
var NUM_CONCURRENT_PROMISES = require('os').cpus().length;

var options = require('../lib/customOptions');
var combinations = require('combinations');
var browserify = require('browserify');
var bluebird = require('bluebird');
var fs = bluebird.promisifyAll(require('fs'));
var rimraf = require('rimraf');
var rimrafAsync = bluebird.promisify(rimraf);
var mkdirp = require('mkdirp');
var streamToPromise = require('stream-to-promise');
var uglify = require('uglify-js');
var zlib = bluebird.promisifyAll(require('zlib'));

rimraf.sync(TARGET_DIR);
mkdirp.sync(TARGET_DIR);

// generate a nice short hext code for the given option
function generateName(combo) {
  var str = '';
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    str += combo.indexOf(option) === -1 ? '0' : '1';
  }
  // binary -> hex
  return parseInt(str, 2).toString(16);
}

function generateCode(combo) {
  var str = '\'use strict\';\n' +
    '\n' +
    'var PouchDB = require(\'pouchdb/custom/pouchdb\');\n' +
    '\n';
  for (var i = 0; i < combo.length; i++) {
    var option = combo[i];
    str += option.code + '\n';
  }
  str += '\n' +
    'module.exports = PouchDB;';
  return str;
}

function build(comboName, code) {
  var sourceFile = TARGET_DIR + '/pouchdb-custom-source-' + comboName + '.js';
  var targetFile = TARGET_DIR + '/pouchdb-custom-' + comboName + '.js';
  var targetMinFile = TARGET_DIR + '/pouchdb-custom-' + comboName + '.min.js';

  var relativeCode = code.replace(/require\('pouchdb/g, 'require(\'../../..');

  return fs.writeFileAsync(sourceFile, relativeCode, 'utf8').then(function () {
    var b = browserify(sourceFile, {
      standalone: 'PouchDB'
    }).plugin('bundle-collapser/plugin');
    var stream = b.bundle().pipe(fs.createWriteStream(targetFile));
    return streamToPromise(stream);
  }).then(function () {
    var uglified = uglify.minify(targetFile, {
      mangle: true,
      compress: {}
    });
    return fs.writeFileAsync(targetMinFile, uglified.code, 'utf8');
  }).then(function () {
    return rimrafAsync(sourceFile);
  }).then(function () {
    return bluebird.all([
      fs.statAsync(targetFile),
      fs.statAsync(targetMinFile),
      bluebird.resolve().then(function () {
        var stream = fs.createReadStream(targetMinFile)
          .pipe(zlib.createGzip());
        return streamToPromise(stream);
      })
    ]).then(function (arr) {
      var size = arr[0].size;
      var sizeMin = arr[1].size;
      var gzipped = arr[2];
      return {
        size: size,
        sizeMin: sizeMin,
        sizeGzipped: gzipped.length
      };
    });
  });
}

var builtInfo = {};

function buildPromise(combo, comboName, code) {
  var debuggableComboName = combo.map(function (x) {
    return x.name;
  });
  return function () {
    console.log('Building combo',
      JSON.stringify(debuggableComboName),
      'with ID',
      comboName,
      '...');
    return build(comboName, code).then(function (info) {
      builtInfo[comboName] = info;
    });
  };
}

function createPromiseChains() {
  var promises = [];
  for (var i = 0; i < NUM_CONCURRENT_PROMISES; i++) {
    promises.push(bluebird.resolve());
  }
  return promises;
}

var promises = createPromiseChains();
var idx = 0;

console.log('Building using', promises.length, 'concurrent promises...');

for (var i = 1; i < options.length; i++) {
  var combos = combinations(options, i);
  for (var j = 0; j < combos.length; j++) {
    var combo = combos[j];
    var comboName = generateName(combo);
    var code = generateCode(combo);
    promises[idx] = promises[idx].then(buildPromise(combo, comboName, code));
    if (++idx === promises.length) {
      idx = 0;
    }
  }
}

bluebird.all(promises).then(function () {
  return fs.writeFileAsync(TARGET_DIR + '/info.json',
    JSON.stringify(builtInfo), 'utf8');
});