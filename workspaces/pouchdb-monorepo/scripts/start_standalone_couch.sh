#!/bin/bash -e

# Start a standalone CouchDB, this is a wrapper around the $ couchdb
# command that will create a standalone instance of CouchDB allowing
# you to easily run serveral servers in parallel, each instance starts
# on an ephemeral port and has a dedicated directory for its data and logs
# use the couch.uri file to locate the host
#
# Run as:
#
# $ ./start_standalone_couch.sh ~/data/instanceId

COUCH_DIR=$1

# Make all the directories
mkdir -p $COUCH_DIR/data/views

# Create a standalone configuration based on the directory
# we are passed in, CouchDB will start on a random port and couch.uri
# will tell us where that is, data is stored within the directory
echo "[httpd]
bind_address = 127.0.0.1
port = 0

[log]
level = debug
file = $COUCH_DIR/couch.log

[couchdb]
database_dir = $COUCH_DIR/data
view_index_dir = $COUCH_DIR/data/views
uri_file = $COUCH_DIR/couch.uri" > $COUCH_DIR/couch.ini

couchdb -a $COUCH_DIR/couch.ini