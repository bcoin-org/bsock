/*!
 * parser.js - packet parser for brpc
 * Copyright (c) 2017, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/brpc
 */

'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('../util');
var crc32 = require('../crc32');
var Packet = require('../packet');
var Header = Packet.Header;

/**
 * Protocol packet parser
 * @constructor
 * @emits Parser#error
 * @emits Parser#packet
 */

function Parser(network) {
  if (!(this instanceof Parser))
    return new Parser(network);

  EventEmitter.call(this);

  this.pending = [];
  this.total = 0;
  this.waiting = 9;
  this.header = null;
}

util.inherits(Parser, EventEmitter);

/**
 * Max message size.
 * @const {Number}
 * @default
 */

Parser.MAX_MESSAGE = 10000000;

/**
 * Emit an error.
 * @private
 * @param {String} msg
 */

Parser.prototype.error = function error(msg) {
  this.emit('error', new Error(msg));
};

/**
 * Feed data to the parser.
 * @param {Buffer} data
 */

Parser.prototype.feed = function feed(data) {
  var chunk, off, len;

  this.total += data.length;
  this.pending.push(data);

  while (this.total >= this.waiting) {
    chunk = Buffer.allocUnsafe(this.waiting);
    off = 0;
    len = 0;

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
};

/**
 * Parse a fully-buffered chunk.
 * @param {Buffer} chunk
 */

Parser.prototype.parse = function parse(data) {
  var header = this.header;
  var packet;

  assert(data.length <= Parser.MAX_MESSAGE);

  if (!this.header) {
    this.header = Header.fromRaw(data);
    this.waiting = this.header.size;
    if (this.waiting > Parser.MAX_MESSAGE) {
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

  try {
    packet = Packet.fromRaw(header.type, data);
  } catch (e) {
    this.emit('error', e);
    return;
  }

  this.emit('message', packet);
};

/*
 * Expose
 */

module.exports = Parser;
