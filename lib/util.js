/*!
 * util.js - utils for brpc
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/brpc
 */

'use strict';

/**
 * @module utils/encoding
 */

const util = exports;

/**
 * Create a 64 bit nonce.
 * @returns {Buffer}
 */

util.nonce = function nonce() {
  const buf = Buffer.allocUnsafe(8);
  const a = (Math.random() * 0x100000000) >>> 0;
  const b = (Math.random() * 0x100000000) >>> 0;

  buf.writeUInt32LE(a, 0, true);
  buf.writeUInt32LE(b, 4, true);

  return buf;
};
