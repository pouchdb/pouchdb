#!/bin/bash
git clone https://github.com/daleharvey/CORS-Proxy.git
node CORS-Proxy/server.js &
node_pid=$!
python -m SimpleHTTPServer &
python_pid=$!
sleep 3
java_pid = java -jar Sauce-Connect.jar ryanramage b8f74e0a-c3f7-4aeb-8497-1035cd4c2c84
sleep 20
node run_saucelabs.js
kill -9 $node_pid
kill -9 $python_pid
kill -9 $java_pid