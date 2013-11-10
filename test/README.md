This is an experimental change to our test suite to more easily
run tests in both browser + node, to run the current test suite

    $ node test/unit/merge_rev_tree_test.js

for node, and

    $ browserify test/unit/merge_rev_tree_test.js | testling

for the browser.

Currently this requires manual shutdown of the browser in OSX, you must
also:

    $ npm install tape
    $ npm install -g testling
