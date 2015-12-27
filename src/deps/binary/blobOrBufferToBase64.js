import Promise from '../promise';

function blobToBase64(blobOrBuffer) {
  return Promise.resolve(blobOrBuffer.toString('base64'));
}

export default blobToBase64;