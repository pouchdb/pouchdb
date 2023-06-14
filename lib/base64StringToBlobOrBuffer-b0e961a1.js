function typedBuffer(binString, buffType, type) {
  // buffType is either 'binary' or 'base64'
  const buff = Buffer.from(binString, buffType);
  buff.type = type; // non-standard, but used for consistency with the browser
  return buff;
}

function b64ToBluffer(b64, type) {
  return typedBuffer(b64, 'base64', type);
}

export { b64ToBluffer as b, typedBuffer as t };
