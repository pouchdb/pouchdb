'use strict';

var DEV_MODE = process.env.CLIENT === 'dev';

var path = require('path');
var denodeify = require('denodeify');
var browserify = require('browserify');
var browserifyIncremental = require('browserify-incremental');
var derequire = require('derequire');
var fs = require('node:fs');
var writeFileAsync = denodeify(fs.writeFile);
var renameAsync = denodeify(fs.rename);
var streamToPromise = require('stream-to-promise');

var terser = require("terser");

function writeFile(filename, contents) {
  var tmp = filename + '.tmp';
  console.log('Try writeFile:', filename);
  if (!contents) {
    throw new Error("Got no Content?:"+ filename);
  }
  return contents && writeFileAsync(tmp, contents, 'utf-8').then(function () {
    return renameAsync(tmp, filename);
  }).then(function () {
    console.log('  \u2713' + ' wrote ' +
      filename.match(/packages[/\\]\S*?[/\\].*/)[0]);
  });
}

function doUglify(pkgName, code, prepend, fileOut) {

  var miniCode = prepend + terser.minify(code, { output: { ascii_only: true }}).code;
  return writeFile(addPath(pkgName, fileOut), miniCode);

}

var browserifyCache = {};

async function doBrowserify(pkgName, filepath, opts, exclude) {
  console.log('DO BROWSERIFY:', pkgName, filepath)
  var bundler = browserifyCache[filepath] || 
  DEV_MODE 
    ? (opts.debug = true) && browserifyIncremental(
      path.resolve('packages/' + pkgName, filepath), opts).on('time', (time) => {
      console.log('    took ' + time + ' ms to browserify ' + path.dirname(filepath) + '/' + path.basename(filepath));
      }) 
    : browserify(path.resolve('packages/' + pkgName, filepath), opts).transform('es3ify').plugin('bundle-collapser/plugin');
  
  if (exclude) {
    bundler.external(exclude);
  }
  
  browserifyCache[filepath] = bundler;
  const code = await streamToPromise(bundler.bundle());  
  return !DEV_MODE ? derequire(code) : code;
}

exports.doBrowserify = doBrowserify;
exports.doUglify = doUglify;
exports.writeFile = writeFile;
