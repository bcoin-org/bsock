'use strict';

const assert = require('assert');
const net = require('net');
const Parser = require('./parser');
const BaseSocket = require('../base');

class Socket extends BaseSocket {
  /**
   * RPCSocket
   * @constructor
   * @ignore
   */

  constructor(socket) {
    super(socket);

    this.socket = socket || null;
    this.parser = new Parser();

    if (socket)
      this.init();
  }

  bind() {
    this.host = this.socket.remoteAddress;
    this.port = this.socket.remotePort;

    this.socket.on('connect', () => {
      this.host = this.socket.remoteAddress;
      this.port = this.socket.remotePort;
      this.connected = true;
      this.emit('open');
    });

    this.socket.on('data', (data) => {
      this.parser.feed(data);
    });

    this.socket.on('error', (err) => {
      this.emit('error', err);
      this.destroy();
    });

    this.socket.on('close', () => {
      this.destroy();
    });
  }

  close() {
    this.socket.destroy();
  }

  send(packet) {
    this.socket.write(packet.frame());
  }

  connect(port, host, wss) {
    assert(typeof port === 'number', 'Must pass a port.');
    assert(!wss, 'Cannot use wss.');

    assert(!this.socket);

    this.socket = net.connect(port, host);

    this.init();
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
