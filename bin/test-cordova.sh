#!/bin/bash

echo "Running dev server..."
./bin/dev-server.js &
export DEV_SERVER_PID=$!

echo "Running Appium..."
./node_modules/.bin/appium &
export APPIUM_SERVER_PID=$!

echo "Installing and starting Cordova app..."
npm run cordova

echo "Testing with Appium..."
npm run test-appium

EXIT_STATUS=$?
if [[ ! -z $DEV_SERVER_PID ]]; then
  kill $DEV_SERVER_PID
fi
if [[ ! -z $APPIUM_SERVER_PID ]]; then
  kill $APPIUM_SERVER_PID
fi
exit $EXIT_STATUS