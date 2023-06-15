function typedBuffer(binString, buffType, type) {
  // buffType is either 'binary' or 'base64'
  const buff = Buffer.from(binString, buffType);
  buff.type = type; // non-standard, but used for consistency with the browser
  return buff;
}

function b64ToBluffer(b64, type) {
  return typedBuffer(b64, 'base64', type);
}

// From http://stackoverflow.com/questions/14967647/ (continues on next line)
// encode-decode-image-with-base64-breaks-image (2013-04-21)
function binaryStringToArrayBuffer(bin) {
  var length = bin.length;
  var buf = new ArrayBuffer(length);
  var arr = new Uint8Array(buf);
  for (var i = 0; i < length; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return buf;
}

function binStringToBluffer(binString, type) {
  return typedBuffer(binString, 'binary', type);
}

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

// simplified API. universal browser support is assumed
function readAsArrayBuffer(blob, callback) {
  var reader = new FileReader();
  reader.onloadend = function (e) {
    var result = e.target.result || new ArrayBuffer(0);
    callback(result);
  };
  reader.readAsArrayBuffer(blob);
}

//Can't find original post, but this is close
//http://stackoverflow.com/questions/6965107/ (continues on next line)
//converting-between-strings-and-arraybuffers
function arrayBufferToBinaryString(buffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var length = bytes.byteLength;
  for (var i = 0; i < length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

// shim for browsers that don't support it
function readAsBinaryString(blob, callback) {
  var reader = new FileReader();
  var hasBinaryString = typeof reader.readAsBinaryString === 'function';
  reader.onloadend = function (e) {
    var result = e.target.result || '';
    if (hasBinaryString) {
      return callback(result);
    }
    callback(arrayBufferToBinaryString(result));
  };
  if (hasBinaryString) {
    reader.readAsBinaryString(blob);
  } else {
    reader.readAsArrayBuffer(blob);
  }
}

export { b64ToBluffer as base64StringToBlobOrBuffer, binaryStringToArrayBuffer, binStringToBluffer as binaryStringToBlobOrBuffer, blobToBase64$1 as blobOrBufferToBase64, blobToBase64 as blobOrBufferToBinaryString, readAsArrayBuffer, readAsBinaryString, typedBuffer };
