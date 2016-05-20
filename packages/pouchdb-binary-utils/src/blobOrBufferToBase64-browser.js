import readAsBinaryString from './readAsBinaryString';
import { btoa } from './base64';

function blobToBase64(blobOrBuffer, callback) {
  readAsBinaryString(blobOrBuffer, function (bin) {
    callback(btoa(bin));
  });
}

export default blobToBase64;