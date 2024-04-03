function isNonNullObject(value) {
  return typeof value === 'object' && value !== null;
}

// throws if the user is using the wrong query field value type
function checkFieldValueType(name, value, isHttp) {
  let message = '';
  let received = value;
  let addReceived = true;
  if (['$in', '$nin', '$or', '$and', '$mod', '$nor', '$all'].indexOf(name) !== -1) {
    if (!Array.isArray(value)) {
      message = 'Query operator ' + name + ' must be an array.';

    }
  }

  if (['$not', '$elemMatch', '$allMatch'].indexOf(name) !== -1) {
    if (!(!Array.isArray(value) && isNonNullObject(value))) {
      message = 'Query operator ' + name + ' must be an object.';
    }
  }

  if (name === '$mod' && Array.isArray(value)) {
    if (value.length !== 2) {
      message = 'Query operator $mod must be in the format [divisor, remainder], ' +
        'where divisor and remainder are both integers.';
    } else {
      const divisor = value[0];
      const mod = value[1];
      if (divisor === 0) {
        message = 'Query operator $mod\'s divisor cannot be 0, cannot divide by zero.';
        addReceived = false;
      }
      if (typeof divisor !== 'number' || parseInt(divisor, 10) !== divisor) {
        message = 'Query operator $mod\'s divisor is not an integer.';
        received = divisor;
      }
      if (parseInt(mod, 10) !== mod) {
        message = 'Query operator $mod\'s remainder is not an integer.';
        received = mod;
      }
    }
  }
  if (name === '$exists') {
    if (typeof value !== 'boolean') {
      message = 'Query operator $exists must be a boolean.';
    }
  }

  if (name === '$type') {
    const allowed = ['null', 'boolean', 'number', 'string', 'array', 'object'];
    const allowedStr = '"' + allowed.slice(0, allowed.length - 1).join('", "') + '", or "' + allowed[allowed.length - 1] + '"';
    if (typeof value !== 'string') {
      message = 'Query operator $type must be a string. Supported values: ' + allowedStr + '.';
    } else if (allowed.indexOf(value) == -1) {
      message = 'Query operator $type must be a string. Supported values: ' + allowedStr + '.';
    }
  }

  if (name === '$size') {
    if (parseInt(value, 10) !== value) {
      message = 'Query operator $size must be a integer.';
    }
  }

  if (name === '$regex') {
    if (typeof value !== 'string') {
      if (isHttp) {
        message = 'Query operator $regex must be a string.';
      } else if (!(value instanceof RegExp)) {
        message = 'Query operator $regex must be a string or an instance ' +
          'of a javascript regular expression.';
      }
    }
  }

  if (message) {
    if (addReceived) {
      const type = received === null
        ? ' '
        : Array.isArray(received)
          ? ' array'
          : ' ' + typeof received;
      const receivedStr = isNonNullObject(received)
        ? JSON.stringify(received, null, '\t')
        : received;

      message += ' Received' + type + ': ' + receivedStr;
    }
    throw new Error(message);
  }
}

const requireValidation = ['$all', '$allMatch', '$and', '$elemMatch', '$exists', '$in', '$mod', '$nin', '$nor', '$not', '$or', '$regex', '$size', '$type'];
const arrayTypeComparisonOperators = ['$in', '$nin', '$mod', '$all'];
const equalityOperators = ['$eq', '$gt', '$gte', '$lt', '$lte'];

// recursively walks down the a query selector validating any operators
export default function validateSelector(input, isHttp) {
  if (Array.isArray(input)) {
    for (const entry of input) {
      if (isNonNullObject(entry)) {
        validateSelector(entry, isHttp);
      }
    }
  }
  else {
    for (const [key, value] of Object.entries(input)) {
      if (requireValidation.indexOf(key) !== -1) {
        checkFieldValueType(key, value, isHttp);
      }
      if (equalityOperators.indexOf(key) !== -1) {
        // skip, explicit comparison operators can be anything
        continue;
      }
      if (arrayTypeComparisonOperators.indexOf(key) !== -1) {
        // skip, their values are already valid
        continue;
      }
      if (isNonNullObject(value)) {
        validateSelector(value, isHttp);
      }
    }
  }
}
