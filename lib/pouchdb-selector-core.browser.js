import { c as clone } from './clone-f35bcc51.js';
import 'node:events';
import './functionName-4d6db487.js';
import './pouchdb-errors.browser.js';
import './spark-md5-2c57e5fc.js';
import { c as collate } from './index-3a476dad.js';
import './_commonjsHelpers-24198af3.js';
import './__node-resolve_empty-b1d43ca8.js';

// this would just be "return doc[field]", but fields
// can be "deep" due to dot notation
function getFieldFromDoc(doc, parsedField) {
  var value = doc;
  for (var i = 0, len = parsedField.length; i < len; i++) {
    var key = parsedField[i];
    value = value[key];
    if (!value) {
      break;
    }
  }
  return value;
}

function setFieldInDoc(doc, parsedField, value) {
  for (var i = 0, len = parsedField.length; i < len-1; i++) {
    var elem = parsedField[i];
    doc = doc[elem] = doc[elem] || {};
  }
  doc[parsedField[len-1]] = value;
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

// Converts a string in dot notation to an array of its components, with backslash escaping
function parseField(fieldName) {
  // fields may be deep (e.g. "foo.bar.baz"), so parse
  var fields = [];
  var current = '';
  for (var i = 0, len = fieldName.length; i < len; i++) {
    var ch = fieldName[i];
    if (i > 0 && fieldName[i - 1] === '\\' && (ch === '$' || ch === '.')) {
      // escaped delimiter
      current = current.substring(0, current.length - 1) + ch;
    } else if (ch === '.') {
      // When `.` is not escaped (above), it is a field delimiter
      fields.push(current);
      current = '';
    } else { // normal character
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

var combinationFields = ['$or', '$nor', '$not'];
function isCombinationalField(field) {
  return combinationFields.indexOf(field) > -1;
}

function getKey(obj) {
  return Object.keys(obj)[0];
}

function getValue(obj) {
  return obj[getKey(obj)];
}


// flatten an array of selectors joined by an $and operator
function mergeAndedSelectors(selectors) {

  // sort to ensure that e.g. if the user specified
  // $and: [{$gt: 'a'}, {$gt: 'b'}], then it's collapsed into
  // just {$gt: 'b'}
  var res = {};
  var first = {$or: true, $nor: true};

  selectors.forEach(function (selector) {
    Object.keys(selector).forEach(function (field) {
      var matcher = selector[field];
      if (typeof matcher !== 'object') {
        matcher = {$eq: matcher};
      }

      if (isCombinationalField(field)) {
        // or, nor
        if (matcher instanceof Array) {
          if (first[field]) {
            first[field] = false;
            res[field] = matcher;
            return;
          }

          var entries = [];
          res[field].forEach(function (existing) {
            Object.keys(matcher).forEach(function (key) {
              var m = matcher[key];
              var longest = Math.max(Object.keys(existing).length, Object.keys(m).length);
              var merged = mergeAndedSelectors([existing, m]);
              if (Object.keys(merged).length <= longest) {
                // we have a situation like: (a :{$eq :1} || ...) && (a {$eq: 2} || ...)
                // merging would produce a $eq 2 when actually we shouldn't ever match against these merged conditions
                // merged should always contain more values to be valid
                return;
              }
              entries.push(merged);
            });
          });
          res[field] = entries;
        } else {
          // not
          res[field] = mergeAndedSelectors([matcher]);
        }
      } else {
        var fieldMatchers = res[field] = res[field] || {};
        Object.keys(matcher).forEach(function (operator) {
          var value = matcher[operator];

          if (operator === '$gt' || operator === '$gte') {
            return mergeGtGte(operator, value, fieldMatchers);
          } else if (operator === '$lt' || operator === '$lte') {
            return mergeLtLte(operator, value, fieldMatchers);
          } else if (operator === '$ne') {
            return mergeNe(value, fieldMatchers);
          } else if (operator === '$eq') {
            return mergeEq(value, fieldMatchers);
          } else if (operator === "$regex") {
            return mergeRegex(value, fieldMatchers);
          }
          fieldMatchers[operator] = value;
        });
      }
    });
  });

  return res;
}



// collapse logically equivalent gt/gte values
function mergeGtGte(operator, value, fieldMatchers) {
  if (typeof fieldMatchers.$eq !== 'undefined') {
    return; // do nothing
  }
  if (typeof fieldMatchers.$gte !== 'undefined') {
    if (operator === '$gte') {
      if (value > fieldMatchers.$gte) { // more specificity
        fieldMatchers.$gte = value;
      }
    } else { // operator === '$gt'
      if (value >= fieldMatchers.$gte) { // more specificity
        delete fieldMatchers.$gte;
        fieldMatchers.$gt = value;
      }
    }
  } else if (typeof fieldMatchers.$gt !== 'undefined') {
    if (operator === '$gte') {
      if (value > fieldMatchers.$gt) { // more specificity
        delete fieldMatchers.$gt;
        fieldMatchers.$gte = value;
      }
    } else { // operator === '$gt'
      if (value > fieldMatchers.$gt) { // more specificity
        fieldMatchers.$gt = value;
      }
    }
  } else {
    fieldMatchers[operator] = value;
  }
}

// collapse logically equivalent lt/lte values
function mergeLtLte(operator, value, fieldMatchers) {
  if (typeof fieldMatchers.$eq !== 'undefined') {
    return; // do nothing
  }
  if (typeof fieldMatchers.$lte !== 'undefined') {
    if (operator === '$lte') {
      if (value < fieldMatchers.$lte) { // more specificity
        fieldMatchers.$lte = value;
      }
    } else { // operator === '$gt'
      if (value <= fieldMatchers.$lte) { // more specificity
        delete fieldMatchers.$lte;
        fieldMatchers.$lt = value;
      }
    }
  } else if (typeof fieldMatchers.$lt !== 'undefined') {
    if (operator === '$lte') {
      if (value < fieldMatchers.$lt) { // more specificity
        delete fieldMatchers.$lt;
        fieldMatchers.$lte = value;
      }
    } else { // operator === '$gt'
      if (value < fieldMatchers.$lt) { // more specificity
        fieldMatchers.$lt = value;
      }
    }
  } else {
    fieldMatchers[operator] = value;
  }
}

// combine $ne values into one array
function mergeNe(value, fieldMatchers) {
  if ('$ne' in fieldMatchers) {
    // there are many things this could "not" be
    fieldMatchers.$ne.push(value);
  } else { // doesn't exist yet
    fieldMatchers.$ne = [value];
  }
}

// add $eq into the mix
function mergeEq(value, fieldMatchers) {
  // these all have less specificity than the $eq
  // TODO: check for user errors here
  delete fieldMatchers.$gt;
  delete fieldMatchers.$gte;
  delete fieldMatchers.$lt;
  delete fieldMatchers.$lte;
  delete fieldMatchers.$ne;
  fieldMatchers.$eq = value;
}

// combine $regex values into one array
function mergeRegex(value, fieldMatchers) {
  if ('$regex' in fieldMatchers) {
    // a value could match multiple regexes
    fieldMatchers.$regex.push(value);
  } else { // doesn't exist yet
    fieldMatchers.$regex = [value];
  }
}

//#7458: execute function mergeAndedSelectors on nested $and
function mergeAndedSelectorsNested(obj) {
    for (var prop in obj) {
        if (Array.isArray(obj)) {
            for (var i in obj) {
                if (obj[i]['$and']) {
                    obj[i] = mergeAndedSelectors(obj[i]['$and']);
                }
            }
        }
        var value = obj[prop];
        if (typeof value === 'object') {
            mergeAndedSelectorsNested(value); // <- recursive call
        }
    }
    return obj;
}

//#7458: determine id $and is present in selector (at any level)
function isAndInSelector(obj, isAnd) {
    for (var prop in obj) {
        if (prop === '$and') {
            isAnd = true;
        }
        var value = obj[prop];
        if (typeof value === 'object') {
            isAnd = isAndInSelector(value, isAnd); // <- recursive call
        }
    }
    return isAnd;
}

//
// normalize the selector
//
function massageSelector(input) {
  var result = clone(input);

  //#7458: if $and is present in selector (at any level) merge nested $and
  if (isAndInSelector(result, false)) {
    result = mergeAndedSelectorsNested(result);
    if ('$and' in result) {
      result = mergeAndedSelectors(result['$and']);
    }
  }

  ['$or', '$nor'].forEach(function (orOrNor) {
    if (orOrNor in result) {
      // message each individual selector
      // e.g. {foo: 'bar'} becomes {foo: {$eq: 'bar'}}
      result[orOrNor].forEach(function (subSelector) {
        var fields = Object.keys(subSelector);
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          var matcher = subSelector[field];
          if (typeof matcher !== 'object' || matcher === null) {
            subSelector[field] = {$eq: matcher};
          }
        }
      });
    }
  });

  if ('$not' in result) {
    //This feels a little like forcing, but it will work for now,
    //I would like to come back to this and make the merging of selectors a little more generic
    result['$not'] = mergeAndedSelectors([result['$not']]);
  }

  var fields = Object.keys(result);

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var matcher = result[field];

    if (typeof matcher !== 'object' || matcher === null) {
      matcher = {$eq: matcher};
    }
    result[field] = matcher;
  }

  normalizeArrayOperators(result);

  return result;
}

//
// The $ne and $regex values must be placed in an array because these operators can be used multiple times on the same field.
// When $and is used, mergeAndedSelectors takes care of putting some of them into arrays, otherwise it's done here.
//
function normalizeArrayOperators(selector) {
  Object.keys(selector).forEach(function (field) {
    var matcher = selector[field];

    if (Array.isArray(matcher)) {
      matcher.forEach(function (matcherItem) {
        if (matcherItem && typeof matcherItem === 'object') {
          normalizeArrayOperators(matcherItem);
        }
      });
    } else if (field === '$ne') {
      selector.$ne = [matcher];
    } else if (field === '$regex') {
      selector.$regex = [matcher];
    } else if (matcher && typeof matcher === 'object') {
      normalizeArrayOperators(matcher);
    }
  });
}

// create a comparator based on the sort object
function createFieldSorter(sort) {

  function getFieldValuesAsArray(doc) {
    return sort.map(function (sorting) {
      var fieldName = getKey(sorting);
      var parsedField = parseField(fieldName);
      var docFieldValue = getFieldFromDoc(doc, parsedField);
      return docFieldValue;
    });
  }

  return function (aRow, bRow) {
    var aFieldValues = getFieldValuesAsArray(aRow.doc);
    var bFieldValues = getFieldValuesAsArray(bRow.doc);
    var collation = collate(aFieldValues, bFieldValues);
    if (collation !== 0) {
      return collation;
    }
    // this is what mango seems to do
    return compare(aRow.doc._id, bRow.doc._id);
  };
}

function filterInMemoryFields(rows, requestDef, inMemoryFields) {
  rows = rows.filter(function (row) {
    return rowFilter(row.doc, requestDef.selector, inMemoryFields);
  });

  if (requestDef.sort) {
    // in-memory sort
    var fieldSorter = createFieldSorter(requestDef.sort);
    rows = rows.sort(fieldSorter);
    if (typeof requestDef.sort[0] !== 'string' &&
        getValue(requestDef.sort[0]) === 'desc') {
      rows = rows.reverse();
    }
  }

  if ('limit' in requestDef || 'skip' in requestDef) {
    // have to do the limit in-memory
    var skip = requestDef.skip || 0;
    var limit = ('limit' in requestDef ? requestDef.limit : rows.length) + skip;
    rows = rows.slice(skip, limit);
  }
  return rows;
}

function rowFilter(doc, selector, inMemoryFields) {
  return inMemoryFields.every(function (field) {
    var matcher = selector[field];
    var parsedField = parseField(field);
    var docFieldValue = getFieldFromDoc(doc, parsedField);
    if (isCombinationalField(field)) {
      return matchCominationalSelector(field, matcher, doc);
    }

    return matchSelector(matcher, doc, parsedField, docFieldValue);
  });
}

function matchSelector(matcher, doc, parsedField, docFieldValue) {
  if (!matcher) {
    // no filtering necessary; this field is just needed for sorting
    return true;
  }

  // is matcher an object, if so continue recursion
  if (typeof matcher === 'object') {
    return Object.keys(matcher).every(function (maybeUserOperator) {
      var userValue = matcher[ maybeUserOperator ];
      // explicit operator
      if (maybeUserOperator.indexOf("$") === 0) {
        return match(maybeUserOperator, doc, userValue, parsedField, docFieldValue);
      } else {
        var subParsedField = parseField(maybeUserOperator);

        if (
          docFieldValue === undefined &&
          typeof userValue !== "object" &&
          subParsedField.length > 0
        ) {
          // the field does not exist, return or getFieldFromDoc will throw
          return false;
        }

        var subDocFieldValue = getFieldFromDoc(docFieldValue, subParsedField);

        if (typeof userValue === "object") {
          // field value is an object that might contain more operators
          return matchSelector(userValue, doc, parsedField, subDocFieldValue);
        }

        // implicit operator
        return match("$eq", doc, userValue, subParsedField, subDocFieldValue);
      }
    });
  }

  // no more depth, No need to recurse further
  return matcher === docFieldValue;
}

function matchCominationalSelector(field, matcher, doc) {

  if (field === '$or') {
    return matcher.some(function (orMatchers) {
      return rowFilter(doc, orMatchers, Object.keys(orMatchers));
    });
  }

  if (field === '$not') {
    return !rowFilter(doc, matcher, Object.keys(matcher));
  }

  //`$nor`
  return !matcher.find(function (orMatchers) {
    return rowFilter(doc, orMatchers, Object.keys(orMatchers));
  });

}

function match(userOperator, doc, userValue, parsedField, docFieldValue) {
  if (!matchers[userOperator]) {
    /* istanbul ignore next */
    throw new Error('unknown operator "' + userOperator +
      '" - should be one of $eq, $lte, $lt, $gt, $gte, $exists, $ne, $in, ' +
      '$nin, $size, $mod, $regex, $elemMatch, $type, $allMatch or $all');
  }
  return matchers[userOperator](doc, userValue, parsedField, docFieldValue);
}

function fieldExists(docFieldValue) {
  return typeof docFieldValue !== 'undefined' && docFieldValue !== null;
}

function fieldIsNotUndefined(docFieldValue) {
  return typeof docFieldValue !== 'undefined';
}

function modField(docFieldValue, userValue) {
  if (typeof docFieldValue !== "number" ||
    parseInt(docFieldValue, 10) !== docFieldValue) {
    return false;
  }

  var divisor = userValue[0];
  var mod = userValue[1];

  return docFieldValue % divisor === mod;
}

function arrayContainsValue(docFieldValue, userValue) {
  return userValue.some(function (val) {
    if (docFieldValue instanceof Array) {
      return docFieldValue.some(function (docFieldValueItem) {
        return collate(val, docFieldValueItem) === 0;
      });
    }

    return collate(val, docFieldValue) === 0;
  });
}

function arrayContainsAllValues(docFieldValue, userValue) {
  return userValue.every(function (val) {
    return docFieldValue.some(function (docFieldValueItem) {
      return collate(val, docFieldValueItem) === 0;
    });
  });
}

function arraySize(docFieldValue, userValue) {
  return docFieldValue.length === userValue;
}

function regexMatch(docFieldValue, userValue) {
  var re = new RegExp(userValue);

  return re.test(docFieldValue);
}

function typeMatch(docFieldValue, userValue) {

  switch (userValue) {
    case 'null':
      return docFieldValue === null;
    case 'boolean':
      return typeof (docFieldValue) === 'boolean';
    case 'number':
      return typeof (docFieldValue) === 'number';
    case 'string':
      return typeof (docFieldValue) === 'string';
    case 'array':
      return docFieldValue instanceof Array;
    case 'object':
      return ({}).toString.call(docFieldValue) === '[object Object]';
  }
}

var matchers = {

  '$elemMatch': function (doc, userValue, parsedField, docFieldValue) {
    if (!Array.isArray(docFieldValue)) {
      return false;
    }

    if (docFieldValue.length === 0) {
      return false;
    }

    if (typeof docFieldValue[0] === 'object' &&  docFieldValue[0] !== null) {
      return docFieldValue.some(function (val) {
        return rowFilter(val, userValue, Object.keys(userValue));
      });
    }

    return docFieldValue.some(function (val) {
      return matchSelector(userValue, doc, parsedField, val);
    });
  },

  '$allMatch': function (doc, userValue, parsedField, docFieldValue) {
    if (!Array.isArray(docFieldValue)) {
      return false;
    }

    /* istanbul ignore next */
    if (docFieldValue.length === 0) {
      return false;
    }

    if (typeof docFieldValue[0] === 'object' &&  docFieldValue[0] !== null) {
      return docFieldValue.every(function (val) {
        return rowFilter(val, userValue, Object.keys(userValue));
      });
    }

    return docFieldValue.every(function (val) {
      return matchSelector(userValue, doc, parsedField, val);
    });
  },

  '$eq': function (doc, userValue, parsedField, docFieldValue) {
    return fieldIsNotUndefined(docFieldValue) && collate(docFieldValue, userValue) === 0;
  },

  '$gte': function (doc, userValue, parsedField, docFieldValue) {
    return fieldIsNotUndefined(docFieldValue) && collate(docFieldValue, userValue) >= 0;
  },

  '$gt': function (doc, userValue, parsedField, docFieldValue) {
    return fieldIsNotUndefined(docFieldValue) && collate(docFieldValue, userValue) > 0;
  },

  '$lte': function (doc, userValue, parsedField, docFieldValue) {
    return fieldIsNotUndefined(docFieldValue) && collate(docFieldValue, userValue) <= 0;
  },

  '$lt': function (doc, userValue, parsedField, docFieldValue) {
    return fieldIsNotUndefined(docFieldValue) && collate(docFieldValue, userValue) < 0;
  },

  '$exists': function (doc, userValue, parsedField, docFieldValue) {
    //a field that is null is still considered to exist
    if (userValue) {
      return fieldIsNotUndefined(docFieldValue);
    }

    return !fieldIsNotUndefined(docFieldValue);
  },

  '$mod': function (doc, userValue, parsedField, docFieldValue) {
    return fieldExists(docFieldValue) && modField(docFieldValue, userValue);
  },

  '$ne': function (doc, userValue, parsedField, docFieldValue) {
    return userValue.every(function (neValue) {
      return collate(docFieldValue, neValue) !== 0;
    });
  },
  '$in': function (doc, userValue, parsedField, docFieldValue) {
    return fieldExists(docFieldValue) && arrayContainsValue(docFieldValue, userValue);
  },

  '$nin': function (doc, userValue, parsedField, docFieldValue) {
    return fieldExists(docFieldValue) && !arrayContainsValue(docFieldValue, userValue);
  },

  '$size': function (doc, userValue, parsedField, docFieldValue) {
    return fieldExists(docFieldValue) &&
      Array.isArray(docFieldValue) &&
      arraySize(docFieldValue, userValue);
  },

  '$all': function (doc, userValue, parsedField, docFieldValue) {
    return Array.isArray(docFieldValue) && arrayContainsAllValues(docFieldValue, userValue);
  },

  '$regex': function (doc, userValue, parsedField, docFieldValue) {
    return fieldExists(docFieldValue) &&
      typeof docFieldValue == "string" &&
      userValue.every(function (regexValue) {
        return regexMatch(docFieldValue, regexValue);
      });
  },

  '$type': function (doc, userValue, parsedField, docFieldValue) {
    return typeMatch(docFieldValue, userValue);
  }
};

// return true if the given doc matches the supplied selector
function matchesSelector(doc, selector) {
  /* istanbul ignore if */
  if (typeof selector !== 'object') {
    // match the CouchDB error message
    throw new Error('Selector error: expected a JSON object');
  }

  selector = massageSelector(selector);
  var row = {
    'doc': doc
  };

  var rowsMatched = filterInMemoryFields([row], { 'selector': selector }, Object.keys(selector));
  return rowsMatched && rowsMatched.length === 1;
}

export { compare, createFieldSorter, filterInMemoryFields, getFieldFromDoc, getKey, getValue, isCombinationalField, massageSelector, matchesSelector, parseField, rowFilter, setFieldInDoc };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG91Y2hkYi1zZWxlY3Rvci1jb3JlLmJyb3dzZXIuanMiLCJzb3VyY2VzIjpbIi4uL3BhY2thZ2VzL3BvdWNoZGItc2VsZWN0b3ItY29yZS9zcmMvdXRpbHMuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLXNlbGVjdG9yLWNvcmUvc3JjL2luLW1lbW9yeS1maWx0ZXIuanMiLCIuLi9wYWNrYWdlcy9wb3VjaGRiLXNlbGVjdG9yLWNvcmUvc3JjL21hdGNoZXMtc2VsZWN0b3IuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY2xvbmUgfSBmcm9tICdwb3VjaGRiLXV0aWxzJztcblxuLy8gdGhpcyB3b3VsZCBqdXN0IGJlIFwicmV0dXJuIGRvY1tmaWVsZF1cIiwgYnV0IGZpZWxkc1xuLy8gY2FuIGJlIFwiZGVlcFwiIGR1ZSB0byBkb3Qgbm90YXRpb25cbmZ1bmN0aW9uIGdldEZpZWxkRnJvbURvYyhkb2MsIHBhcnNlZEZpZWxkKSB7XG4gIHZhciB2YWx1ZSA9IGRvYztcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHBhcnNlZEZpZWxkLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgdmFyIGtleSA9IHBhcnNlZEZpZWxkW2ldO1xuICAgIHZhbHVlID0gdmFsdWVba2V5XTtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiBzZXRGaWVsZEluRG9jKGRvYywgcGFyc2VkRmllbGQsIHZhbHVlKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBwYXJzZWRGaWVsZC5sZW5ndGg7IGkgPCBsZW4tMTsgaSsrKSB7XG4gICAgdmFyIGVsZW0gPSBwYXJzZWRGaWVsZFtpXTtcbiAgICBkb2MgPSBkb2NbZWxlbV0gPSBkb2NbZWxlbV0gfHwge307XG4gIH1cbiAgZG9jW3BhcnNlZEZpZWxkW2xlbi0xXV0gPSB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gY29tcGFyZShsZWZ0LCByaWdodCkge1xuICByZXR1cm4gbGVmdCA8IHJpZ2h0ID8gLTEgOiBsZWZ0ID4gcmlnaHQgPyAxIDogMDtcbn1cblxuLy8gQ29udmVydHMgYSBzdHJpbmcgaW4gZG90IG5vdGF0aW9uIHRvIGFuIGFycmF5IG9mIGl0cyBjb21wb25lbnRzLCB3aXRoIGJhY2tzbGFzaCBlc2NhcGluZ1xuZnVuY3Rpb24gcGFyc2VGaWVsZChmaWVsZE5hbWUpIHtcbiAgLy8gZmllbGRzIG1heSBiZSBkZWVwIChlLmcuIFwiZm9vLmJhci5iYXpcIiksIHNvIHBhcnNlXG4gIHZhciBmaWVsZHMgPSBbXTtcbiAgdmFyIGN1cnJlbnQgPSAnJztcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGZpZWxkTmFtZS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHZhciBjaCA9IGZpZWxkTmFtZVtpXTtcbiAgICBpZiAoaSA+IDAgJiYgZmllbGROYW1lW2kgLSAxXSA9PT0gJ1xcXFwnICYmIChjaCA9PT0gJyQnIHx8IGNoID09PSAnLicpKSB7XG4gICAgICAvLyBlc2NhcGVkIGRlbGltaXRlclxuICAgICAgY3VycmVudCA9IGN1cnJlbnQuc3Vic3RyaW5nKDAsIGN1cnJlbnQubGVuZ3RoIC0gMSkgKyBjaDtcbiAgICB9IGVsc2UgaWYgKGNoID09PSAnLicpIHtcbiAgICAgIC8vIFdoZW4gYC5gIGlzIG5vdCBlc2NhcGVkIChhYm92ZSksIGl0IGlzIGEgZmllbGQgZGVsaW1pdGVyXG4gICAgICBmaWVsZHMucHVzaChjdXJyZW50KTtcbiAgICAgIGN1cnJlbnQgPSAnJztcbiAgICB9IGVsc2UgeyAvLyBub3JtYWwgY2hhcmFjdGVyXG4gICAgICBjdXJyZW50ICs9IGNoO1xuICAgIH1cbiAgfVxuICBmaWVsZHMucHVzaChjdXJyZW50KTtcbiAgcmV0dXJuIGZpZWxkcztcbn1cblxudmFyIGNvbWJpbmF0aW9uRmllbGRzID0gWyckb3InLCAnJG5vcicsICckbm90J107XG5mdW5jdGlvbiBpc0NvbWJpbmF0aW9uYWxGaWVsZChmaWVsZCkge1xuICByZXR1cm4gY29tYmluYXRpb25GaWVsZHMuaW5kZXhPZihmaWVsZCkgPiAtMTtcbn1cblxuZnVuY3Rpb24gZ2V0S2V5KG9iaikge1xuICByZXR1cm4gT2JqZWN0LmtleXMob2JqKVswXTtcbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWUob2JqKSB7XG4gIHJldHVybiBvYmpbZ2V0S2V5KG9iaildO1xufVxuXG5cbi8vIGZsYXR0ZW4gYW4gYXJyYXkgb2Ygc2VsZWN0b3JzIGpvaW5lZCBieSBhbiAkYW5kIG9wZXJhdG9yXG5mdW5jdGlvbiBtZXJnZUFuZGVkU2VsZWN0b3JzKHNlbGVjdG9ycykge1xuXG4gIC8vIHNvcnQgdG8gZW5zdXJlIHRoYXQgZS5nLiBpZiB0aGUgdXNlciBzcGVjaWZpZWRcbiAgLy8gJGFuZDogW3skZ3Q6ICdhJ30sIHskZ3Q6ICdiJ31dLCB0aGVuIGl0J3MgY29sbGFwc2VkIGludG9cbiAgLy8ganVzdCB7JGd0OiAnYid9XG4gIHZhciByZXMgPSB7fTtcbiAgdmFyIGZpcnN0ID0geyRvcjogdHJ1ZSwgJG5vcjogdHJ1ZX07XG5cbiAgc2VsZWN0b3JzLmZvckVhY2goZnVuY3Rpb24gKHNlbGVjdG9yKSB7XG4gICAgT2JqZWN0LmtleXMoc2VsZWN0b3IpLmZvckVhY2goZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgICB2YXIgbWF0Y2hlciA9IHNlbGVjdG9yW2ZpZWxkXTtcbiAgICAgIGlmICh0eXBlb2YgbWF0Y2hlciAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgbWF0Y2hlciA9IHskZXE6IG1hdGNoZXJ9O1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNDb21iaW5hdGlvbmFsRmllbGQoZmllbGQpKSB7XG4gICAgICAgIC8vIG9yLCBub3JcbiAgICAgICAgaWYgKG1hdGNoZXIgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgIGlmIChmaXJzdFtmaWVsZF0pIHtcbiAgICAgICAgICAgIGZpcnN0W2ZpZWxkXSA9IGZhbHNlO1xuICAgICAgICAgICAgcmVzW2ZpZWxkXSA9IG1hdGNoZXI7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIGVudHJpZXMgPSBbXTtcbiAgICAgICAgICByZXNbZmllbGRdLmZvckVhY2goZnVuY3Rpb24gKGV4aXN0aW5nKSB7XG4gICAgICAgICAgICBPYmplY3Qua2V5cyhtYXRjaGVyKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICAgICAgdmFyIG0gPSBtYXRjaGVyW2tleV07XG4gICAgICAgICAgICAgIHZhciBsb25nZXN0ID0gTWF0aC5tYXgoT2JqZWN0LmtleXMoZXhpc3RpbmcpLmxlbmd0aCwgT2JqZWN0LmtleXMobSkubGVuZ3RoKTtcbiAgICAgICAgICAgICAgdmFyIG1lcmdlZCA9IG1lcmdlQW5kZWRTZWxlY3RvcnMoW2V4aXN0aW5nLCBtXSk7XG4gICAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhtZXJnZWQpLmxlbmd0aCA8PSBsb25nZXN0KSB7XG4gICAgICAgICAgICAgICAgLy8gd2UgaGF2ZSBhIHNpdHVhdGlvbiBsaWtlOiAoYSA6eyRlcSA6MX0gfHwgLi4uKSAmJiAoYSB7JGVxOiAyfSB8fCAuLi4pXG4gICAgICAgICAgICAgICAgLy8gbWVyZ2luZyB3b3VsZCBwcm9kdWNlIGEgJGVxIDIgd2hlbiBhY3R1YWxseSB3ZSBzaG91bGRuJ3QgZXZlciBtYXRjaCBhZ2FpbnN0IHRoZXNlIG1lcmdlZCBjb25kaXRpb25zXG4gICAgICAgICAgICAgICAgLy8gbWVyZ2VkIHNob3VsZCBhbHdheXMgY29udGFpbiBtb3JlIHZhbHVlcyB0byBiZSB2YWxpZFxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbnRyaWVzLnB1c2gobWVyZ2VkKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJlc1tmaWVsZF0gPSBlbnRyaWVzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vdFxuICAgICAgICAgIHJlc1tmaWVsZF0gPSBtZXJnZUFuZGVkU2VsZWN0b3JzKFttYXRjaGVyXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBmaWVsZE1hdGNoZXJzID0gcmVzW2ZpZWxkXSA9IHJlc1tmaWVsZF0gfHwge307XG4gICAgICAgIE9iamVjdC5rZXlzKG1hdGNoZXIpLmZvckVhY2goZnVuY3Rpb24gKG9wZXJhdG9yKSB7XG4gICAgICAgICAgdmFyIHZhbHVlID0gbWF0Y2hlcltvcGVyYXRvcl07XG5cbiAgICAgICAgICBpZiAob3BlcmF0b3IgPT09ICckZ3QnIHx8IG9wZXJhdG9yID09PSAnJGd0ZScpIHtcbiAgICAgICAgICAgIHJldHVybiBtZXJnZUd0R3RlKG9wZXJhdG9yLCB2YWx1ZSwgZmllbGRNYXRjaGVycyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gJyRsdCcgfHwgb3BlcmF0b3IgPT09ICckbHRlJykge1xuICAgICAgICAgICAgcmV0dXJuIG1lcmdlTHRMdGUob3BlcmF0b3IsIHZhbHVlLCBmaWVsZE1hdGNoZXJzKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG9wZXJhdG9yID09PSAnJG5lJykge1xuICAgICAgICAgICAgcmV0dXJuIG1lcmdlTmUodmFsdWUsIGZpZWxkTWF0Y2hlcnMpO1xuICAgICAgICAgIH0gZWxzZSBpZiAob3BlcmF0b3IgPT09ICckZXEnKSB7XG4gICAgICAgICAgICByZXR1cm4gbWVyZ2VFcSh2YWx1ZSwgZmllbGRNYXRjaGVycyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChvcGVyYXRvciA9PT0gXCIkcmVnZXhcIikge1xuICAgICAgICAgICAgcmV0dXJuIG1lcmdlUmVnZXgodmFsdWUsIGZpZWxkTWF0Y2hlcnMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmaWVsZE1hdGNoZXJzW29wZXJhdG9yXSA9IHZhbHVlO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHJlcztcbn1cblxuXG5cbi8vIGNvbGxhcHNlIGxvZ2ljYWxseSBlcXVpdmFsZW50IGd0L2d0ZSB2YWx1ZXNcbmZ1bmN0aW9uIG1lcmdlR3RHdGUob3BlcmF0b3IsIHZhbHVlLCBmaWVsZE1hdGNoZXJzKSB7XG4gIGlmICh0eXBlb2YgZmllbGRNYXRjaGVycy4kZXEgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuOyAvLyBkbyBub3RoaW5nXG4gIH1cbiAgaWYgKHR5cGVvZiBmaWVsZE1hdGNoZXJzLiRndGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9wZXJhdG9yID09PSAnJGd0ZScpIHtcbiAgICAgIGlmICh2YWx1ZSA+IGZpZWxkTWF0Y2hlcnMuJGd0ZSkgeyAvLyBtb3JlIHNwZWNpZmljaXR5XG4gICAgICAgIGZpZWxkTWF0Y2hlcnMuJGd0ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIG9wZXJhdG9yID09PSAnJGd0J1xuICAgICAgaWYgKHZhbHVlID49IGZpZWxkTWF0Y2hlcnMuJGd0ZSkgeyAvLyBtb3JlIHNwZWNpZmljaXR5XG4gICAgICAgIGRlbGV0ZSBmaWVsZE1hdGNoZXJzLiRndGU7XG4gICAgICAgIGZpZWxkTWF0Y2hlcnMuJGd0ID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiBmaWVsZE1hdGNoZXJzLiRndCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAob3BlcmF0b3IgPT09ICckZ3RlJykge1xuICAgICAgaWYgKHZhbHVlID4gZmllbGRNYXRjaGVycy4kZ3QpIHsgLy8gbW9yZSBzcGVjaWZpY2l0eVxuICAgICAgICBkZWxldGUgZmllbGRNYXRjaGVycy4kZ3Q7XG4gICAgICAgIGZpZWxkTWF0Y2hlcnMuJGd0ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIG9wZXJhdG9yID09PSAnJGd0J1xuICAgICAgaWYgKHZhbHVlID4gZmllbGRNYXRjaGVycy4kZ3QpIHsgLy8gbW9yZSBzcGVjaWZpY2l0eVxuICAgICAgICBmaWVsZE1hdGNoZXJzLiRndCA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmaWVsZE1hdGNoZXJzW29wZXJhdG9yXSA9IHZhbHVlO1xuICB9XG59XG5cbi8vIGNvbGxhcHNlIGxvZ2ljYWxseSBlcXVpdmFsZW50IGx0L2x0ZSB2YWx1ZXNcbmZ1bmN0aW9uIG1lcmdlTHRMdGUob3BlcmF0b3IsIHZhbHVlLCBmaWVsZE1hdGNoZXJzKSB7XG4gIGlmICh0eXBlb2YgZmllbGRNYXRjaGVycy4kZXEgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuOyAvLyBkbyBub3RoaW5nXG4gIH1cbiAgaWYgKHR5cGVvZiBmaWVsZE1hdGNoZXJzLiRsdGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9wZXJhdG9yID09PSAnJGx0ZScpIHtcbiAgICAgIGlmICh2YWx1ZSA8IGZpZWxkTWF0Y2hlcnMuJGx0ZSkgeyAvLyBtb3JlIHNwZWNpZmljaXR5XG4gICAgICAgIGZpZWxkTWF0Y2hlcnMuJGx0ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIG9wZXJhdG9yID09PSAnJGd0J1xuICAgICAgaWYgKHZhbHVlIDw9IGZpZWxkTWF0Y2hlcnMuJGx0ZSkgeyAvLyBtb3JlIHNwZWNpZmljaXR5XG4gICAgICAgIGRlbGV0ZSBmaWVsZE1hdGNoZXJzLiRsdGU7XG4gICAgICAgIGZpZWxkTWF0Y2hlcnMuJGx0ID0gdmFsdWU7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiBmaWVsZE1hdGNoZXJzLiRsdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBpZiAob3BlcmF0b3IgPT09ICckbHRlJykge1xuICAgICAgaWYgKHZhbHVlIDwgZmllbGRNYXRjaGVycy4kbHQpIHsgLy8gbW9yZSBzcGVjaWZpY2l0eVxuICAgICAgICBkZWxldGUgZmllbGRNYXRjaGVycy4kbHQ7XG4gICAgICAgIGZpZWxkTWF0Y2hlcnMuJGx0ZSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH0gZWxzZSB7IC8vIG9wZXJhdG9yID09PSAnJGd0J1xuICAgICAgaWYgKHZhbHVlIDwgZmllbGRNYXRjaGVycy4kbHQpIHsgLy8gbW9yZSBzcGVjaWZpY2l0eVxuICAgICAgICBmaWVsZE1hdGNoZXJzLiRsdCA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBmaWVsZE1hdGNoZXJzW29wZXJhdG9yXSA9IHZhbHVlO1xuICB9XG59XG5cbi8vIGNvbWJpbmUgJG5lIHZhbHVlcyBpbnRvIG9uZSBhcnJheVxuZnVuY3Rpb24gbWVyZ2VOZSh2YWx1ZSwgZmllbGRNYXRjaGVycykge1xuICBpZiAoJyRuZScgaW4gZmllbGRNYXRjaGVycykge1xuICAgIC8vIHRoZXJlIGFyZSBtYW55IHRoaW5ncyB0aGlzIGNvdWxkIFwibm90XCIgYmVcbiAgICBmaWVsZE1hdGNoZXJzLiRuZS5wdXNoKHZhbHVlKTtcbiAgfSBlbHNlIHsgLy8gZG9lc24ndCBleGlzdCB5ZXRcbiAgICBmaWVsZE1hdGNoZXJzLiRuZSA9IFt2YWx1ZV07XG4gIH1cbn1cblxuLy8gYWRkICRlcSBpbnRvIHRoZSBtaXhcbmZ1bmN0aW9uIG1lcmdlRXEodmFsdWUsIGZpZWxkTWF0Y2hlcnMpIHtcbiAgLy8gdGhlc2UgYWxsIGhhdmUgbGVzcyBzcGVjaWZpY2l0eSB0aGFuIHRoZSAkZXFcbiAgLy8gVE9ETzogY2hlY2sgZm9yIHVzZXIgZXJyb3JzIGhlcmVcbiAgZGVsZXRlIGZpZWxkTWF0Y2hlcnMuJGd0O1xuICBkZWxldGUgZmllbGRNYXRjaGVycy4kZ3RlO1xuICBkZWxldGUgZmllbGRNYXRjaGVycy4kbHQ7XG4gIGRlbGV0ZSBmaWVsZE1hdGNoZXJzLiRsdGU7XG4gIGRlbGV0ZSBmaWVsZE1hdGNoZXJzLiRuZTtcbiAgZmllbGRNYXRjaGVycy4kZXEgPSB2YWx1ZTtcbn1cblxuLy8gY29tYmluZSAkcmVnZXggdmFsdWVzIGludG8gb25lIGFycmF5XG5mdW5jdGlvbiBtZXJnZVJlZ2V4KHZhbHVlLCBmaWVsZE1hdGNoZXJzKSB7XG4gIGlmICgnJHJlZ2V4JyBpbiBmaWVsZE1hdGNoZXJzKSB7XG4gICAgLy8gYSB2YWx1ZSBjb3VsZCBtYXRjaCBtdWx0aXBsZSByZWdleGVzXG4gICAgZmllbGRNYXRjaGVycy4kcmVnZXgucHVzaCh2YWx1ZSk7XG4gIH0gZWxzZSB7IC8vIGRvZXNuJ3QgZXhpc3QgeWV0XG4gICAgZmllbGRNYXRjaGVycy4kcmVnZXggPSBbdmFsdWVdO1xuICB9XG59XG5cbi8vIzc0NTg6IGV4ZWN1dGUgZnVuY3Rpb24gbWVyZ2VBbmRlZFNlbGVjdG9ycyBvbiBuZXN0ZWQgJGFuZFxuZnVuY3Rpb24gbWVyZ2VBbmRlZFNlbGVjdG9yc05lc3RlZChvYmopIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iaikge1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmopKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgICAgICAgICAgICAgIGlmIChvYmpbaV1bJyRhbmQnXSkge1xuICAgICAgICAgICAgICAgICAgICBvYmpbaV0gPSBtZXJnZUFuZGVkU2VsZWN0b3JzKG9ialtpXVsnJGFuZCddKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbHVlID0gb2JqW3Byb3BdO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgbWVyZ2VBbmRlZFNlbGVjdG9yc05lc3RlZCh2YWx1ZSk7IC8vIDwtIHJlY3Vyc2l2ZSBjYWxsXG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbn1cblxuLy8jNzQ1ODogZGV0ZXJtaW5lIGlkICRhbmQgaXMgcHJlc2VudCBpbiBzZWxlY3RvciAoYXQgYW55IGxldmVsKVxuZnVuY3Rpb24gaXNBbmRJblNlbGVjdG9yKG9iaiwgaXNBbmQpIHtcbiAgICBmb3IgKHZhciBwcm9wIGluIG9iaikge1xuICAgICAgICBpZiAocHJvcCA9PT0gJyRhbmQnKSB7XG4gICAgICAgICAgICBpc0FuZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHZhbHVlID0gb2JqW3Byb3BdO1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaXNBbmQgPSBpc0FuZEluU2VsZWN0b3IodmFsdWUsIGlzQW5kKTsgLy8gPC0gcmVjdXJzaXZlIGNhbGxcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaXNBbmQ7XG59XG5cbi8vXG4vLyBub3JtYWxpemUgdGhlIHNlbGVjdG9yXG4vL1xuZnVuY3Rpb24gbWFzc2FnZVNlbGVjdG9yKGlucHV0KSB7XG4gIHZhciByZXN1bHQgPSBjbG9uZShpbnB1dCk7XG5cbiAgLy8jNzQ1ODogaWYgJGFuZCBpcyBwcmVzZW50IGluIHNlbGVjdG9yIChhdCBhbnkgbGV2ZWwpIG1lcmdlIG5lc3RlZCAkYW5kXG4gIGlmIChpc0FuZEluU2VsZWN0b3IocmVzdWx0LCBmYWxzZSkpIHtcbiAgICByZXN1bHQgPSBtZXJnZUFuZGVkU2VsZWN0b3JzTmVzdGVkKHJlc3VsdCk7XG4gICAgaWYgKCckYW5kJyBpbiByZXN1bHQpIHtcbiAgICAgIHJlc3VsdCA9IG1lcmdlQW5kZWRTZWxlY3RvcnMocmVzdWx0WyckYW5kJ10pO1xuICAgIH1cbiAgfVxuXG4gIFsnJG9yJywgJyRub3InXS5mb3JFYWNoKGZ1bmN0aW9uIChvck9yTm9yKSB7XG4gICAgaWYgKG9yT3JOb3IgaW4gcmVzdWx0KSB7XG4gICAgICAvLyBtZXNzYWdlIGVhY2ggaW5kaXZpZHVhbCBzZWxlY3RvclxuICAgICAgLy8gZS5nLiB7Zm9vOiAnYmFyJ30gYmVjb21lcyB7Zm9vOiB7JGVxOiAnYmFyJ319XG4gICAgICByZXN1bHRbb3JPck5vcl0uZm9yRWFjaChmdW5jdGlvbiAoc3ViU2VsZWN0b3IpIHtcbiAgICAgICAgdmFyIGZpZWxkcyA9IE9iamVjdC5rZXlzKHN1YlNlbGVjdG9yKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICB2YXIgZmllbGQgPSBmaWVsZHNbaV07XG4gICAgICAgICAgdmFyIG1hdGNoZXIgPSBzdWJTZWxlY3RvcltmaWVsZF07XG4gICAgICAgICAgaWYgKHR5cGVvZiBtYXRjaGVyICE9PSAnb2JqZWN0JyB8fCBtYXRjaGVyID09PSBudWxsKSB7XG4gICAgICAgICAgICBzdWJTZWxlY3RvcltmaWVsZF0gPSB7JGVxOiBtYXRjaGVyfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCckbm90JyBpbiByZXN1bHQpIHtcbiAgICAvL1RoaXMgZmVlbHMgYSBsaXR0bGUgbGlrZSBmb3JjaW5nLCBidXQgaXQgd2lsbCB3b3JrIGZvciBub3csXG4gICAgLy9JIHdvdWxkIGxpa2UgdG8gY29tZSBiYWNrIHRvIHRoaXMgYW5kIG1ha2UgdGhlIG1lcmdpbmcgb2Ygc2VsZWN0b3JzIGEgbGl0dGxlIG1vcmUgZ2VuZXJpY1xuICAgIHJlc3VsdFsnJG5vdCddID0gbWVyZ2VBbmRlZFNlbGVjdG9ycyhbcmVzdWx0Wyckbm90J11dKTtcbiAgfVxuXG4gIHZhciBmaWVsZHMgPSBPYmplY3Qua2V5cyhyZXN1bHQpO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGZpZWxkID0gZmllbGRzW2ldO1xuICAgIHZhciBtYXRjaGVyID0gcmVzdWx0W2ZpZWxkXTtcblxuICAgIGlmICh0eXBlb2YgbWF0Y2hlciAhPT0gJ29iamVjdCcgfHwgbWF0Y2hlciA9PT0gbnVsbCkge1xuICAgICAgbWF0Y2hlciA9IHskZXE6IG1hdGNoZXJ9O1xuICAgIH1cbiAgICByZXN1bHRbZmllbGRdID0gbWF0Y2hlcjtcbiAgfVxuXG4gIG5vcm1hbGl6ZUFycmF5T3BlcmF0b3JzKHJlc3VsdCk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy9cbi8vIFRoZSAkbmUgYW5kICRyZWdleCB2YWx1ZXMgbXVzdCBiZSBwbGFjZWQgaW4gYW4gYXJyYXkgYmVjYXVzZSB0aGVzZSBvcGVyYXRvcnMgY2FuIGJlIHVzZWQgbXVsdGlwbGUgdGltZXMgb24gdGhlIHNhbWUgZmllbGQuXG4vLyBXaGVuICRhbmQgaXMgdXNlZCwgbWVyZ2VBbmRlZFNlbGVjdG9ycyB0YWtlcyBjYXJlIG9mIHB1dHRpbmcgc29tZSBvZiB0aGVtIGludG8gYXJyYXlzLCBvdGhlcndpc2UgaXQncyBkb25lIGhlcmUuXG4vL1xuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXlPcGVyYXRvcnMoc2VsZWN0b3IpIHtcbiAgT2JqZWN0LmtleXMoc2VsZWN0b3IpLmZvckVhY2goZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgdmFyIG1hdGNoZXIgPSBzZWxlY3RvcltmaWVsZF07XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRjaGVyKSkge1xuICAgICAgbWF0Y2hlci5mb3JFYWNoKGZ1bmN0aW9uIChtYXRjaGVySXRlbSkge1xuICAgICAgICBpZiAobWF0Y2hlckl0ZW0gJiYgdHlwZW9mIG1hdGNoZXJJdGVtID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgIG5vcm1hbGl6ZUFycmF5T3BlcmF0b3JzKG1hdGNoZXJJdGVtKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChmaWVsZCA9PT0gJyRuZScpIHtcbiAgICAgIHNlbGVjdG9yLiRuZSA9IFttYXRjaGVyXTtcbiAgICB9IGVsc2UgaWYgKGZpZWxkID09PSAnJHJlZ2V4Jykge1xuICAgICAgc2VsZWN0b3IuJHJlZ2V4ID0gW21hdGNoZXJdO1xuICAgIH0gZWxzZSBpZiAobWF0Y2hlciAmJiB0eXBlb2YgbWF0Y2hlciA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG5vcm1hbGl6ZUFycmF5T3BlcmF0b3JzKG1hdGNoZXIpO1xuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCB7XG4gIG1hc3NhZ2VTZWxlY3RvcixcbiAgaXNDb21iaW5hdGlvbmFsRmllbGQsXG4gIGdldEtleSxcbiAgZ2V0VmFsdWUsXG4gIGdldEZpZWxkRnJvbURvYyxcbiAgc2V0RmllbGRJbkRvYyxcbiAgY29tcGFyZSxcbiAgcGFyc2VGaWVsZFxufTtcbiIsImltcG9ydCB7IGNvbGxhdGUgfSBmcm9tICdwb3VjaGRiLWNvbGxhdGUnO1xuaW1wb3J0IHtcbiAgaXNDb21iaW5hdGlvbmFsRmllbGQsXG4gIGdldEtleSxcbiAgZ2V0VmFsdWUsXG4gIGNvbXBhcmUsXG4gIHBhcnNlRmllbGQsXG4gIGdldEZpZWxkRnJvbURvY1xufSBmcm9tICcuL3V0aWxzJztcblxuLy8gY3JlYXRlIGEgY29tcGFyYXRvciBiYXNlZCBvbiB0aGUgc29ydCBvYmplY3RcbmZ1bmN0aW9uIGNyZWF0ZUZpZWxkU29ydGVyKHNvcnQpIHtcblxuICBmdW5jdGlvbiBnZXRGaWVsZFZhbHVlc0FzQXJyYXkoZG9jKSB7XG4gICAgcmV0dXJuIHNvcnQubWFwKGZ1bmN0aW9uIChzb3J0aW5nKSB7XG4gICAgICB2YXIgZmllbGROYW1lID0gZ2V0S2V5KHNvcnRpbmcpO1xuICAgICAgdmFyIHBhcnNlZEZpZWxkID0gcGFyc2VGaWVsZChmaWVsZE5hbWUpO1xuICAgICAgdmFyIGRvY0ZpZWxkVmFsdWUgPSBnZXRGaWVsZEZyb21Eb2MoZG9jLCBwYXJzZWRGaWVsZCk7XG4gICAgICByZXR1cm4gZG9jRmllbGRWYWx1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoYVJvdywgYlJvdykge1xuICAgIHZhciBhRmllbGRWYWx1ZXMgPSBnZXRGaWVsZFZhbHVlc0FzQXJyYXkoYVJvdy5kb2MpO1xuICAgIHZhciBiRmllbGRWYWx1ZXMgPSBnZXRGaWVsZFZhbHVlc0FzQXJyYXkoYlJvdy5kb2MpO1xuICAgIHZhciBjb2xsYXRpb24gPSBjb2xsYXRlKGFGaWVsZFZhbHVlcywgYkZpZWxkVmFsdWVzKTtcbiAgICBpZiAoY29sbGF0aW9uICE9PSAwKSB7XG4gICAgICByZXR1cm4gY29sbGF0aW9uO1xuICAgIH1cbiAgICAvLyB0aGlzIGlzIHdoYXQgbWFuZ28gc2VlbXMgdG8gZG9cbiAgICByZXR1cm4gY29tcGFyZShhUm93LmRvYy5faWQsIGJSb3cuZG9jLl9pZCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZpbHRlckluTWVtb3J5RmllbGRzKHJvd3MsIHJlcXVlc3REZWYsIGluTWVtb3J5RmllbGRzKSB7XG4gIHJvd3MgPSByb3dzLmZpbHRlcihmdW5jdGlvbiAocm93KSB7XG4gICAgcmV0dXJuIHJvd0ZpbHRlcihyb3cuZG9jLCByZXF1ZXN0RGVmLnNlbGVjdG9yLCBpbk1lbW9yeUZpZWxkcyk7XG4gIH0pO1xuXG4gIGlmIChyZXF1ZXN0RGVmLnNvcnQpIHtcbiAgICAvLyBpbi1tZW1vcnkgc29ydFxuICAgIHZhciBmaWVsZFNvcnRlciA9IGNyZWF0ZUZpZWxkU29ydGVyKHJlcXVlc3REZWYuc29ydCk7XG4gICAgcm93cyA9IHJvd3Muc29ydChmaWVsZFNvcnRlcik7XG4gICAgaWYgKHR5cGVvZiByZXF1ZXN0RGVmLnNvcnRbMF0gIT09ICdzdHJpbmcnICYmXG4gICAgICAgIGdldFZhbHVlKHJlcXVlc3REZWYuc29ydFswXSkgPT09ICdkZXNjJykge1xuICAgICAgcm93cyA9IHJvd3MucmV2ZXJzZSgpO1xuICAgIH1cbiAgfVxuXG4gIGlmICgnbGltaXQnIGluIHJlcXVlc3REZWYgfHwgJ3NraXAnIGluIHJlcXVlc3REZWYpIHtcbiAgICAvLyBoYXZlIHRvIGRvIHRoZSBsaW1pdCBpbi1tZW1vcnlcbiAgICB2YXIgc2tpcCA9IHJlcXVlc3REZWYuc2tpcCB8fCAwO1xuICAgIHZhciBsaW1pdCA9ICgnbGltaXQnIGluIHJlcXVlc3REZWYgPyByZXF1ZXN0RGVmLmxpbWl0IDogcm93cy5sZW5ndGgpICsgc2tpcDtcbiAgICByb3dzID0gcm93cy5zbGljZShza2lwLCBsaW1pdCk7XG4gIH1cbiAgcmV0dXJuIHJvd3M7XG59XG5cbmZ1bmN0aW9uIHJvd0ZpbHRlcihkb2MsIHNlbGVjdG9yLCBpbk1lbW9yeUZpZWxkcykge1xuICByZXR1cm4gaW5NZW1vcnlGaWVsZHMuZXZlcnkoZnVuY3Rpb24gKGZpZWxkKSB7XG4gICAgdmFyIG1hdGNoZXIgPSBzZWxlY3RvcltmaWVsZF07XG4gICAgdmFyIHBhcnNlZEZpZWxkID0gcGFyc2VGaWVsZChmaWVsZCk7XG4gICAgdmFyIGRvY0ZpZWxkVmFsdWUgPSBnZXRGaWVsZEZyb21Eb2MoZG9jLCBwYXJzZWRGaWVsZCk7XG4gICAgaWYgKGlzQ29tYmluYXRpb25hbEZpZWxkKGZpZWxkKSkge1xuICAgICAgcmV0dXJuIG1hdGNoQ29taW5hdGlvbmFsU2VsZWN0b3IoZmllbGQsIG1hdGNoZXIsIGRvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoU2VsZWN0b3IobWF0Y2hlciwgZG9jLCBwYXJzZWRGaWVsZCwgZG9jRmllbGRWYWx1ZSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBtYXRjaFNlbGVjdG9yKG1hdGNoZXIsIGRvYywgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgaWYgKCFtYXRjaGVyKSB7XG4gICAgLy8gbm8gZmlsdGVyaW5nIG5lY2Vzc2FyeTsgdGhpcyBmaWVsZCBpcyBqdXN0IG5lZWRlZCBmb3Igc29ydGluZ1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gaXMgbWF0Y2hlciBhbiBvYmplY3QsIGlmIHNvIGNvbnRpbnVlIHJlY3Vyc2lvblxuICBpZiAodHlwZW9mIG1hdGNoZXIgPT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG1hdGNoZXIpLmV2ZXJ5KGZ1bmN0aW9uIChtYXliZVVzZXJPcGVyYXRvcikge1xuICAgICAgdmFyIHVzZXJWYWx1ZSA9IG1hdGNoZXJbIG1heWJlVXNlck9wZXJhdG9yIF07XG4gICAgICAvLyBleHBsaWNpdCBvcGVyYXRvclxuICAgICAgaWYgKG1heWJlVXNlck9wZXJhdG9yLmluZGV4T2YoXCIkXCIpID09PSAwKSB7XG4gICAgICAgIHJldHVybiBtYXRjaChtYXliZVVzZXJPcGVyYXRvciwgZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBzdWJQYXJzZWRGaWVsZCA9IHBhcnNlRmllbGQobWF5YmVVc2VyT3BlcmF0b3IpO1xuXG4gICAgICAgIGlmIChcbiAgICAgICAgICBkb2NGaWVsZFZhbHVlID09PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICB0eXBlb2YgdXNlclZhbHVlICE9PSBcIm9iamVjdFwiICYmXG4gICAgICAgICAgc3ViUGFyc2VkRmllbGQubGVuZ3RoID4gMFxuICAgICAgICApIHtcbiAgICAgICAgICAvLyB0aGUgZmllbGQgZG9lcyBub3QgZXhpc3QsIHJldHVybiBvciBnZXRGaWVsZEZyb21Eb2Mgd2lsbCB0aHJvd1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzdWJEb2NGaWVsZFZhbHVlID0gZ2V0RmllbGRGcm9tRG9jKGRvY0ZpZWxkVmFsdWUsIHN1YlBhcnNlZEZpZWxkKTtcblxuICAgICAgICBpZiAodHlwZW9mIHVzZXJWYWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgIC8vIGZpZWxkIHZhbHVlIGlzIGFuIG9iamVjdCB0aGF0IG1pZ2h0IGNvbnRhaW4gbW9yZSBvcGVyYXRvcnNcbiAgICAgICAgICByZXR1cm4gbWF0Y2hTZWxlY3Rvcih1c2VyVmFsdWUsIGRvYywgcGFyc2VkRmllbGQsIHN1YkRvY0ZpZWxkVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gaW1wbGljaXQgb3BlcmF0b3JcbiAgICAgICAgcmV0dXJuIG1hdGNoKFwiJGVxXCIsIGRvYywgdXNlclZhbHVlLCBzdWJQYXJzZWRGaWVsZCwgc3ViRG9jRmllbGRWYWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBubyBtb3JlIGRlcHRoLCBObyBuZWVkIHRvIHJlY3Vyc2UgZnVydGhlclxuICByZXR1cm4gbWF0Y2hlciA9PT0gZG9jRmllbGRWYWx1ZTtcbn1cblxuZnVuY3Rpb24gbWF0Y2hDb21pbmF0aW9uYWxTZWxlY3RvcihmaWVsZCwgbWF0Y2hlciwgZG9jKSB7XG5cbiAgaWYgKGZpZWxkID09PSAnJG9yJykge1xuICAgIHJldHVybiBtYXRjaGVyLnNvbWUoZnVuY3Rpb24gKG9yTWF0Y2hlcnMpIHtcbiAgICAgIHJldHVybiByb3dGaWx0ZXIoZG9jLCBvck1hdGNoZXJzLCBPYmplY3Qua2V5cyhvck1hdGNoZXJzKSk7XG4gICAgfSk7XG4gIH1cblxuICBpZiAoZmllbGQgPT09ICckbm90Jykge1xuICAgIHJldHVybiAhcm93RmlsdGVyKGRvYywgbWF0Y2hlciwgT2JqZWN0LmtleXMobWF0Y2hlcikpO1xuICB9XG5cbiAgLy9gJG5vcmBcbiAgcmV0dXJuICFtYXRjaGVyLmZpbmQoZnVuY3Rpb24gKG9yTWF0Y2hlcnMpIHtcbiAgICByZXR1cm4gcm93RmlsdGVyKGRvYywgb3JNYXRjaGVycywgT2JqZWN0LmtleXMob3JNYXRjaGVycykpO1xuICB9KTtcblxufVxuXG5mdW5jdGlvbiBtYXRjaCh1c2VyT3BlcmF0b3IsIGRvYywgdXNlclZhbHVlLCBwYXJzZWRGaWVsZCwgZG9jRmllbGRWYWx1ZSkge1xuICBpZiAoIW1hdGNoZXJzW3VzZXJPcGVyYXRvcl0pIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIHRocm93IG5ldyBFcnJvcigndW5rbm93biBvcGVyYXRvciBcIicgKyB1c2VyT3BlcmF0b3IgK1xuICAgICAgJ1wiIC0gc2hvdWxkIGJlIG9uZSBvZiAkZXEsICRsdGUsICRsdCwgJGd0LCAkZ3RlLCAkZXhpc3RzLCAkbmUsICRpbiwgJyArXG4gICAgICAnJG5pbiwgJHNpemUsICRtb2QsICRyZWdleCwgJGVsZW1NYXRjaCwgJHR5cGUsICRhbGxNYXRjaCBvciAkYWxsJyk7XG4gIH1cbiAgcmV0dXJuIG1hdGNoZXJzW3VzZXJPcGVyYXRvcl0oZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZmllbGRFeGlzdHMoZG9jRmllbGRWYWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIGRvY0ZpZWxkVmFsdWUgIT09ICd1bmRlZmluZWQnICYmIGRvY0ZpZWxkVmFsdWUgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGZpZWxkSXNOb3RVbmRlZmluZWQoZG9jRmllbGRWYWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIGRvY0ZpZWxkVmFsdWUgIT09ICd1bmRlZmluZWQnO1xufVxuXG5mdW5jdGlvbiBtb2RGaWVsZChkb2NGaWVsZFZhbHVlLCB1c2VyVmFsdWUpIHtcbiAgaWYgKHR5cGVvZiBkb2NGaWVsZFZhbHVlICE9PSBcIm51bWJlclwiIHx8XG4gICAgcGFyc2VJbnQoZG9jRmllbGRWYWx1ZSwgMTApICE9PSBkb2NGaWVsZFZhbHVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmFyIGRpdmlzb3IgPSB1c2VyVmFsdWVbMF07XG4gIHZhciBtb2QgPSB1c2VyVmFsdWVbMV07XG5cbiAgcmV0dXJuIGRvY0ZpZWxkVmFsdWUgJSBkaXZpc29yID09PSBtb2Q7XG59XG5cbmZ1bmN0aW9uIGFycmF5Q29udGFpbnNWYWx1ZShkb2NGaWVsZFZhbHVlLCB1c2VyVmFsdWUpIHtcbiAgcmV0dXJuIHVzZXJWYWx1ZS5zb21lKGZ1bmN0aW9uICh2YWwpIHtcbiAgICBpZiAoZG9jRmllbGRWYWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICByZXR1cm4gZG9jRmllbGRWYWx1ZS5zb21lKGZ1bmN0aW9uIChkb2NGaWVsZFZhbHVlSXRlbSkge1xuICAgICAgICByZXR1cm4gY29sbGF0ZSh2YWwsIGRvY0ZpZWxkVmFsdWVJdGVtKSA9PT0gMDtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBjb2xsYXRlKHZhbCwgZG9jRmllbGRWYWx1ZSkgPT09IDA7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhcnJheUNvbnRhaW5zQWxsVmFsdWVzKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSkge1xuICByZXR1cm4gdXNlclZhbHVlLmV2ZXJ5KGZ1bmN0aW9uICh2YWwpIHtcbiAgICByZXR1cm4gZG9jRmllbGRWYWx1ZS5zb21lKGZ1bmN0aW9uIChkb2NGaWVsZFZhbHVlSXRlbSkge1xuICAgICAgcmV0dXJuIGNvbGxhdGUodmFsLCBkb2NGaWVsZFZhbHVlSXRlbSkgPT09IDA7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBhcnJheVNpemUoZG9jRmllbGRWYWx1ZSwgdXNlclZhbHVlKSB7XG4gIHJldHVybiBkb2NGaWVsZFZhbHVlLmxlbmd0aCA9PT0gdXNlclZhbHVlO1xufVxuXG5mdW5jdGlvbiByZWdleE1hdGNoKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSkge1xuICB2YXIgcmUgPSBuZXcgUmVnRXhwKHVzZXJWYWx1ZSk7XG5cbiAgcmV0dXJuIHJlLnRlc3QoZG9jRmllbGRWYWx1ZSk7XG59XG5cbmZ1bmN0aW9uIHR5cGVNYXRjaChkb2NGaWVsZFZhbHVlLCB1c2VyVmFsdWUpIHtcblxuICBzd2l0Y2ggKHVzZXJWYWx1ZSkge1xuICAgIGNhc2UgJ251bGwnOlxuICAgICAgcmV0dXJuIGRvY0ZpZWxkVmFsdWUgPT09IG51bGw7XG4gICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICByZXR1cm4gdHlwZW9mIChkb2NGaWVsZFZhbHVlKSA9PT0gJ2Jvb2xlYW4nO1xuICAgIGNhc2UgJ251bWJlcic6XG4gICAgICByZXR1cm4gdHlwZW9mIChkb2NGaWVsZFZhbHVlKSA9PT0gJ251bWJlcic7XG4gICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgIHJldHVybiB0eXBlb2YgKGRvY0ZpZWxkVmFsdWUpID09PSAnc3RyaW5nJztcbiAgICBjYXNlICdhcnJheSc6XG4gICAgICByZXR1cm4gZG9jRmllbGRWYWx1ZSBpbnN0YW5jZW9mIEFycmF5O1xuICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICByZXR1cm4gKHt9KS50b1N0cmluZy5jYWxsKGRvY0ZpZWxkVmFsdWUpID09PSAnW29iamVjdCBPYmplY3RdJztcbiAgfVxufVxuXG52YXIgbWF0Y2hlcnMgPSB7XG5cbiAgJyRlbGVtTWF0Y2gnOiBmdW5jdGlvbiAoZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGRvY0ZpZWxkVmFsdWUpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGRvY0ZpZWxkVmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBkb2NGaWVsZFZhbHVlWzBdID09PSAnb2JqZWN0JyAmJiAgZG9jRmllbGRWYWx1ZVswXSAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGRvY0ZpZWxkVmFsdWUuc29tZShmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIHJldHVybiByb3dGaWx0ZXIodmFsLCB1c2VyVmFsdWUsIE9iamVjdC5rZXlzKHVzZXJWYWx1ZSkpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRvY0ZpZWxkVmFsdWUuc29tZShmdW5jdGlvbiAodmFsKSB7XG4gICAgICByZXR1cm4gbWF0Y2hTZWxlY3Rvcih1c2VyVmFsdWUsIGRvYywgcGFyc2VkRmllbGQsIHZhbCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgJyRhbGxNYXRjaCc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoZG9jRmllbGRWYWx1ZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuICAgIGlmIChkb2NGaWVsZFZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgZG9jRmllbGRWYWx1ZVswXSA9PT0gJ29iamVjdCcgJiYgIGRvY0ZpZWxkVmFsdWVbMF0gIT09IG51bGwpIHtcbiAgICAgIHJldHVybiBkb2NGaWVsZFZhbHVlLmV2ZXJ5KGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgcmV0dXJuIHJvd0ZpbHRlcih2YWwsIHVzZXJWYWx1ZSwgT2JqZWN0LmtleXModXNlclZhbHVlKSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZG9jRmllbGRWYWx1ZS5ldmVyeShmdW5jdGlvbiAodmFsKSB7XG4gICAgICByZXR1cm4gbWF0Y2hTZWxlY3Rvcih1c2VyVmFsdWUsIGRvYywgcGFyc2VkRmllbGQsIHZhbCk7XG4gICAgfSk7XG4gIH0sXG5cbiAgJyRlcSc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gZmllbGRJc05vdFVuZGVmaW5lZChkb2NGaWVsZFZhbHVlKSAmJiBjb2xsYXRlKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSkgPT09IDA7XG4gIH0sXG5cbiAgJyRndGUnOiBmdW5jdGlvbiAoZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKSB7XG4gICAgcmV0dXJuIGZpZWxkSXNOb3RVbmRlZmluZWQoZG9jRmllbGRWYWx1ZSkgJiYgY29sbGF0ZShkb2NGaWVsZFZhbHVlLCB1c2VyVmFsdWUpID49IDA7XG4gIH0sXG5cbiAgJyRndCc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gZmllbGRJc05vdFVuZGVmaW5lZChkb2NGaWVsZFZhbHVlKSAmJiBjb2xsYXRlKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSkgPiAwO1xuICB9LFxuXG4gICckbHRlJzogZnVuY3Rpb24gKGRvYywgdXNlclZhbHVlLCBwYXJzZWRGaWVsZCwgZG9jRmllbGRWYWx1ZSkge1xuICAgIHJldHVybiBmaWVsZElzTm90VW5kZWZpbmVkKGRvY0ZpZWxkVmFsdWUpICYmIGNvbGxhdGUoZG9jRmllbGRWYWx1ZSwgdXNlclZhbHVlKSA8PSAwO1xuICB9LFxuXG4gICckbHQnOiBmdW5jdGlvbiAoZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKSB7XG4gICAgcmV0dXJuIGZpZWxkSXNOb3RVbmRlZmluZWQoZG9jRmllbGRWYWx1ZSkgJiYgY29sbGF0ZShkb2NGaWVsZFZhbHVlLCB1c2VyVmFsdWUpIDwgMDtcbiAgfSxcblxuICAnJGV4aXN0cyc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICAvL2EgZmllbGQgdGhhdCBpcyBudWxsIGlzIHN0aWxsIGNvbnNpZGVyZWQgdG8gZXhpc3RcbiAgICBpZiAodXNlclZhbHVlKSB7XG4gICAgICByZXR1cm4gZmllbGRJc05vdFVuZGVmaW5lZChkb2NGaWVsZFZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gIWZpZWxkSXNOb3RVbmRlZmluZWQoZG9jRmllbGRWYWx1ZSk7XG4gIH0sXG5cbiAgJyRtb2QnOiBmdW5jdGlvbiAoZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKSB7XG4gICAgcmV0dXJuIGZpZWxkRXhpc3RzKGRvY0ZpZWxkVmFsdWUpICYmIG1vZEZpZWxkKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSk7XG4gIH0sXG5cbiAgJyRuZSc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gdXNlclZhbHVlLmV2ZXJ5KGZ1bmN0aW9uIChuZVZhbHVlKSB7XG4gICAgICByZXR1cm4gY29sbGF0ZShkb2NGaWVsZFZhbHVlLCBuZVZhbHVlKSAhPT0gMDtcbiAgICB9KTtcbiAgfSxcbiAgJyRpbic6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gZmllbGRFeGlzdHMoZG9jRmllbGRWYWx1ZSkgJiYgYXJyYXlDb250YWluc1ZhbHVlKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSk7XG4gIH0sXG5cbiAgJyRuaW4nOiBmdW5jdGlvbiAoZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKSB7XG4gICAgcmV0dXJuIGZpZWxkRXhpc3RzKGRvY0ZpZWxkVmFsdWUpICYmICFhcnJheUNvbnRhaW5zVmFsdWUoZG9jRmllbGRWYWx1ZSwgdXNlclZhbHVlKTtcbiAgfSxcblxuICAnJHNpemUnOiBmdW5jdGlvbiAoZG9jLCB1c2VyVmFsdWUsIHBhcnNlZEZpZWxkLCBkb2NGaWVsZFZhbHVlKSB7XG4gICAgcmV0dXJuIGZpZWxkRXhpc3RzKGRvY0ZpZWxkVmFsdWUpICYmXG4gICAgICBBcnJheS5pc0FycmF5KGRvY0ZpZWxkVmFsdWUpICYmXG4gICAgICBhcnJheVNpemUoZG9jRmllbGRWYWx1ZSwgdXNlclZhbHVlKTtcbiAgfSxcblxuICAnJGFsbCc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gQXJyYXkuaXNBcnJheShkb2NGaWVsZFZhbHVlKSAmJiBhcnJheUNvbnRhaW5zQWxsVmFsdWVzKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSk7XG4gIH0sXG5cbiAgJyRyZWdleCc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gZmllbGRFeGlzdHMoZG9jRmllbGRWYWx1ZSkgJiZcbiAgICAgIHR5cGVvZiBkb2NGaWVsZFZhbHVlID09IFwic3RyaW5nXCIgJiZcbiAgICAgIHVzZXJWYWx1ZS5ldmVyeShmdW5jdGlvbiAocmVnZXhWYWx1ZSkge1xuICAgICAgICByZXR1cm4gcmVnZXhNYXRjaChkb2NGaWVsZFZhbHVlLCByZWdleFZhbHVlKTtcbiAgICAgIH0pO1xuICB9LFxuXG4gICckdHlwZSc6IGZ1bmN0aW9uIChkb2MsIHVzZXJWYWx1ZSwgcGFyc2VkRmllbGQsIGRvY0ZpZWxkVmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZU1hdGNoKGRvY0ZpZWxkVmFsdWUsIHVzZXJWYWx1ZSk7XG4gIH1cbn07XG5cbmV4cG9ydCB7IGZpbHRlckluTWVtb3J5RmllbGRzLCBjcmVhdGVGaWVsZFNvcnRlciwgcm93RmlsdGVyIH07XG4iLCJpbXBvcnQgeyBtYXNzYWdlU2VsZWN0b3IgfSBmcm9tICcuL3V0aWxzJztcbmltcG9ydCB7IGZpbHRlckluTWVtb3J5RmllbGRzIH0gZnJvbSAnLi9pbi1tZW1vcnktZmlsdGVyJztcblxuLy8gcmV0dXJuIHRydWUgaWYgdGhlIGdpdmVuIGRvYyBtYXRjaGVzIHRoZSBzdXBwbGllZCBzZWxlY3RvclxuZnVuY3Rpb24gbWF0Y2hlc1NlbGVjdG9yKGRvYywgc2VsZWN0b3IpIHtcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICh0eXBlb2Ygc2VsZWN0b3IgIT09ICdvYmplY3QnKSB7XG4gICAgLy8gbWF0Y2ggdGhlIENvdWNoREIgZXJyb3IgbWVzc2FnZVxuICAgIHRocm93IG5ldyBFcnJvcignU2VsZWN0b3IgZXJyb3I6IGV4cGVjdGVkIGEgSlNPTiBvYmplY3QnKTtcbiAgfVxuXG4gIHNlbGVjdG9yID0gbWFzc2FnZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgdmFyIHJvdyA9IHtcbiAgICAnZG9jJzogZG9jXG4gIH07XG5cbiAgdmFyIHJvd3NNYXRjaGVkID0gZmlsdGVySW5NZW1vcnlGaWVsZHMoW3Jvd10sIHsgJ3NlbGVjdG9yJzogc2VsZWN0b3IgfSwgT2JqZWN0LmtleXMoc2VsZWN0b3IpKTtcbiAgcmV0dXJuIHJvd3NNYXRjaGVkICYmIHJvd3NNYXRjaGVkLmxlbmd0aCA9PT0gMTtcbn1cblxuZXhwb3J0IHsgbWF0Y2hlc1NlbGVjdG9yIH07Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUVBO0FBQ0E7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
