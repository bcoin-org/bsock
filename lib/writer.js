/*!
 * writer.js - buffer writer for brpc
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/brpc
 */

'use strict';

const assert = require('assert');
const encoding = require('./encoding');

class StaticWriter {
  /**
   * Statically allocated buffer writer.
   * @constructor
   * @param {Number} size
   */

  constructor(size) {
    this.data = Buffer.allocUnsafe(size);
    this.written = 0;
  }

  render(keep) {
    const data = this.data;

    assert(this.written === data.length);

    if (!keep)
      this.destroy();

    return data;
  }

  getSize() {
    return this.written;
  }

  seek(offset) {
    this.written += offset;
  }

  destroy() {
    this.data = null;
    this.written = null;
  }

  writeU8(value) {
    this.written = this.data.writeUInt8(value, this.written, true);
  }

  writeU16(value) {
    this.written = this.data.writeUInt16LE(value, this.written, true);
  }

  writeU16BE(value) {
    this.written = this.data.writeUInt16BE(value, this.written, true);
  }

  writeU32(value) {
    this.written = this.data.writeUInt32LE(value, this.written, true);
  }

  writeU32BE(value) {
    this.written = this.data.writeUInt32BE(value, this.written, true);
  }

  writeI8(value) {
    this.written = this.data.writeInt8(value, this.written, true);
  }

  writeI16(value) {
    this.written = this.data.writeInt16LE(value, this.written, true);
  }

  writeI16BE(value) {
    this.written = this.data.writeInt16BE(value, this.written, true);
  }

  writeI32(value) {
    this.written = this.data.writeInt32LE(value, this.written, true);
  }

  writeI32BE(value) {
    this.written = this.data.writeInt32BE(value, this.written, true);
  }

  writeFloat(value) {
    this.written = this.data.writeFloatLE(value, this.written, true);
  }

  writeFloatBE(value) {
    this.written = this.data.writeFloatBE(value, this.written, true);
  }

  writeDouble(value) {
    this.written = this.data.writeDoubleLE(value, this.written, true);
  }

  writeDoubleBE(value) {
    this.written = this.data.writeDoubleBE(value, this.written, true);
  }

  writeVarint(value) {
    this.written = encoding.writeVarint(this.data, value, this.written);
  }

  writeBytes(value) {
    if (value.length === 0)
      return;

    value.copy(this.data, this.written);

    this.written += value.length;
  }

  writeVarBytes(value) {
    this.writeVarint(value.length);
    this.writeBytes(value);
  }

  copy(value, start, end) {
    const len = end - start;

    if (len === 0)
      return;

    value.copy(this.data, this.written, start, end);
    this.written += len;
  }

  writeString(value, enc) {
    if (value.length === 0)
      return;

    const size = Buffer.byteLength(value, enc);

    this.data.write(value, this.written, enc);

    this.written += size;
  }

  writeVarString(value, enc) {
    if (value.length === 0) {
      this.writeVarint(0);
      return;
    }

    const size = Buffer.byteLength(value, enc);

    this.writeVarint(size);
    this.data.write(value, this.written, enc);

    this.written += size;
  }

  fill(value, size) {
    assert(size >= 0);

    if (size === 0)
      return;

    this.data.fill(value, this.written, this.written + size);
    this.written += size;
  }
}

/*
 * Expose
 */

module.exports = StaticWriter;
