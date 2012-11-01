var jsmin = require('jsmin2'),
    charProps = require('char-props'),
    sourcemap = require('source-map'),
    SourceMapGenerator = sourcemap.SourceMapGenerator;

/**
 * Collect multiple files into a source map
 * @constructor
 * @param {Object} params Params to pass to SourceMapGenerator
 */
function SourceMapFileCollector(params) {
  // Create and save a new SourceMapGenerator
  var srcMapGenerator = new SourceMapGenerator(params);
  this.srcMapGenerator = srcMapGenerator;
}
SourceMapFileCollector.prototype = {
  /**
   * Add code with an index based mapping to our srcMapGenerator
   * @param {Object} params Object holding multiple parameters
   * @param {String} params.src Filepath to original src
   * @param {String} params.input Unminified JavaScript
   * @param {String} params.output Minified JavaScript
   * @param {Object} params.map Map of character index to character index (number -> number)
   * @param {Number} [params.lineOffset=0] Line offset to add to mappings
   */
  'addIndexMapping': function (params) {
    // Localize items from params
    var srcFile = params.src,
        srcProps = charProps(params.input),
        destProps = charProps(params.output),
        codeMap = params.map,
        lineOffset = params.lineOffset || 0;

    // Grab the keys of the codeMap
    // DEV: If columnAt starts to be the slow part, create a map which memoizes each of the indicies it `while` loops over -- an LRU is probably best here.
    var srcMapGenerator = this.srcMapGenerator,
        lastSrcLine = 0,
        lastDestLine = 0,
        srcPoints = Object.getOwnPropertyNames(codeMap);
    srcPoints.forEach(function (srcPoint) {
      // Get the line and col of the src
      var srcLine = srcProps.lineAt(srcPoint, {'minLine': lastSrcLine}),
          srcCol = srcProps.columnAt(srcPoint);

      // Save the srcLine as our next guess
      lastSrcLine = srcLine;

      // Get the line and col of the dest
      var destPoint = codeMap[srcPoint],
          destLine = destProps.lineAt(destPoint, {'minLine': lastDestLine}),
          destCol = destProps.columnAt(destPoint);

      // Save the destLine for our next guess
      lastDestLine = destLine;

      // Create our mapping
      var mapping = {
        'original': {
          'line': srcLine + 1,
          'column': srcCol
        },
        'generated': {
          'line': destLine + 1 + lineOffset,
          'column': destCol
        },
        'source': srcFile
      };

      // Add the mapping to our generator
      srcMapGenerator.addMapping(mapping);
    });

    // Return this for a fluent interface
    return this;
  },
  /**
   * Export the current collection as a sourcemap
   * @returns {String} Sourcemap of the file
   */
  toString: function () {
    var srcMapGenerator = this.srcMapGenerator;
    return srcMapGenerator.toString();
  }
};

function Collector(params) {
  // Generate and save our SourceMapFileCollector
  var fileCollector = new SourceMapFileCollector(params);
  this.fileCollector = fileCollector;

  // Save a line offset for addition handling
  this.lineOffset = 0;

  // Save an array for code concatenation
  this.codeArr = [];
}
Collector.prototype = {
  /**
   * Add a file to minify
   * @param {Object} params
   * @param {String} params.code Code to minify
   * @param {String} params.src Filepath to original src
   */
  'addFile': function (params) {
    var input = params.code,
        codeObj = jsmin(input),
        code = codeObj.code,
        lineOffset = this.lineOffset,
        fileCollector = this.fileCollector;

    // Add to our fileCollector
    fileCollector.addIndexMapping({
      'input': input,
      'output': code,
      'map': codeObj.codeMap,
      'src': params.src,
      'lineOffset': lineOffset
    });

    // Save the new code
    this.codeArr.push(code);

    // Count all the lines in code
    var lines = code.match(/\n/g),
        lineCount = 1;
    if (lines) {
      lineCount = lines.length;
    }

    // Update the line offset
    this.lineOffset = lineOffset + lineCount;

    // Return this for a fluent interface
    return this;
  },
  /**
   * Export function for the collector
   * @return {Object} retObj
   * @return {String} retObj.code Minified JavaScript
   * @return {Object} retObj.sourcemap Sourcemap of input to minified JavaScript
   */
  'export': function () {
    // Output the source map and code
    // Fun fact: JSMin automatically puts a line break at the top of each statement so we can use an empty string for our join =D
    var fileCollector = this.fileCollector,
        srcMap = fileCollector.toString(),
        codeArr = this.codeArr,
        code = codeArr.join(''),
        retObj = {
          'code': code,
          'sourcemap': srcMap
        };
    return retObj;
  }
};

/**
 * JSMin + source-map
 * @param {Object} params Parameters to minify and generate sourcemap with
 * @param {String} [params.dest="undefined.js"] Destination for your JavaScript (used inside of sourcemap map)
 * @param {String} [params.srcRoot] Optional root for all relative URLs
 *
 * SINGLE FILE FORMAT
 * @param {String} params.src  File path to original JavaScript (seen when an error is thrown)
 * @param {String} params.code JavaScript to minify
 *
 * MULTI FILE FORMAT
 * @param {Object[]} params.input Array of objects) to minify
 * @param {String} params.input[n].src File path to original JavaScript (seen when an error is thrown)
 * @param {String} params.input[n].code JavaScript to minify
 *
 * @return {Object} retObj
 * @return {String} retObj.code Minified JavaScript
 * @return {Object} retObj.sourcemap Sourcemap of input to minified JavaScript
 */
module.exports = function (params) {
  var dest = params.dest || 'undefined.js',
      srcRoot = params.srcRoot,
      input = params.input,
      collectorParams = {'file': dest};

  // If there is a sourceRoot, use it
  if (srcRoot) {
    collectorParams.sourceRoot = srcRoot;
  }

  // Generate our collector
  var collector = new Collector(collectorParams);

  // If there is no input, build one
  if (!input) {
    input = [{'src': params.src, 'code': params.code}];
  } else if (!Array.isArray(input)) {
  // Otherwise, if input is not an array, cast it to one
    input = [input];
  }

  // Add each of the files
  var addFile = collector.addFile.bind(collector);
  input.forEach(addFile);

  // Retun the retObj
  var retObj = collector['export']();
  return retObj;
};