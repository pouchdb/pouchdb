/* jsmin.c
   2012-07-02

Copyright (c) 2002 Douglas Crockford  (www.crockford.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

The Software shall be used for Good, not Evil.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

function jsminFn(stdin, options) {
    // Fallback options
    options = options || {};

    // Grab stdout, stderr, exit, argc, and argv
    var stdout = options.stdout || console.log,
        stderr = options.stderr || console.error,
        exit = options.exit || process.exit,
        argc = options.argc || 0,
        argv = options.argv || [];

    // Generate fputs, fputc, getc, putc, fprintf
    var fputs = function (str, stream) {
          stream.write(str);
        },
        fputc = fputs,
        putc = fputs,
        fprintf = function (stream, formatStr, input) {
          var outStr = formatStr.replace('%s', input);
          fputs(outStr, stream);
        },
        getc = function () {
          return stdin.read(1);
        };
function puti(index, stream) {
    stream.writeFromIndex(index);
}

    // Begin normal jsmin.c code
    var EOF = -1;
    var theA;
    var theB;
    var theLookahead = EOF;
    var theX = EOF;
    var theY = EOF;
var getIndex = -1;
var peekIndex = -1;
var nextIndex = -1;
var theAIndex = -1;
var theBIndex = -1;
function geti(stream) {
    return stream.getIndex();
}
function getChar(index, stream) {
    var retVal = '\n';
    if (index >= 0) {
        retVal = stream.charAt(index);
    }

    return retVal;
}
var assert = require('assert');

    function error(s) {
        fputs("JSMIN Error: ", stderr);
        fputs(s, stderr);
        fputc('\n', stderr);
        exit(1);
    }

    /* isAlphanum -- return true if the character is a letter, digit, underscore,
            dollar sign, or non-ASCII character.
    */

    function isAlphanum(c) {
        return ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
            (c >= 'A' && c <= 'Z') || c === '_' || c === '$' || c === '\\' ||
            c > 126);
    }


    /* get -- return the next character from stdin. Watch out for lookahead. If
            the character is a control character, translate it to a space or
            linefeed.
    */

    function get() {
        var c = theLookahead;
        theLookahead = EOF;
        if (c === EOF) {
getIndex = geti(stdin);
            c = getc(stdin);
assert.strictEqual(getChar(getIndex, stdin), c);
            theY = theX;
            theX = c;
        }
        if (c >= ' ' || c === '\n' || c === EOF) {
            return c;
        }
        if (c === '\r') {
            return '\n';
        }
        return ' ';
    }


    /* peek -- get the next character without getting it.
    */

    function peek() {
        theLookahead = get();
peekIndex = getIndex;
        return theLookahead;
    }


    /* next -- get the next character, excluding comments. peek() is used to see
            if a '/' is followed by a '/' or '*'.
    */

    function next() {
        var c = get();
nextIndex = getIndex;
        if  (c === '/') {
            switch (peek()) {
            case '/':
                for (;;) {
                    c = get();
nextIndex = getIndex;
                    if (c <= '\n') {
                        return c;
                    }
                }
            case '*':
                get();
nextIndex = getIndex;
                for (;;) {
                    switch (get()) {
                    case '*':
                        if (peek() === '/') {
                            get();
nextIndex = getIndex;
                            return ' ';
                        }
                        break;
                    case EOF:
                        error("Unterminated comment.");
                    }
nextIndex = getIndex;
                }
            default:
                return c;
            }
        }
        return c;
    }


    /* action -- do something! What you do is determined by the argument:
            1   Output A. Copy B to A. Get the next B.
            2   Copy B to A. Get the next B. (Delete A).
            3   Get the next B. (Delete B).
       action treats a string as a single character. Wow!
       action recognizes a regular expression if it is preceded by ( or , or =.
    */

    function action(d) {
        switch (d) {
        case 1:
assert.strictEqual(getChar(theAIndex, stdin), theA);
            puti(theAIndex, stdout);
            if (theA === theB && (theA === '+' || theA === '-') && theY !== theA) {
                putc(' ', stdout);
            }
        case 2:
            theA = theB;
theAIndex = theBIndex;
            if (theA === '\'' || theA === '"' || theA === '`') {
                for (;;) {
assert.strictEqual(getChar(theAIndex, stdin), theA);
                    puti(theAIndex, stdout);
                    theA = get();
theAIndex = getIndex;
                    if (theA === theB) {
                        break;
                    }
                    if (theA === '\\') {
assert.strictEqual(getChar(theAIndex, stdin), theA);
                        puti(theAIndex, stdout);
                        theA = get();
theAIndex = getIndex;
                    }
                    if (theA === EOF) {
                        error("Unterminated string literal.");
                    }
                }
            }
        case 3:
            theB = next();
theBIndex = nextIndex;
            if (theB === '/' && (theA === '(' || theA === ',' || theA === '=' ||
                                theA === ':' || theA === '[' || theA === '!' ||
                                theA === '&' || theA === '|' || theA === '?' ||
                                theA === '{' || theA === '}' || theA === ';' ||
                                theA === '\n')) {
assert.strictEqual(getChar(theAIndex, stdin), theA);
assert.strictEqual(getChar(theBIndex, stdin), theB);
                puti(theAIndex, stdout);
                puti(theBIndex, stdout);
                for (;;) {
                    theA = get();
theAIndex = getIndex;
                    if (theA === '[') {
                        for (;;) {
assert.strictEqual(getChar(theAIndex, stdin), theA);
                            puti(theAIndex, stdout);
                            theA = get();
theAIndex = getIndex;
                            if (theA === ']') {
                                break;
                            }
                            if (theA === '\\') {
assert.strictEqual(getChar(theAIndex, stdin), theA);
                                puti(theAIndex, stdout);
                                theA = get();
theAIndex = getIndex;
                            }
                            if (theA === EOF) {
                                error("Unterminated set in Regular Expression literal.");
                            }
                        }
                    } else if (theA === '/') {
                        break;
                    } else if (theA ==='\\') {
assert.strictEqual(getChar(theAIndex, stdin), theA);
                        puti(theAIndex, stdout);
                        theA = get();
theAIndex = getIndex;
                    }
                    if (theA === EOF) {
                        error("Unterminated Regular Expression literal.");
                    }
assert.strictEqual(getChar(theAIndex, stdin), theA);
                    puti(theAIndex, stdout);
                }
                theB = next();
theBIndex = nextIndex;
            }
        }
    }


    /* jsmin -- Copy the input to the output, deleting the characters which are
            insignificant to JavaScript. Comments will be removed. Tabs will be
            replaced with spaces. Carriage returns will be replaced with linefeeds.
            Most spaces and linefeeds will be removed.
    */

    function jsmin() {
        if (peek() === 0xEF) {
            get();
            get();
            get();
        }
        theA = '\n';
        action(3);
        while (theA !== EOF) {
            switch (theA) {
            case ' ':
                if (isAlphanum(theB)) {
                    action(1);
                } else {
                    action(2);
                }
                break;
            case '\n':
                switch (theB) {
                case '{':
                case '[':
                case '(':
                case '+':
                case '-':
                case '!':
                case '~':
                    action(1);
                    break;
                case ' ':
                    action(3);
                    break;
                default:
                    if (isAlphanum(theB)) {
                        action(1);
                    } else {
                        action(2);
                    }
                }
                break;
            default:
                switch (theB) {
                case ' ':
                    if (isAlphanum(theA)) {
                        action(1);
                        break;
                    }
                    action(3);
                    break;
                case '\n':
                    switch (theA) {
                    case '}':
                    case ']':
                    case ')':
                    case '+':
                    case '-':
                    case '"':
                    case '\'':
                    case '`':
                        action(1);
                        break;
                    default:
                        if (isAlphanum(theA)) {
                            action(1);
                        } else {
                            action(3);
                        }
                    }
                    break;
                default:
                    action(1);
                    break;
                }
            }
        }
    }


    /* main -- Output any command line arguments as comments
            and then minify the input.
    */
    function main(argc, argv) {
        var i;
        for (i = 1; i < argc; i += 1) {
            fprintf(stdout, "// %s\n", argv[i]);
        }
        jsmin();
        return 0;
    }

    // Invoke and return main
    return main(argc, argv);

}

// Export jsminFn
module.exports = jsminFn;