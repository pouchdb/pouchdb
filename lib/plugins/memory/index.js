'use strict';

var pluginBase = require('../base');
var adapterConfig = require('./config');
var downAdapter = require('memdown');
pluginBase(adapterConfig, downAdapter);