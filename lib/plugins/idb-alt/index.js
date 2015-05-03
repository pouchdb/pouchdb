'use strict';

var pluginBase = require('../base');
var adapterConfig = require('./config');
var downAdapter = require('level-js');
pluginBase(adapterConfig, downAdapter);