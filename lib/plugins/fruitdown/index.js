'use strict';

var pluginBase = require('../base');
var adapterConfig = require('./config');
var downAdapter = require('fruitdown');
pluginBase(adapterConfig, downAdapter);
