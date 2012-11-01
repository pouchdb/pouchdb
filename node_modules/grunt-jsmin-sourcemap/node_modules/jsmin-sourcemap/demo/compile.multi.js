// Grab the file pieces
var fs = require('fs'),
    jsmin = require('../lib/jsmin.sourcemap.js'),
    jQuerySrc = fs.readFileSync(__dirname + '/multi/jquery.js', 'utf8');

// Run the source map and extract its parts
var _Src = fs.readFileSync(__dirname + '/multi/underscore.js', 'utf8'),
    minParams = {
      'input': [{
        'code': jQuerySrc,
        'src': 'jquery.js'
      }, {
        'code': _Src,
        'src': 'underscore.js'
      }],
      'dest': 'jqueryAndUnderscore.min.js'
    },
    sourcemapObj = jsmin(minParams),
    code = sourcemapObj.code,
    srcMap = sourcemapObj.sourcemap;

// Append a sourceMappingURL to our code
code = code + '\n//@ sourceMappingURL=jqueryAndUnderscore.js.map';

// Output pieces into proper files
fs.writeFileSync(__dirname + '/multi/jqueryAndUnderscore.min.js', code, 'utf8');
fs.writeFileSync(__dirname + '/multi/jqueryAndUnderscore.js.map', srcMap, 'utf8');
