'use strict';

const assert = require('assert');
const net = require('net');
const Parser = require('./parser');
const BaseSocket = require('../basesocket');
const crc32 = require('../crc32');

class Socket extends BaseSocket {
  constructor(ws, server, url) {
    super(ws, server, url);

    this.parser = new Parser();

    if (ws)
      this.init();
  }

  bind() {
    this.host = this.ws.remoteAddress;
    this.port = this.ws.remotePort;

    this.ws.on('connect', () => {
      this.host = this.ws.remoteAddress;
      this.port = this.ws.remotePort;
      this.connected = true;
      this.emit('open');
    });

    this.ws.on('data', (data) => {
      this.parser.feed(data);
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
      this.destroy();
    });

    this.ws.on('close', () => {
      this.destroy();
    });
  }

  close() {
    this.ws.destroy();
  }

  send(frame) {
    const head = Buffer.allocUnsafe(9);
    if (frame.binary && this.binary) {
      const data = frame.toRaw();
      head.writeUInt32LE(data.length, 0, true);
      head.writeUInt32LE(crc32(data), 4, true);
      head[8] = 1;
      this.ws.write(head);
      this.ws.write(data);
    } else {
      const data = frame.toString();
      head.writeUInt32LE(data.length, 0, true);
      head.writeUInt32LE(0, 4, true);
      head[8] = 0;
      this.ws.write(head);
      this.ws.write(data, 'utf8');
    }
  }

  connect(port, host, wss) {
    assert((port & 0xffff) === port, 'Must pass a port.');
    assert(!wss, 'Cannot use wss.');
    assert(!this.ws, 'Cannot connect twice.');

    this.ws = net.connect(port, host);
    this.init();

    return this;
  }

  static connect(port, host, wss) {
    const socket = new this();
    socket.connect(port, host, wss);
    return socket;
  }
}

/*
 * Expose
 */

module.exports = Socket;
