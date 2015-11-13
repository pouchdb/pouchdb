#!/bin/bash
set -e
set -x

CWD=$(pwd)

sudo apt-get remove erlang-base erlang-crypto erlang-base-hipe
sudo apt-get -y install haproxy default-jdk libwxgtk3.0
wget http://packages.erlang-solutions.com/site/esl/esl-erlang/FLAVOUR_1_general/esl-erlang_18.1-1~ubuntu~precise_amd64.deb
sudo dpkg -i esl-erlang_18.1-1~ubuntu~precise_amd64.deb

# Sweet, build CouchDB
git clone https://github.com/apache/couchdb.git ~/couchdb
cd ~/couchdb
./configure --disable-docs --disable-fauxton
make

# All done, run a cluster
python dev/run -n 1 --with-admin-party-please --with-haproxy &
sleep 10

cd $CWD
