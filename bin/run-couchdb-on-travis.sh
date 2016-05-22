#!/usr/bin/env bash

if [ $SERVER == 'couchdb-master' ]; then
  # Install CouchDB Master
  docker run -d -p 3001:5984 klaemo/couchdb:2.0-dev --with-haproxy \
    --with-admin-party-please -n 1
  COUCH_PORT=3001
else
  # Install CouchDB Stable
  docker run -d -p 3000:5984 klaemo/couchdb:1.6.1
  COUCH_PORT=3000
fi

# wait for couchdb to start, add cors
npm install add-cors-to-couchdb
while [ '200' != $(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:${COUCH_PORT}) ]; do
  echo waiting for couch to load... ;
  sleep 1;
done
./node_modules/.bin/add-cors-to-couchdb http://127.0.0.1:${COUCH_PORT}
