import arrayBufferToBinaryString from './arrayBufferToBinaryString';
import { btoa } from './base64';

function arrayBufferToBase64(buffer) {
  return btoa(arrayBufferToBinaryString(buffer));
}

export default arrayBufferToBase64;