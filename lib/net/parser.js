/*!
 * parser.js - packet parser
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/chjj
 */

'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const crc32 = require('../crc32');
const Frame = require('../frame');

const MAX_MESSAGE = 100000000;

class Parser extends EventEmitter {
  constructor() {
    super();

    this.pending = [];
    this.total = 0;
    this.waiting = 9;
    this.header = null;
  }

  error(msg) {
    this.emit('error', new Error(msg));
  }

  feed(data) {
    this.total += data.length;
    this.pending.push(data);

    while (this.total >= this.waiting) {
      const chunk = Buffer.allocUnsafe(this.waiting);

      let off = 0;
      let len = 0;

      while (off < chunk.length) {
        len = this.pending[0].copy(chunk, off);
        if (len === this.pending[0].length)
          this.pending.shift();
        else
          this.pending[0] = this.pending[0].slice(len);
        off += len;
      }

      assert.equal(off, chunk.length);

      this.total -= chunk.length;
      this.parse(chunk);
    }
  }

  parse(data) {
    const header = this.header;

    assert(data.length <= MAX_MESSAGE);

    if (!this.header) {
      this.header = Header.fromRaw(data);
      this.waiting = this.header.size;
      if (this.waiting > MAX_MESSAGE) {
        this.waiting = 9;
        this.error('Frame too large.');
        return;
      }
      return;
    }

    this.waiting = 9;
    this.header = null;

    if (header.binary) {
      if (header.checksum !== crc32(data)) {
        this.error('Checksum mismatch.');
        return;
      }
    }

    let frame;

    try {
      if (header.binary) {
        frame = Frame.fromRaw(data);
      } else {
        data = data.toString('utf8');
        frame = Frame.fromString(data);
      }
    } catch (e) {
      this.emit('error', e);
      return;
    }

    this.emit('frame', frame);
  }
}

class Header {
  constructor(size, checksum, binary) {
    this.size = size || 0;
    this.checksum = checksum || 0;
    this.binary = binary || false;
  }
  static fromRaw(data) {
    assert(Buffer.isBuffer(data));
    assert(data.length === 9);
    const size = data.readUInt32LE(0, true);
    const checksum = data.readUInt32LE(4, true);
    const binary = data[8] !== 0;
    return new this(size, checksum, binary);
  }
  toRaw() {
    const data = Buffer.allocUnsafe(9);
    data.writeUInt32LE(this.size, 0, true);
    data.writeUInt32LE(this.checksum, 4, true);
    data[8] = this.binary ? 1 : 0;
    return data;
  }
}

/*
 * Expose
 */

module.exports = Parser;
