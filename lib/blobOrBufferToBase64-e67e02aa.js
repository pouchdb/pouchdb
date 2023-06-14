function blobToBase64(blobOrBuffer, callback) {
  callback(blobOrBuffer.toString('base64'));
}

export { blobToBase64 as b };
