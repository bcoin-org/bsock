/*!
 * parser.js - packet parser for brpc
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/brpc
 */

'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const crc32 = require('../crc32');
const Packet = require('../packet');
const Header = Packet.Header;

const MAX_MESSAGE = 10000000;

class Parser extends EventEmitter {
  /**
   * Protocol packet parser
   * @constructor
   * @emits Parser#error
   * @emits Parser#packet
   */

  constructor(network) {
    super();

    this.pending = [];
    this.total = 0;
    this.waiting = 9;
    this.header = null;
  }

  /**
   * Emit an error.
   * @private
   * @param {String} msg
   */

  error(msg) {
    this.emit('error', new Error(msg));
  }

  /**
   * Feed data to the parser.
   * @param {Buffer} data
   */

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

  /**
   * Parse a fully-buffered chunk.
   * @param {Buffer} chunk
   */

  parse(data) {
    const header = this.header;

    assert(data.length <= MAX_MESSAGE);

    if (!this.header) {
      this.header = Header.fromRaw(data);
      this.waiting = this.header.size;
      if (this.waiting > MAX_MESSAGE) {
        this.waiting = 9;
        this.error('Packet too large.');
        return;
      }
      return;
    }

    this.waiting = 9;
    this.header = null;

    if (header.chk !== crc32(data)) {
      this.error('Checksum mismatch.');
      return;
    }

    let packet;
    try {
      packet = Packet.fromRaw(header.type, data);
    } catch (e) {
      this.emit('error', e);
      return;
    }

    this.emit('message', packet);
  }
}

/*
 * Expose
 */

module.exports = Parser;
