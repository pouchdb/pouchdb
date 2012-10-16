#!/bin/bash

# Make the release build
make min

# Start a cors proxy
cd CORS-Proxy
node server.js &
node_pid=$!

# Start a local server
cd ..
python -m SimpleHTTPServer &
python_pid=$!
sleep 3

# Start the connection to saucelabs
java -jar tests/Sauce-Connect.jar pouchdb 97de9ee0-2712-49f0-9b17-4b9751d79073 &
java_pid=$!
sleep 60

# Run the test script
git_hash=`git rev-list HEAD --max-count=1`
echo ${git_hash}
node tests/run_saucelabs.js ${git_hash}
return_val=$?

# kill running service
kill -9 $node_pid
kill -9 $python_pid
kill $java_pid

# Report success or failure
exit $return_val