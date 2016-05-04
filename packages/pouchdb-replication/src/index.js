import { replicate } from './replicateWrapper';
import sync from './sync';

function replication(PouchDB) {
  PouchDB.replicate = replicate;
  PouchDB.sync = sync;
}

export default replication;