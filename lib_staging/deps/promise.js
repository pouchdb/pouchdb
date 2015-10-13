import lie from 'lie';

export default typeof Promise === 'function' ? Promise : lie;
