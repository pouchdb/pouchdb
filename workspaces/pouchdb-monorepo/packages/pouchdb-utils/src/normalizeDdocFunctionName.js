import parseDdocFunctionName from './parseDdocFunctionName';

function normalizeDesignDocFunctionName(s) {
  var normalized = parseDdocFunctionName(s);
  return normalized ? normalized.join('/') : null;
}

export default normalizeDesignDocFunctionName;