/**
 * jsmin - Refer to LICENSE in base directory
 * @param {String} input JavaScript to minifiy
 * @return {Object} retObj
 * @return {String} retObj.code Minified JavaScript
 * @return {Object} retObj.codeMap Point to point map from source JavaScript to minified JavaScript
 */
var jsminc = require('./jsmin.c.index');
function jsmin(input) {
  var EOF = -1,
      stdin = {
        'index': 0,
        'end': input.length,
        'read': function (len) {
          // For now only handle len = 1
          if (len !== 1) {
            throw new Error('You can only read one character from input at a time.');
          }

          // If we are at the end, return EOF (-1)
          var index = stdin.index;
          if (index === stdin.end) {
            return EOF;
          }

          // Read the input at our index
          var char = input[index];

          // Increment our index
          stdin.index = index + 1;

          // Return char
          return char;
        },
        'getIndex': function () {
          return stdin.index;
        },
        // Helper for verifying during dev
        'charAt': function (index) {
          return (index >= stdin.end) ? EOF : input.charAt(index);
        }
      },
      map = {},
      output = '',
      options = {
        'error': '',
        'stdout': {
          'write': function (str) {
            // Add the string to output
            output += str;
          },
          'writeFromIndex': function (index) {
            var char = '\n';

            // If we are at a positive index
            if (index >= 0) {
              // Grab the char from its index
              char = input.charAt(index);

              // Get the length of the current output
              var len = output.length;

              // Map the sourceIndex to the destIndex
              map[index] = len;
            }

            // Output the char to output
            output += char;
          }
        },
        'stderr': function (err) {
          // Add the error to output
          options.error += err;
        },
        'exit': function (code) {
          // Throw the collective error
          throw new Error(options.error);
        }
      };

  // Run jsminc
  jsminc(stdin, options);

  // Return the output and map
  var retObj = {
    'code': output,
    'codeMap': map
  };
  return retObj;
}

// Expose jsmin to the world
module.exports = jsmin;