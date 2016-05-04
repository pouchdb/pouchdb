import PouchDB from 'pouchdb';
import ajax from 'pouchdb-ajax';
import utils from './utils';
import { errors } from 'pouchdb-errors';

PouchDB.ajax = ajax;
PouchDB.utils = utils;
PouchDB.Errors = errors;

export default PouchDB;