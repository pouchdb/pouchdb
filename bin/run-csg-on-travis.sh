#!/bin/bash
set -e
set -x

CWD=$(pwd)

# Install CSG
curl -o csg.deb http://packages.couchbase.com/releases/couchbase-sync-gateway/1.0.3/couchbase-sync-gateway-community_1.0.3_x86_64.deb

dpkg --extract csg.deb csg
cd csg/

# Run CSG
./opt/couchbase-sync-gateway/bin/sync_gateway ../tests/misc/sync-gateway-config.json >sg.log 2>&1 < /dev/null &

# Lets get rid of this at some point :)
sleep 2

cd $CWD
