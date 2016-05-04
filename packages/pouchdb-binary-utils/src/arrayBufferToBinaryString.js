// In Node, this is just a Buffer rather than an ArrayBuffer
function arrayBufferToBinaryString(buffer) {
  return buffer.toString('binary');
}

export default arrayBufferToBinaryString;