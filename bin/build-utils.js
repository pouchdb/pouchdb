'use strict';

var DEV_MODE = process.env.CLIENT === 'dev';

var path = require('path');
var denodeify = require('denodeify');
var browserify = require('browserify');
var browserifyIncremental = require('browserify-incremental');
var derequire = require('derequire');
var fs = require('fs');
var writeFileAsync = denodeify(fs.writeFile);
var renameAsync = denodeify(fs.rename);
var streamToPromise = require('stream-to-promise');

var UglifyJS = require("uglify-js");

function addPath(pkgName, otherPath) {
  return path.resolve('packages/node_modules/' + pkgName, otherPath);
}

function writeFile(filename, contents) {
  var tmp = filename + '.tmp';
  return writeFileAsync(tmp, contents, 'utf-8').then(function () {
    return renameAsync(tmp, filename);
  }).then(function () {
    console.log('  \u2713' + ' wrote ' +
      filename.match(/packages[/\\]node_modules[/\\]\S*?[/\\].*/)[0]);
  });
}

function doUglify(pkgName, code, prepend, fileOut) {
  var miniCode = prepend + UglifyJS.minify(code).code;
  return writeFile(addPath(pkgName, fileOut), miniCode);
}

var browserifyCache = {};

function doBrowserify(pkgName, filepath, opts, exclude) {

  var bundler = browserifyCache[filepath];

  if (!bundler) {
    if (DEV_MODE) {
      opts.debug = true;
      bundler = browserifyIncremental(addPath(pkgName, filepath), opts)
        .on('time', function (time) {
          console.log('    took ' + time + ' ms to browserify ' +
            path.dirname(filepath) + '/' + path.basename(filepath));
        });
    } else {
      bundler = browserify(addPath(pkgName, filepath), opts)
        .transform('es3ify')
        .plugin('bundle-collapser/plugin');
    }

    if (exclude) {
      bundler.external(exclude);
    }
    browserifyCache[filepath] = bundler;
  }

  return streamToPromise(bundler.bundle()).then(function (code) {
    if (!DEV_MODE) {
      code = derequire(code);
    }
    return code;
  });
}

exports.addPath = addPath;
exports.doBrowserify = doBrowserify;
exports.doUglify = doUglify;
exports.writeFile = writeFile;
