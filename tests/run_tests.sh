#!/bin/bash
cd CORS-Proxy
node server.js &
node_pid=$!
cd ..
python -m SimpleHTTPServer &
python_pid=$!
sleep 3
java -jar tests/Sauce-Connect.jar pouchdb 97de9ee0-2712-49f0-9b17-4b9751d79073 &
java_pid=$!
sleep 60
git_hash=`git rev-list HEAD --max-count=1`
echo ${git_hash}
node tests/run_saucelabs.js ${git_hash}
return_val=$?
kill -9 $node_pid
kill -9 $python_pid
kill $java_pid
exit $return_val