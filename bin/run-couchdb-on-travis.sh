#!/usr/bin/env bash

if [ "$SERVER" = "couchdb-master" ]; then
  # Install CouchDB Master
  docker run -d -p 3001:5984 klaemo/couchdb:2.0-dev@sha256:336fd3d9a89475205fc79b6a287ee550d258fac3b62c67b8d13b8e66c71d228f --with-haproxy \
    --with-admin-party-please -n 1
  COUCH_PORT=3001
else
  # Install CouchDB Stable
  mkdir -p $HOME/docker
  export DOCKER_CACHE_FILE=$HOME/docker/couchdb-1.6.1.tgz
  if [ -f "$DOCKER_CACHE_FILE" ]; then
    echo "Using cached Docker image for CouchDB 1.6.1..."
    gunzip -c "$DOCKER_CACHE_FILE" | docker import - couchdb-1.6.1
    docker run --name couchdb-1.6.1 -d -p 3000:5984
  else
    echo "Using uncached Docker image for CouchDB 1.6.1..."
    # Cache CouchDB 1.6.1 Docker image on Travis; it won't ever change
    # See https://giorgos.sealabs.net/docker-cache-on-travis-and-docker-112.html
    docker run --name couchdb-1.6.1 -d -p 3000:5984 klaemo/couchdb:1.6.1
    docker export couchdb-1.6.1 | gzip > "$DOCKER_CACHE_FILE"
  fi
  COUCH_PORT=3000
fi

# wait for couchdb to start, add cors
npm install add-cors-to-couchdb
while [ '200' != $(curl -s -o /dev/null -w %{http_code} http://127.0.0.1:${COUCH_PORT}) ]; do
  echo waiting for couch to load... ;
  sleep 1;
done
./node_modules/.bin/add-cors-to-couchdb http://127.0.0.1:${COUCH_PORT}
