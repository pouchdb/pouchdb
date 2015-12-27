import pluginBase from '../base';
import adapterConfig from './config';
import downAdapter from 'localstorage-down';

pluginBase(adapterConfig, downAdapter);