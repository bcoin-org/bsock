/*!
 * parser.js - packet parser for brpc
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/brpc
 */

'use strict';

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
    let header = null;
    let packet = null;

    try {
      header = Header.fromRaw(data);
      if (header.size > MAX_MESSAGE) {
        this.error('Packet too large.');
        return;
      }
      data = data.slice(9);
      packet = Packet.fromRaw(header.type, data);
    } catch (e) {
      this.emit('error', e);
      return;
    }

    if (header.chk !== crc32(data)) {
      this.error('Checksum mismatch.');
      return;
    }

    this.emit('message', packet);
  }
}

/*
 * Expose
 */

module.exports = Parser;
