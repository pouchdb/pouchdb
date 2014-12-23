#!/bin/bash
set -e
set -x

CWD=$(pwd)

# Install deps
sudo apt-get update
sudo apt-get --no-install-recommends -y install \
    build-essential \
    ca-certificates \
    curl \
    erlang-dev \
    erlang-nox \
    git \
    libicu-dev \
    libmozjs185-dev \
    python

# Rebar isnt in apt
git clone git://github.com/rebar/rebar.git ~/rebar
cd ~/rebar
./bootstrap
sudo cp ./rebar /usr/local/bin

# Sweet, build CouchDB
cd ..
git clone https://github.com/apache/couchdb.git ~/couchdb
cd ~/couchdb
./configure
make

# All done, run a cluster
python dev/run -n 1 &

# Lets get rid of this at some point :)
sleep 10

cd $CWD
