// In Node, this is just a Buffer rather than an ArrayBuffer
function arrayBufferToBase64(buffer) {
  return buffer.toString('binary');
}

export default arrayBufferToBase64;