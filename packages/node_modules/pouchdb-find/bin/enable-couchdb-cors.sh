#!/bin/bash

curl -X PUT http://127.0.0.1:15984/_node/node1@127.0.0.1/_config/httpd/enable_cors -d '"true"'
curl -X PUT http://127.0.0.1:15984/_node/node1@127.0.0.1/_config/cors/origins -d '"*"'
curl -X PUT http://127.0.0.1:15984/_node/node1@127.0.0.1/_config/cors/credentials -d '"true"'
curl -X PUT http://127.0.0.1:15984/_node/node1@127.0.0.1/_config/cors/methods -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT http://127.0.0.1:15984/_node/node1@127.0.0.1/_config/cors/headers -d '"accept, authorization, content-type, origin, referer, x-csrf-token"'
