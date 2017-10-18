'use strict';

const encoding = require('./encoding');
const BufferReader = require('./reader');
const StaticWriter = require('./writer');
const crc32 = require('./crc32');
const DUMMY = Buffer.alloc(0);

const types = {
  EVENT: 0,
  CALL: 1,
  ACK: 2,
  ERROR: 3,
  PING: 4,
  PONG: 5
};

class Header {
  constructor() {
    this.type = 0;
    this.size = 0;
    this.chk = 0;
  }

  fromRaw(data) {
    const br = new BufferReader(data);
    this.type = br.readU8();
    this.size = br.readU32();
    this.chk = br.readU32();
    return this;
  }

  static fromRaw(data) {
    return new this().fromRaw(data);
  }
}

class Packet {
  constructor() {
    this.type = 0;
    this.id = 0;
    this.event = '';
    this.payload = DUMMY;
    this.code = 0;
    this.msg = '';
  }

  fromRaw(type, data) {
    const br = new BufferReader(data);

    let id = -1;
    let event = null;
    let payload = null;
    let code = 0;
    let msg = '';
    let size = 0;

    switch (type) {
      case types.EVENT:
        size = br.readU8();
        event = br.readString('ascii', size);
        payload = br.readBytes(br.left());
        break;
      case types.CALL:
        size = br.readU8();
        event = br.readString('ascii', size);
        id = br.readU32();
        payload = br.readBytes(br.left());
        break;
      case types.ACK:
        id = br.readU32();
        payload = br.readBytes(br.left());
        break;
      case types.ERROR:
        id = br.readU32();
        code = br.readU8();
        size = br.readU8();
        msg = br.readString('ascii', size);
        break;
      case types.PING:
        payload = br.readBytes(8);
        break;
      case types.PONG:
        payload = br.readBytes(8);
        break;
      default:
        throw new Error('Unknown message type.');
    }

    if (br.left() > 0)
      throw new Error('Trailing data.');

    this.type = type;
    this.id = id;
    this.event = event;
    this.payload = payload;
    this.code = code;
    this.msg = msg;

    return this;
  }

  static fromRaw(type, data) {
    return new this().fromRaw(type, data);
  }

  getSize() {
    let size = 0;

    switch (this.type) {
      case types.EVENT:
        size += 1;
        size += this.event.length;
        size += this.payload.length;
        break;
      case types.CALL:
        size += 1;
        size += this.event.length;
        size += 4;
        size += this.payload.length;
        break;
      case types.ACK:
        size += 4;
        size += this.payload.length;
        break;
      case types.ERROR:
        size += 4;
        size += 1;
        size += 1;
        size += this.msg.length;
        break;
      case types.PING:
        size += 8;
        break;
      case types.PONG:
        size += 8;
        break;
      default:
        throw new Error('Unknown message type.');
    }

    return size;
  }

  frame() {
    const size = this.getSize();
    const bw = new StaticWriter(size + 9);

    bw.writeU8(this.type);
    bw.writeU32(size);
    bw.writeU32(0);

    switch (this.type) {
      case types.EVENT:
        bw.writeU8(this.event.length);
        bw.writeString(this.event, 'ascii');
        bw.writeBytes(this.payload);
        break;
      case types.CALL:
        bw.writeU8(this.event.length);
        bw.writeString(this.event, 'ascii');
        bw.writeU32(this.id);
        bw.writeBytes(this.payload);
        break;
      case types.ACK:
        bw.writeU32(this.id);
        bw.writeBytes(this.payload);
        break;
      case types.ERROR:
        bw.writeU32(this.id);
        bw.writeU8(this.code);
        bw.writeU8(this.msg.length);
        bw.writeString(this.msg, 'ascii');
        break;
      case types.PING:
        bw.writeBytes(this.payload);
        break;
      case types.PONG:
        bw.writeBytes(this.payload);
        break;
      default:
        throw new Error('Unknown message type.');
    }

    const data = bw.render();

    data.writeUInt32LE(crc32(data.slice(9)), 5, true);

    return data;
  }
}

Packet.types = types;

/*
 * Expose
 */

exports = Packet;
exports.Packet = Packet;
exports.Header = Header;

module.exports = exports;
