/*!
 * reader.js - buffer reader for brpc
 * Copyright (c) 2014-2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/brpc
 */

'use strict';

const assert = require('assert');
const encoding = require('./encoding');

class BufferReader {
  constructor(data, zeroCopy) {
    assert(Buffer.isBuffer(data), 'Must pass a Buffer.');

    this.data = data;
    this.offset = 0;
    this.zeroCopy = zeroCopy || false;
  }

  getSize() {
    return this.data.length;
  }

  left() {
    assert(this.offset <= this.data.length);
    return this.data.length - this.offset;
  }

  seek(off) {
    assert(this.offset + off >= 0);
    assert(this.offset + off <= this.data.length);
    this.offset += off;
    return off;
  }

  readU8() {
    assert(this.offset + 1 <= this.data.length);
    const ret = this.data[this.offset];
    this.offset += 1;
    return ret;
  }

  readU16() {
    assert(this.offset + 2 <= this.data.length);
    const ret = this.data.readUInt16LE(this.offset, true);
    this.offset += 2;
    return ret;
  }

  readU16BE() {
    assert(this.offset + 2 <= this.data.length);
    const ret = this.data.readUInt16BE(this.offset, true);
    this.offset += 2;
    return ret;
  }

  readU32() {
    assert(this.offset + 4 <= this.data.length);
    const ret = this.data.readUInt32LE(this.offset, true);
    this.offset += 4;
    return ret;
  }

  readU32BE() {
    assert(this.offset + 4 <= this.data.length);
    const ret = this.data.readUInt32BE(this.offset, true);
    this.offset += 4;
    return ret;
  }

  readI8() {
    assert(this.offset + 1 <= this.data.length);
    const ret = this.data.readInt8(this.offset, true);
    this.offset += 1;
    return ret;
  }

  readI16() {
    assert(this.offset + 2 <= this.data.length);
    const ret = this.data.readInt16LE(this.offset, true);
    this.offset += 2;
    return ret;
  }

  readI16BE() {
    assert(this.offset + 2 <= this.data.length);
    const ret = this.data.readInt16BE(this.offset, true);
    this.offset += 2;
    return ret;
  }

  readI32() {
    assert(this.offset + 4 <= this.data.length);
    const ret = this.data.readInt32LE(this.offset, true);
    this.offset += 4;
    return ret;
  }

  readI32BE() {
    assert(this.offset + 4 <= this.data.length);
    const ret = this.data.readInt32BE(this.offset, true);
    this.offset += 4;
    return ret;
  }

  readFloat() {
    assert(this.offset + 4 <= this.data.length);
    const ret = this.data.readFloatLE(this.offset, true);
    this.offset += 4;
    return ret;
  }

  readFloatBE() {
    assert(this.offset + 4 <= this.data.length);
    const ret = this.data.readFloatBE(this.offset, true);
    this.offset += 4;
    return ret;
  }

  readDouble() {
    assert(this.offset + 8 <= this.data.length);
    const ret = this.data.readDoubleLE(this.offset, true);
    this.offset += 8;
    return ret;
  }

  readDoubleBE() {
    assert(this.offset + 8 <= this.data.length);
    const ret = this.data.readDoubleBE(this.offset, true);
    this.offset += 8;
    return ret;
  }

  readVarint() {
    const result = encoding.readVarint(this.data, this.offset);
    this.offset += result.size;
    return result.value;
  }

  skipVarint() {
    const size = encoding.skipVarint(this.data, this.offset);
    assert(this.offset + size <= this.data.length);
    this.offset += size;
  }

  readBytes(size, zeroCopy) {
    assert(size >= 0);
    assert(this.offset + size <= this.data.length);

    let ret;
    if (this.zeroCopy || zeroCopy) {
      ret = this.data.slice(this.offset, this.offset + size);
    } else {
      ret = Buffer.allocUnsafe(size);
      this.data.copy(ret, 0, this.offset, this.offset + size);
    }

    this.offset += size;

    return ret;
  }

  readVarBytes(zeroCopy) {
    return this.readBytes(this.readVarint(), zeroCopy);
  }

  readString(enc, size) {
    assert(size >= 0);
    assert(this.offset + size <= this.data.length);
    const ret = this.data.toString(enc, this.offset, this.offset + size);
    this.offset += size;
    return ret;
  }

  readVarString(enc, limit) {
    const size = this.readVarint();
    assert(!limit || size <= limit, 'String exceeds limit.');
    return this.readString(enc, size);
  }
}

/*
 * Expose
 */

module.exports = BufferReader;
