import nut from './nut';
import shell from './shell';
import Codec from 'level-codec';
import ReadStream from './readStream';
import precodec from './legacyCodec';

var codec = new Codec();

function sublevelPouch(db) {
  return shell(nut(db, precodec, codec), [], ReadStream, db.options);
}

export default sublevelPouch;
