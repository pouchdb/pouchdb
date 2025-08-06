import { BuiltInError } from 'pouchdb-mapreduce-utils';
import sum from './sum';

function getMixedTypeError() {
  return new BuiltInError(
    'builtin _stats function requires map values to be' +
    ' numbers or number arrays, not a mix of both.'
  );
}

function getMixedLengthError() {
  return new BuiltInError(
    'builtin _stats function: if the map function outputs' +
    ' arrays, they need to have consistent length.'
  );
}

function sumsqr(values) {
  let _sumsqr = 0;
  for (let i = 0, len = values.length; i < len; i++) {
    const num = values[i];
    _sumsqr += (num * num);
  }
  return _sumsqr;
}

function stats(keys, values) {

  // Handle the edge case of an empty values array.
  if (!values || values.length === 0) {
    return {
      sum: 0,
      min: null,
      max: null,
      count: 0,
      sumsqr: 0
    };
  }

  const isArrayOfArrays = Array.isArray(values[0]);

  if (isArrayOfArrays) {
    // --- PATH 1: Handle Array of Arrays ---
    // e.g., [[1, 100], [2, 200], [3, 300]]

    const firstArrayLength = values[0].length;
    const regroupedValues = [];

    // Initialize the structure for regrouped ("transposed") values.
    for (let i = 0; i < firstArrayLength; i++) {
      regroupedValues.push([]);
    }

    // Validate and regroup the values.
    for (const valueArray of values) {
      // ERROR CHECK 1: Mixed member types.
      if (!Array.isArray(valueArray)) {
        throw getMixedTypeError();
      }
      // ERROR CHECK 2: Inconsistent array lengths.
      if (valueArray.length !== firstArrayLength) {
        throw getMixedLengthError();
      }
      // Add each number to its corresponding stats group.
      for (let i = 0; i < firstArrayLength; i++) {
        regroupedValues[i].push(valueArray[i]);
      }
    }

    // Calculate stats for each regrouped array.
    return regroupedValues.map(function (statValues) {
      return {
        sum: sum(statValues),
        min: Math.min.apply(null, statValues),
        max: Math.max.apply(null, statValues),
        count: statValues.length,
        sumsqr: sumsqr(statValues)
      };
    });

  } else {
    // --- PATH 2: Handle Array of Numbers ---
    // e.g., [1, 2, 3]

    // ERROR CHECK: Ensure no arrays are mixed in.
    for (const value of values) {
      if (typeof value !== 'number') {
        throw getMixedTypeError();
      }
    }

    // Apply the original logic.
    return {
      sum: sum(values),
      min: Math.min.apply(null, values),
      max: Math.max.apply(null, values),
      count: values.length,
      sumsqr: sumsqr(values)
    };
  }
}

export default stats;
