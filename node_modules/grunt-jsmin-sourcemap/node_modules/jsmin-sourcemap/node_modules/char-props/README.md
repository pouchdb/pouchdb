# char-props

Utility for looking up line and column of a character at a given index and vice versa.

## Getting Started
Install the module with: `npm install charProps`

## Documentation
```js
// charProps is a function which invokes the Indexer constructor

// Indexer JSDoc
/**
 * Indexer constructor (takes index and performs pre-emptive caching)
 * @constructor
 * @param {String} input Content to index
 */

// Indexer.lineAt JSDoc
/**
 * Get the line of the character at a certain index
 * @param {Number} index Index of character to retrieve line of
 * @param {Object} [options] Options to use for search
 * @param {Number} [options.minLine=0] Minimum line for us to search on
 * TODO: The following still have to be built/implemented
 * @param {Number} [options.maxLine=lines.length] Maximum line for us to search on
 * @param {String} [options.guess="average"] Affects searching pattern -- can be "high", "low", or "average" (linear top-down, linear bottom-up, or binary)
 * @returns {Number} Line number of character
 */

// Indexer.columnAt JSDoc
/**
 * Get the column of the character at a certain index
 * @param {Number} index Index of character to retrieve column of
 * @returns {Number} Column number of character
 */

// Indexer.indexAt JSDoc
/**
 * Get the index of the character at a line and column
 * @param {Object} params Object containing line and column
 * @param {Number} params.line Line of character
 * @param {Number} params.column Column of character
 * @returns {Number} Index of character
 */

// Indexer.charAt JSDoc
/**
 * Get the character at a line and column
 * @param {Object} params Object containing line and column
 * @param {Number} params.line Line of character
 * @param {Number} params.column Column of character
 * @returns {String} Character at specified location
 */
```

## Examples
### Initial load
```js
var charProps = require('char-props'),
    jquerySrc = fs.readFileSync('jquery.js', 'utf8');

// Load jQuery into charProps
var jqueryProps = charProps(jquerySrc);
```

### lineAt usage
```js
// Look up line of character at index 42
jqueryProps.lineAt(42);
```

### columnAt usage
```js
// Look up column of character at index 88
jqueryProps.columnAt(88);
```

### indexAt usage
```js
// Look up the index of a character at line 9000, column 1
jqueryProps.indexAt({'line': 9000, 'column': 1});
```

### charAt usage
```js
// Get the character at line 20, column 20
jqueryProps.charAt({'line': 20, 'column': 20});
```

## lineAt advanced usage
```js
// Look up line of character at index 9001 with a minimum line of 99
jqueryProps.lineAt(9001, {'minLine': 99});
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint your code via [grunt](http://gruntjs.com/) and test via [vows](http://vowsjs.org/).

## License
Copyright (c) 2012 Todd Wolfson
Licensed under the MIT license.
