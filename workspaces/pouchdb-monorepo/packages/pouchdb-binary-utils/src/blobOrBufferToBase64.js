function blobToBase64(blobOrBuffer, callback) {
  callback(blobOrBuffer.toString('base64'));
}

export default blobToBase64;