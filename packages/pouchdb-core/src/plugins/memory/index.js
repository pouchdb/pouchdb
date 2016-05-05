import pluginBase from '../base';
import adapterConfig from './config';
import downAdapter from 'memdown';

pluginBase(adapterConfig, downAdapter);