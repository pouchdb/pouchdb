function createBlob(parts, properties) {
    return new Blob([].concat(parts),properties);
}

export default createBlob;
