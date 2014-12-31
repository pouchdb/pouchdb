#!/bin/bash

if [[ "$TRAVIS_REPO_SLUG" == "pouchdb/pouchdb" ]]; then
  echo "Running Android in Travis..."
  ./bin/run-android-emulator-on-travis.sh
  export ANDROID_HOME=$(pwd)/android-sdk-linux
  export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
fi

echo "Building Cordova app..."
npm run build-cordova

echo "Fixing chromedriver..."
./bin/fix-chromedriver.sh

echo "Running dev server..."
./bin/dev-server.js &
export DEV_SERVER_PID=$!

echo "Running Appium..."
./node_modules/.bin/appium &
export APPIUM_SERVER_PID=$!

# wait for appium, emulator, and dev server to start
sleep 60

adb lolcat &

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
