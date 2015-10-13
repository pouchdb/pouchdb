function isLocalId(id) {
  return (/^_local/).test(id);
}

export default isLocalId;