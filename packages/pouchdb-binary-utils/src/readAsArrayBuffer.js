// In Node.js, just convert the Buffer to a Buffer rather than
// convert a Blob to an ArrayBuffer. This function is just a convenience
// function so we can easily switch Node vs browser environments.
function readAsArrayBuffer(buffer, callback) {
  callback(buffer);
}

export default readAsArrayBuffer;