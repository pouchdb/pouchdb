#!/bin/bash

./node_modules/.bin/appium &
BUILD=true npm run cordova
CORDOVA=true npm run test-browser