import readAsBinaryString from './readAsBinaryString';

function blobToBinaryString(blobOrBuffer, callback) {
  readAsBinaryString(blobOrBuffer, function (bin) {
    callback(bin);
  });
}

export default blobToBinaryString;