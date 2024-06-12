/**
 * @template {ArrayBuffer | Blob} T
 * @param {T} object
 * @returns {T}
 */
function cloneBinaryObject(object) {
  return object instanceof ArrayBuffer
    ? object.slice(0)
    : object.slice(0, object.size, object.type);
}

export default cloneBinaryObject;
