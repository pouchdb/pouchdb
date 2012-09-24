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
java -jar tests/Sauce-Connect.jar pouchdb 97de9ee0-2712-49f0-9b17-4b9751d79073 &
java_pid=$!
sleep 60
node tests/run_saucelabs.js
kill -9 $node_pid
kill -9 $python_pid
kill $java_pid