#!/bin/bash
set -e
set -x

CWD=$(pwd)

# Install CSG
curl -o csg.deb http://latestbuilds.hq.couchbase.com/couchbase-sync-gateway/0.0.0/0.0.0-358/couchbase-sync-gateway-community_0.0.0-358_x86_64.deb

sudo dpkg -i csg.deb

# Run CSG
/opt/couchbase-sync-gateway/bin/sync_gateway ./tests/misc/sync-gateway-config.json >sg.log 2>&1 < /dev/null &

# Lets get rid of this at some point :)
sleep 2

cd $CWD
