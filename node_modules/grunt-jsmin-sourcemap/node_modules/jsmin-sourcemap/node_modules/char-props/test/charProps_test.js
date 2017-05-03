var vows = require('vows'),
    assert = require('assert'),
    charProps = require('../lib/charProps.js'),
    suite = vows.describe('charProps');

var file = [
  // line, col, charCount (including line breaks)
  'line 1', // 0, 5, 5
  'another second line', // 1, 19, 25 (5 + 1 + 19)
  '3rd line!', // 2, 9, 35 (25 + 1 + 9)
  'line fourrrrrrrrr' // 3, 17, 53 (35 + 1 + 17)
].join('\n');

// Basic tests
suite.addBatch({
  'A new Indexer': {
    topic: function () {
      return charProps(file);
    },
    'can find the line of a character at a given index': function (indexer) {
      var index = 20, // d in 'second'
          char = file.charAt(index);

      // Sanity check
      assert.strictEqual(char, 'd', 'The character we are the line of finding is "d"');

      // Grab the line number of char
      var line = indexer.lineAt(index);

      // Assert the 'second' is on the second line
      assert.strictEqual(line, 1, 'The character at index 20 is on the second line');
    },
    'can find the column of a character at a given index': function (indexer) {
      var index = 35, // ! in 'line!'
          char = file.charAt(index);

      // Sanity check
      assert.strictEqual(char, '!', 'The character we are the column of finding is "!"');

      // Grab the column number of char
      var col = indexer.columnAt(index);

      // Assert it is in the eigth column
      assert.strictEqual(col, 8, 'The character at index 35 is in the ninth column');
    },
    'can find the index of a character at a given column and line': function (indexer) {
      var location = {
            'line': 2,
            'column': 8
          };

      // Grab the index of our locaiton
      var index = indexer.indexAt(location);

      assert.strictEqual(index, 35, 'The character at line 2 and column 8 is index 35');
    }
  }
});

// Intermediate tests
suite.addBatch({
  'A new Indexer': {
    topic: function () {
      return charProps(file);
    },
    'can find the line of a character at a given index using a minimum line': function (indexer) {
      var index = 43, // o in 'fourrrr'
          char = file.charAt(index);

      // Sanity check
      assert.strictEqual(char, 'o', 'The character we are the line of finding is "o"');

      // Grab the line number of char
      var line = indexer.lineAt(index, {'minLine': 3});

      // Assert it is in the fourth line
      assert.strictEqual(line, 3, 'The character at index 42 is on the fourth line');
    },
    'can get the character at a given column and line': function (indexer) {
      var location = {
            'line': 3,
            'column': 6
          };

      // Grab the character at our locaiton
      var char = indexer.charAt(location);

      assert.strictEqual(char, 'o', 'The character at line 3 and column 6 is "o"');
    }
  }
});

// Edge cases
suite.addBatch({
  'A new Indexer': {
    topic: function () {
      return charProps(file);
    },
    'considers a line feed part of the past line': function (indexer) {
      var index = 26, // \n of line 3
          char = file.charAt(index);

      // Sanity check
      assert.strictEqual(char, '\n', 'The character we are the column of finding is a line feed');

      // Grab the line number of char
      var line = indexer.lineAt(index);

      // Assert it is on the second line
      assert.strictEqual(line, 1, 'The character at index 26 on the second line');

      // Grab the column number of char
      var col = indexer.columnAt(index);

      // Assert it is in the nineteenth column
      assert.strictEqual(col, 19, 'The character at index 26 is in the nineteenth column');
    },
    'considers the first character of a line to be on that line': function (indexer) {
      var index = 27, // 3 of line 3
          char = file.charAt(index);

      // Sanity check
      assert.strictEqual(char, '3', 'The character we are the positions of finding is 3');

      // Grab the line number of char
      var line = indexer.lineAt(index);

      // Assert it is on the third line
      assert.strictEqual(line, 2, 'The character at index 27 on the third line');

      // Grab the column number of char
      var col = indexer.columnAt(index);

      // Assert it is in the zeroth column
      assert.strictEqual(col, 0, 'The character at index 27 is in the zero-th column');
    },
    'considers the last character of a line to be on that line': function (indexer) {
      var index = 5, // 1 of line 1
          char = file.charAt(index);

      // Sanity check
      assert.strictEqual(char, '1', 'The character we are the positions of finding is 1');

      // Grab the line number of char
      var line = indexer.lineAt(index);

      // Assert it is on the first line
      assert.strictEqual(line, 0, 'The character at index 6 on the first line');

      // Grab the column number of char
      var col = indexer.columnAt(index);

      // Assert it is in the fifth column
      assert.strictEqual(col, 5, 'The character at index 6 is in the fifth column');
    }
  }
});

// Export the suite
suite['export'](module);