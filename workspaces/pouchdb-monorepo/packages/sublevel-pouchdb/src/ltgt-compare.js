export const ltgt = {};
export const compare = ltgt.compare = (a, b) => {

  if (Buffer.isBuffer(a)) {
    const l = Math.min(a.length, b.length);
    for (let i = 0; i < l; i++) {
      const cmp = a[i] - b[i];
      if (cmp)
        {return cmp;}
    }
    return a.length - b.length;
  }

  return a < b ? -1 : a > b ? 1 : 0;
};
// to be compatible with the current abstract-leveldown tests
// nullish or empty strings.
// I could use !!val but I want to permit numbers and booleans,
// if possible.
function isDef(val) {
  return val !== undefined && val !== '';
}
function has(range, name) {
  return Object.hasOwnProperty.call(range, name);
}
function hasKey(range, name) {
  return Object.hasOwnProperty.call(range, name) && name;
}
const lowerBoundKey = ltgt.lowerBoundKey = range => hasKey(range, 'gt')
  || hasKey(range, 'gte')
  || hasKey(range, 'min')
  || (range.reverse ? hasKey(range, 'end') : hasKey(range, 'start'))
  || undefined;
const lowerBound = ltgt.lowerBound = (range, def) => {
  const k = lowerBoundKey(range);
  return k ? range[k] : def;
};
const lowerBoundInclusive = ltgt.lowerBoundInclusive = range => has(range, 'gt') ? false : true;
const upperBoundInclusive = ltgt.upperBoundInclusive =
  range => (has(range, 'lt') /*&& !range.maxEx*/) ? false : true;
const lowerBoundExclusive = ltgt.lowerBoundExclusive =
  range => !lowerBoundInclusive(range);
const upperBoundExclusive = ltgt.upperBoundExclusive =
  range => !upperBoundInclusive(range);
const upperBoundKey = ltgt.upperBoundKey = range => hasKey(range, 'lt')
  || hasKey(range, 'lte')
  || hasKey(range, 'max')
  || (range.reverse ? hasKey(range, 'start') : hasKey(range, 'end'))
  || undefined;
const upperBound = ltgt.upperBound = (range, def) => {
  const k = upperBoundKey(range);
  return k ? range[k] : def;
};

export function start(range, def) {
  return range.reverse ? upperBound(range, def) : lowerBound(range, def);
}

export function end(range, def) {
  return range.reverse ? lowerBound(range, def) : upperBound(range, def);
}

export function startInclusive(range) {
  return range.reverse
    ? upperBoundInclusive(range)
    : lowerBoundInclusive(range);
}

export function endInclusive(range) {
  return range.reverse
    ? lowerBoundInclusive(range)
    : upperBoundInclusive(range);
}
function id(e) { return e; }

export const toLtgt = ltgt.toLtgt = function (range, _range = {}, map = id, lower, upper) {
  const defaults = arguments.length > 3;
  const lb = ltgt.lowerBoundKey(range);
  const ub = ltgt.upperBoundKey(range);
  if (lb) {
    if (lb === 'gt')
      {_range.gt = map(range.gt, false);}
    else
      {_range.gte = map(range[lb], false);}
  }
  else if (defaults)
    {_range.gte = map(lower, false);}

  if (ub) {
    if (ub === 'lt')
      {_range.lt = map(range.lt, true);}
    else
      {_range.lte = map(range[ub], true);}
  }
  else if (defaults)
    {_range.lte = map(upper, true);}

  if (range.reverse != null)
    {_range.reverse = !!range.reverse;}

  //if range was used mutably
  //(in level-sublevel it's part of an options object
  //that has more properties on it.)
  if (has(_range, 'max'))
    {delete _range.max;}
  if (has(_range, 'min'))
    {delete _range.min;}
  if (has(_range, 'start'))
    {delete _range.start;}
  if (has(_range, 'end'))
    {delete _range.end;}

  return _range;
};

export function contains(range, key, compare) {
  compare = compare || ltgt.compare;

  const lb = lowerBound(range);
  if (isDef(lb)) {
    const cmp = compare(key, lb);
    if (cmp < 0 || (cmp === 0 && lowerBoundExclusive(range)))
      {return false;}
  }

  const ub = upperBound(range);
  if (isDef(ub)) {
    const cmp = compare(key, ub);
    if (cmp > 0 || (cmp === 0) && upperBoundExclusive(range))
      {return false;}
  }

  return true;
}

export function filter(range, compare) {
  return key => ltgt.contains(range, key, compare);
}
