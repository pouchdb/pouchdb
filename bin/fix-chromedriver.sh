#!/usr/bin/env bash

# TODO: once chromedriver 2.13 is bundled with appium,
# we can get rid of this

if [[ -x $(which md5) ]]; then
  MD5=md5
else
  MD5=md5sum
fi

CHROMEDRIVER_DIR=node_modules/appium//build/chromedriver

echo "updating chromedriver to 2.13"

if [[ -z $($MD5 $CHROMEDRIVER_DIR/mac/chromedriver | grep 92803b51c1f1191c47d35424fb1c917c) ]]; then
  curl -sO http://chromedriver.storage.googleapis.com/2.13/chromedriver_mac32.zip
  unzip chromedriver_mac32.zip
  rm -f chromedriver_mac32.zip
  mv -f chromedriver $CHROMEDRIVER_DIR/mac/chromedriver
fi

if [[ -z $($MD5 $CHROMEDRIVER_DIR/linux/chromedriver32 | grep 5699eefc62c4530caf1d3e5e34e3d4c7) ]]; then
  curl -sO http://chromedriver.storage.googleapis.com/2.13/chromedriver_linux32.zip
  unzip chromedriver_linux32.zip
  rm -f chromedriver_linux32.zip
  mv -f chromedriver $CHROMEDRIVER_DIR/linux/chromedriver32
fi

if [[ -z $($MD5 $CHROMEDRIVER_DIR/linux/chromedriver64 | grep fd7819e4999450e717d8b8ec1e9fa8fe) ]]; then
  curl -sO http://chromedriver.storage.googleapis.com/2.13/chromedriver_linux64.zip
  unzip chromedriver_linux64.zip
  rm -f chromedriver_linux64.zip
  mv -f chromedriver $CHROMEDRIVER_DIR/linux/chromedriver64
fi

if [[ -z $($MD5 $CHROMEDRIVER_DIR/windows/chromedriver.exe | grep 4b4ef9e3432aa84aed190457b68c01ad) ]]; then
  curl -sO http://chromedriver.storage.googleapis.com/2.13/chromedriver_win32.zip
  unzip chromedriver_win32.zip
  rm -f chromedriver_win32.zip
  mv -f chromedriver.exe $CHROMEDRIVER_DIR/windows/chromedriver.exe
fi

echo "chromedriver updated to 2.13"
