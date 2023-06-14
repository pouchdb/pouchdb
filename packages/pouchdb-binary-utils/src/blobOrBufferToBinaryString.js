// not used in Node, but here for completeness
function bufferToBinaryString(arrayBuffer) {
  return String.fromCharCode(...new Uint8Array(arrayBuffer));
}

const toBase64 = (arrayBuffer) => btoa(bufferToBinaryString(arrayBuffer));

function blobToBase64(blobOrBuffer, callback) {
  new Response(blobOrBuffer).arrayBuffer().then(toBase64).then((b64)=>callback(null,b64),err=>callback(err));
  callback(blobOrBuffer.toString('binary'));
}

export default blobToBase64;