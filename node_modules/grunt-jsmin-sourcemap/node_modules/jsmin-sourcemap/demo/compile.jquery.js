// Grab the file pieces
var fs = require('fs'),
    jsmin = require('../lib/jsmin.sourcemap.js'),
    basic = fs.readFileSync(__dirname + '/jquery/jquery.js', 'utf8');

// Run the source map and extract its parts
var sourcemapObj = jsmin({'input':{'code':basic,'src':'jquery.js'},'dest':'jquery.min.js'}),
    code = sourcemapObj.code,
    srcMap = sourcemapObj.sourcemap;

// Append a sourceMappingURL to our code
code = code + '\n//@ sourceMappingURL=jquery.js.map';

// Output pieces into proper files
fs.writeFileSync(__dirname + '/jquery/jquery.min.js', code, 'utf8');
fs.writeFileSync(__dirname + '/jquery/jquery.js.map', srcMap, 'utf8');
