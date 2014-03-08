#!/usr/bin/env node

var repl = require("repl");

repl.start("> ").context.PouchDB = require("../");
