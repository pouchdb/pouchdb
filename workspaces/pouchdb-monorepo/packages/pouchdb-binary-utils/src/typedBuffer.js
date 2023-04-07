import bufferFrom from 'buffer-from'; // ponyfill for Node <6

function typedBuffer(binString, buffType, type) {
  // buffType is either 'binary' or 'base64'
  var buff = bufferFrom(binString, buffType);
  buff.type = type; // non-standard, but used for consistency with the browser
  return buff;
}

export default typedBuffer;