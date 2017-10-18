'use strict';

const assert = require('assert');
const URL = require('url');
const WebSocket = require('./backend').Client;
const BaseSocket = require('../base');
const Parser = require('./parser');

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
    const socket = this.socket;
    const url = URL.parse(socket.url);

    this.host = url.hostname;
    this.port = url.port >>> 0;

    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      this.connected = true;
      this.emit('open');
    };

    socket.onmessage = async (event) => {
      const data = await readBinary(event.data);
      this.parser.feed(data);
    };

    socket.onerror = (event) => {
      this.emit('error', new Error(event.message));
      this.destroy();
    };

    socket.onclose = (event) => {
      if (event.code < 1002) {
        this.destroy();
        return;
      }
      this.emit('error', new Error(event.reason));
      this.destroy();
    };
  }

  close() {
    this.socket.close();
  }

  send(packet) {
    this.socket.send(packet.frame());
  }

  connect(port, host, wss) {
    let protocol = 'ws';

    assert(typeof port === 'number', 'Must pass a port.');

    if (wss)
      protocol = 'wss';

    if (!host)
      host = 'localhost';

    assert(!this.socket);

    this.socket = new WebSocket(protocol + '://' + host + ':' + port);
    this.init();
  }

  static connect(port, host, wss) {
    const socket = new this();
    socket.connect(port, host, wss);
    return socket;
  }
}

/*
 * Helpers
 */

function readBinary(data) {
  return new Promise(function(resolve, reject) {
    if (!data || typeof data !== 'object') {
      reject(new Error('Bad data object.'));
      return;
    }

    if (Buffer.isBuffer(data)) {
      resolve(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      const result = Buffer.from(data);
      resolve(result);
      return;
    }

    if (data.buffer instanceof ArrayBuffer) {
      const result = Buffer.from(data.buffer);
      resolve(result);
      return;
    }

    if (typeof Blob !== 'undefined' && Blob) {
      if (data instanceof Blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = Buffer.from(reader.result);
          resolve(result);
        };
        reader.readAsArrayBuffer(data);
        return;
      }
    }

    reject(new Error('Bad data object.'));
  });
}

/*
 * Expose
 */

module.exports = Socket;
