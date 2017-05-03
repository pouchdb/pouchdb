var fs = require('fs'),
    jsminc = fs.readFileSync(__dirname + '/jsmin.c', 'utf8');

// Strip out includes
jsminc = jsminc.replace(/#include[^\n]+\s*/g, '');

// Replace static int with 'the' prefixes with vars
jsminc = jsminc.replace(/static int\s+(the[^\n]+)/g, function (_, varStr) {
  return 'var ' + varStr;
});

// Throw in an EOF before the first theA
jsminc = jsminc.replace('var theA;', 'var EOF = -1;\nvar theA;');

// Replace static void and static int with function
jsminc = jsminc.replace(/static void[^A-Za-z]*/g, 'function ');
jsminc = jsminc.replace(/static int[^A-Za-z]*/g, 'function ');
jsminc = jsminc.replace(/extern int[^A-Za-z]*/g, 'function ');

// Remove types from function statements
jsminc = jsminc.replace(/function ([^\(]+)\(([^\)]*)\)[^{]+/g, function (_, fnName, params) {
  var paramArr = params.split(', '),
      cleanParamArr = paramArr.map(function (param) {
        var paramSansFront = param.replace(/^[^\s]+\s+/, ''),
            paramSansBack = paramSansFront.replace('[]', '');
        return paramSansBack;
      }),
      cleanParams = cleanParamArr.join(', ');

  return 'function ' + fnName + '(' + cleanParams + ') ';
});

// Replace types inside functions with vars
jsminc = jsminc.replace(/int /g, 'var ');

// Upcase equality to strict equality
jsminc = jsminc.replace(/==/g, '===');
jsminc = jsminc.replace(/!=/g, '!==');

// Upcast jsmin into a reusable module
// TODO: This step is too damn big
jsminc = jsminc.replace(/var EOF = -1;(.|\n)*/, function (jsmin) {
  // Generate prefix text and indent all of jsmin
  var prefix = 'function jsminFn(stdin, options) {',
      prefixToIndent = [
        '',
        '// Fallback options',
        'options = options || {};',
        '',
        '// Grab stdout, stderr, exit, argc, and argv',
        'var stdout = options.stdout || console.log,',
        '    stderr = options.stderr || console.error,',
        '    exit = options.exit || process.exit,',
        '    argc = options.argc || 0,',
        '    argv = options.argv || [];',
        '',
        '// Generate fputs, fputc, getc, putc, fprintf',
        'var fputs = function (str, stream) {',
        '      stream(str);',
        '    },',
        '    fputc = fputs,',
        '    putc = fputs,',
        '    fprintf = function (stream, formatStr, input) {',
        '      var outStr = formatStr.replace(\'%s\', input);',
        '      fputs(outStr, stream);',
        '    },',
        '    getc = function () {',
        '      return stdin.read(1);',
        '    };',
        '',
        '// Begin normal jsmin.c code',
        ''
      ].join('\n');

  // Add prefix to indent onto jsmin
  jsmin = prefixToIndent + jsmin;

  // Indent jsmin
  var jsminIndented = jsmin.replace(/\n([^\n])/g, function (_, letter) {
        return '\n    ' + letter;
      });

  // Join together prefix and jsmin and return
  var retVal = prefix + jsminIndented;
  return retVal;
});

jsminc = jsminc + [
    '',
    '    // Invoke and return main',
    '    return main(argc, argv);',
    '',
    '}',
    '',
    '// Export jsminFn',
    'module.exports = jsminFn;'
  ].join('\n');

// Write out the converted file
fs.writeFileSync(__dirname + '/../lib/jsmin.c.js', jsminc, 'utf8');