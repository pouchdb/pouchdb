'use strict';

var pluginBase = require('../base');
var adapterConfig = require('./config');
var downAdapter = require('localstorage-down');
pluginBase(adapterConfig, downAdapter);