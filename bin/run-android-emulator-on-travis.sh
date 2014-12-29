#!/bin/bash
set -e
set -x

CWD=$(pwd)

# Install deps
sudo apt-get update
sudo apt-get --no-install-recommends -y install \
    ant \
    curl

# download android sdk

curl -sLO http://dl.google.com/android/android-sdk_r24.0.2-linux.tgz
tar -xzf android-sdk_r24.0.2-linux.tgz

export ANDROID_HOME=$CWD/android-sdk-linux
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools

# install sdk tools, android sys images

( sleep 5 && while [ 1 ]; do sleep 1; echo y; done ) | android update sdk --no-ui --filter platform-tool,android-19,sysimg-19,build-tools-19.0.1

# set up the emulator

android create avd --force -n test -t android-19 --abi x86
emulator -avd test -no-skin -no-audio -no-window &

# wait for android emulator to start
sleep 120
