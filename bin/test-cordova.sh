#!/bin/bash

echo "Building Cordova app..."
npm run build-cordova

echo "Running dev server..."
./bin/dev-server.js &
export DEV_SERVER_PID=$!

echo "Running Appium..."
./node_modules/.bin/appium &
export APPIUM_SERVER_PID=$!

echo "Starting emulator..."
echo no | android create avd --force -n test -t android-19 --abi x86
emulator -avd test -no-skin -no-audio -no-window &
export EMULATOR_PID=$!
./bin/android-wait-for-emulator.sh
adb shell input keyevent 82

echo "Testing with Appium..."
npm run test-appium

EXIT_STATUS=$?
if [[ ! -z $DEV_SERVER_PID ]]; then
  kill $DEV_SERVER_PID
fi
if [[ ! -z $APPIUM_SERVER_PID ]]; then
  kill $APPIUM_SERVER_PID
fi
if [[ ! -z $EMULATOR_PID ]]; then
  kill $EMULATOR_PID
fi
exit $EXIT_STATUS
