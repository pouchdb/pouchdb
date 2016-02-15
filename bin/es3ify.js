#!/usr/bin/env node
'use strict';
var es3ify = require('es3ify');
process.stdin.pipe(es3ify()).pipe(process.stdout);
