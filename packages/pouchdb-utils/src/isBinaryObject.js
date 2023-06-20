function isBinaryObject(object) {
  return object instanceof Buffer;
}

export default isBinaryObject;