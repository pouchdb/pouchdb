import { clone } from 'pouchdb-utils';

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

export {
  massageSelector,
  isCombinationalField,
  getKey,
  getValue,
  getFieldFromDoc,
  setFieldInDoc,
  compare,
  parseField
};
