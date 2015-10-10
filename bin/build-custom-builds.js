#!/usr/bin/env node

'use strict';

var TARGET_DIR = __dirname + '/../docs/static/custom';
var NUM_CONCURRENT_PROMISES = require('os').cpus().length;

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
var options = require('../lib/custom/options');
var generateName = require('../lib/custom/generateName');
var generateCode = require('../lib/custom/generateCode');

rimraf.sync(TARGET_DIR);
mkdirp.sync(TARGET_DIR);

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

// don't overload the user's CPU, but also don't try to do absolutely
// everything at once. it's a better UX to see a little bit of progress
function createPromiseChains() {
  var promises = [];
  for (var i = 0; i < NUM_CONCURRENT_PROMISES; i++) {
      promises.push(bluebird.resolve());
    }
  return promises;
}

var builtInfo = {};
var promises = createPromiseChains();
var counter = 0;
var promiseIndex = 0;

function buildPromise(combo, comboName, code) {
  var thisCounter = ++counter;
  var debuggableComboName = combo.map(function (x) {
    return x.name;
  });
  return function () {
    return build(comboName, code).then(function (info) {
      console.log('Built custom build',
        JSON.stringify(debuggableComboName),
        'with ID',
        comboName,
        '(' + (thisCounter + 1) + '/' + counter +')...');
      builtInfo[comboName] = info;
    });
  };
}

console.log('Building with', promises.length, 'concurrent promises...');

var combos = combinations(options);
combos.forEach(function (combo) {
  var comboName = generateName(combo);
  var code = generateCode(combo);
  promises[promiseIndex] = promises[promiseIndex].then(
    buildPromise(combo, comboName, code));
  if (++promiseIndex === promises.length) {
    promiseIndex = 0;
  }
});

bluebird.all(promises).then(function () {
  return fs.writeFileAsync(TARGET_DIR + '/info.json',
    JSON.stringify(builtInfo), 'utf8');
});