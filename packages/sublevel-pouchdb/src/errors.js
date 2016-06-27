/* Copyright (c) 2012-2014 LevelUP contributors
 * See list at <https://github.com/rvagg/node-levelup#contributing>
 * MIT License
 * <https://github.com/rvagg/node-levelup/blob/master/LICENSE.md>
 */

import errno from 'errno';
var createError   = errno.create;
var LevelUPError  = createError('LevelUPError');
var NotFoundError = createError('NotFoundError', LevelUPError);

NotFoundError.prototype.notFound = true;
NotFoundError.prototype.status   = 404;

var InitializationError = createError('InitializationError', LevelUPError);
var OpenError           = createError('OpenError', LevelUPError);
var ReadError           = createError('ReadError', LevelUPError);
var WriteError          = createError('WriteError', LevelUPError);
var EncodingError       = createError('EncodingError', LevelUPError);

export {
  LevelUPError,
  InitializationError,
  OpenError,
  ReadError,
  WriteError,
  NotFoundError,
  EncodingError
};