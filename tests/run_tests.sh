#!/bin/bash
npm install soda
npm install assert
git clone https://github.com/daleharvey/CORS-Proxy.git
cd CORS-Proxy
export PORT=2020
node server.js &
node_pid=$!
cd ..
python -m SimpleHTTPServer &
python_pid=$!
sleep 3
java -jar tests/Sauce-Connect.jar ryanramage b8f74e0a-c3f7-4aeb-8497-1035cd4c2c84 &
java_pid=$!
sleep 60
git_hash=`git rev-list HEAD --max-count=1`
echo ${git_hash}
node tests/run_saucelabs.js ${git_hash}
kill -9 $node_pid
kill -9 $python_pid
kill $java_pid