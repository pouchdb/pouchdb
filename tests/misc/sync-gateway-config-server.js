#!/usr/bin/env node

'use strict';

var http = require('http');

function createSyncGatewayConfigServer() {
  if (process.env.SERVER !== 'sync-gateway') {
    console.log("not launching SG config server");
    return;
  }
  console.log("launching SG config server for", process.env.COUCH_HOST);
  // Sync Gateway should be launched with tests/misc/sync-gateway-config.json
  // which causes it to query this port for database-level config.
  var SG_CONFIG_PORT = 8001;
  var sgDBConfig = {
      "server": "walrus:",
      "users": {
        "GUEST": {"disabled": false, "admin_channels": ["*"] }
      }
    };
  function sgConfig(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(sgDBConfig));
  }
  http.createServer(sgConfig).listen(SG_CONFIG_PORT);
}

if (require.main === module) {
  createSyncGatewayConfigServer();
} else {
  module.exports.start = createSyncGatewayConfigServer;
}
