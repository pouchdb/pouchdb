#!/bin/bash
set -e
set -x

CWD=$(pwd)

# Rebar isnt in apt
git clone git://github.com/rebar/rebar.git ~/rebar
cd ~/rebar
./bootstrap
export PATH=$(pwd):$PATH

# Sweet, build CouchDB
cd ..
git clone https://github.com/apache/couchdb.git ~/couchdb
cd ~/couchdb
./configure --disable-docs
make

# All done, run a cluster
python dev/run -n 1 --with-admin-party-please &

cd $CWD
