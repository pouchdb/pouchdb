// Grab the file pieces
var fs = require('fs'),
    jsmin = require('../lib/jsmin.sourcemap.js'),
    basic = fs.readFileSync(__dirname + '/basic/basic.js', 'utf8');

// Run the source map and extract its parts
var sourcemapObj = jsmin({'input':{'code':basic,'src':'basic.js'},'dest':'basic.min.js'}),
    code = sourcemapObj.code,
    srcMap = sourcemapObj.sourcemap;

// Append a sourceMappingURL to our code
code = code + '\n//@ sourceMappingURL=basic.js.map';

// Output pieces into proper files
fs.writeFileSync(__dirname + '/basic/basic.min.js', code, 'utf8');
fs.writeFileSync(__dirname + '/basic/basic.js.map', srcMap, 'utf8');