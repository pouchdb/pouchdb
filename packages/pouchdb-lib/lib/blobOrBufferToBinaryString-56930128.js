function blobToBase64$1(blobOrBuffer, callback) {
  callback(blobOrBuffer.toString('base64'));
}

const toBase64 = (arrayBuffer) => btoa(String.fromCharCode(
  ...new Uint8Array(arrayBuffer)
));

function blobToBase64(blobOrBuffer, callback) {
  new Response(blobOrBuffer).arrayBuffer().then(toBase64).then(
    (b64)=>callback(null,b64),err=>callback(err));
  //callback(blobOrBuffer.toString('binary'));
}

export { blobToBase64$1 as a, blobToBase64 as b };
