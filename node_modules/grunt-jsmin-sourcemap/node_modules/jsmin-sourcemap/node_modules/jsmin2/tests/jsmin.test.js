var fs = require('fs'),
    assert = require('assert'),
    jsmin = require('../lib/jsmin'),
    testFilesDir = __dirname + '/test_files',
    expectedDir = __dirname + '/expected_files',
    jQuerySrc = fs.readFileSync(testFilesDir + '/jquery.js', 'utf8'),
    expectedJQuery = fs.readFileSync(expectedDir + '/jquery.min.js', 'utf8'),
    actualJQuery = jsmin(jQuerySrc),
    actualJQueryCode = actualJQuery.code,
    actualJQueryMap = actualJQuery.codeMap;

// Assert that the minified jQuery matches the expected version
assert.strictEqual(expectedJQuery, actualJQueryCode, 'Minified jQuery does not match as expected.');

// Reverse the map for checking
var codeMap = {};
Object.getOwnPropertyNames(actualJQueryMap).forEach(function (srcPoint) {
  var destPoint = actualJQueryMap[srcPoint];
  codeMap[destPoint] = srcPoint;
});

// Assert that the mapping is proper
var i = 0,
    len = actualJQueryCode.length,
    srcIndex,
    char,
    srcChar;
for (; i < len; i++) {
  char = actualJQueryCode.charAt(i);
  srcIndex = codeMap[i];
  srcChar = jQuerySrc.charAt(srcIndex);

  // Debug here
  // console.log(char, srcChar);

  // Assert that the char and srcChar line up
  assert.strictEqual(char, srcChar, 'Character at ' + i + ' does not match source character at ' + srcIndex + '.');
}

// Assert that basic matches as expected
var basicSrc = fs.readFileSync(testFilesDir + '/basic.js', 'utf8'),
    expectedBasic = fs.readFileSync(expectedDir + '/basic.min.js', 'utf8'),
    actualBasic = jsmin(basicSrc),
    actualBasicCode = actualBasic.code,
    actualBasicMap = actualBasic.codeMap;

assert.strictEqual(expectedBasic, actualBasicCode, 'Minified basic does not match as expected.');

// Reverse the map for checking
var codeMap = {};
Object.getOwnPropertyNames(actualBasicMap).forEach(function (srcPoint) {
  var destPoint = actualBasicMap[srcPoint];
  codeMap[destPoint] = srcPoint;
});

// Assert that the mapping is proper
var i = 0,
    len = actualBasicCode.length,
    srcIndex,
    char,
    srcChar,
    timesSkipped = 0;
for (; i < len; i++) {
  char = actualBasicCode.charAt(i);
  srcIndex = codeMap[i];

  if (srcIndex !== undefined) {
    srcChar = basicSrc.charAt(srcIndex);

    // Debug here
    // console.log(char, srcChar);

    // Assert that the char and srcChar line up
    assert.strictEqual(char, srcChar, 'Character at ' + i + ' does not match source character at ' + srcIndex + '.');
  } else {
    timesSkipped += 1;
  }
}

// Assert that during the mapping we skipped at most once
assert.ok(timesSkipped <= 1, 'During mapping, we skipped at most once');

// Log success when done
console.log('Success!');