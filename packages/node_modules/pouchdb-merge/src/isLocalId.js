function isLocalId(id) {
  return typeof id === 'string' && id.startsWith('_local/');
}

export default isLocalId;
