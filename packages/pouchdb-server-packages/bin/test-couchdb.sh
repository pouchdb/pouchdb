#!/bin/bash

# use config file instead of command line option because
# couchdb-harness depends on the fact that /_config/httpd/port equals
# the port on which pouchdb-server is running.
echo '{"httpd": {"port": 6984}}' > config.json
./packages/node_modules/pouchdb-server/bin/pouchdb-server &
export POUCHDB_SERVER_PID=$!
./node_modules/couchdb-harness/bin/couchdb-harness -p 6984

EXIT_STATUS=$?
if [[ ! -z $POUCHDB_SERVER_PID ]]; then
  kill $POUCHDB_SERVER_PID
fi
exit $EXIT_STATUS
