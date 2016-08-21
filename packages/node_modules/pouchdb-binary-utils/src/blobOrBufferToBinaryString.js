// not used in Node, but here for completeness
function blobToBase64(blobOrBuffer, callback) {
  callback(blobOrBuffer.toString('binary'));
}

export default blobToBase64;