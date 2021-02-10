#!/usr/bin/env bash
COUCHDB_USER=admin
COUCHDB_PASSWORD=some-temporary-password

if [ "$SERVER" = "couchdb-master" ]; then
  # Install CouchDB latest 3.X at the time of writing (clustered)
  docker run -d -e COUCHDB_USER=${COUCHDB_USER} -e COUCHDB_PASSWORD=${COUCHDB_PASSWORD} -p 3001:5984 apache/couchdb:latest --with-haproxy -n 1
  COUCH_PORT=3001
elif [ "$SERVER" == "couchdb-v2" ]; then
  # Install CouchDB 2.X (clustered)
  docker run -d -p 3002:5984 apache/couchdb:2 --with-haproxy --with-admin-party-please -n 1
  COUCH_PORT=3002
else
  # Install CouchDB 1.X
  docker run -d -p 3000:5984 apache/couchdb:1
  COUCH_PORT=3000
fi

# wait for couchdb to start, add cors
npm install add-cors-to-couchdb
while [ '200' != $(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:${COUCH_PORT}) ]; do
  echo waiting for couch to load... ;
  sleep 1;
done

if [ "$SERVER" = "couchdb-master" ]; then
	curl -s -X PUT "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@127.0.0.1:${COUCH_PORT}/_node/_local/_config/couchdb/default_security"  -d '"everyone"'
	curl -s -X DELETE "http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@127.0.0.1:${COUCH_PORT}/_node/_local/_config/admins/admin"
fi

./node_modules/.bin/add-cors-to-couchdb http://127.0.0.1:${COUCH_PORT}
