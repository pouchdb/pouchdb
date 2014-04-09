#!/bin/bash

: ${CLIENT:="node"}

if [ "$CLIENT" == "node" ]; then
    npm run test-node
elif [ -n "$LEVEL_BACKEND" ]; then
    npm run test-browser-alt
else
    npm run test-browser
fi
