# node-jsmin2

Another port of JSMin -- this time outputting a coordinate map

## Getting Started
Install the module with: `npm install node-jsmin2`

## Documentation
JSMin is a function that minifies a single set of JavaScript and outputs an object with a code and codeMap.
```js
/**
 * jsmin - Refer to LICENSE in base directory
 * @param {String} input JavaScript to minifiy
 * @return {Object} retObj
 * @return {String} retObj.code Minified JavaScript
 * @return {Object} retObj.codeMap Point to point map from source JavaScript to minified JavaScript
 */
```

## Example
```js
// Load in jsmin and jQuery
var jsmin = require('node-jsmin2'),
    jquerySrc = fs.readFileSync('jquery.js', 'utf8');

// Process the jquery source via jsmin
var jqueryMinObj = jsmin(jquerySrc);

// Minified code is available at
// jqueryMinObj.code;

// Coordinate map of source code to minified code is available at
// jqueryMinObj.codeMap;
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint your code via [grunt](http://gruntjs.com/) and test via `npm test`.

## License
Copyright (c) 2012 Todd Wolfson
The Software shall be used for Good, not Evil. (see LICENSE)