'use strict';

/* global Blob, FileReader */

const assert = require('assert');
const URL = require('url');
const util = require('../util');
const BaseSocket = require('../basesocket');
const WebSocket = require('./backend').Client;
const Parser = require('./parser');

// https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
const codes = {
  1000: 'NORMAL_CLOSURE',
  1001: 'GOING_AWAY',
  1002: 'PROTOCOL_ERROR',
  1003: 'UNSUPPORTED_DATA',
  1004: 'RESERVED',
  1005: 'NO_STATUS_RECVD',
  1006: 'ABNORMAL_CLOSURE',
  1007: 'INVALID_FRAME_PAYLOAD_DATA',
  1008: 'POLICY_VIOLATION',
  1009: 'MESSAGE_TOO_BIG',
  1010: 'MISSING_EXTENSION',
  1011: 'INTERNAL_ERROR',
  1012: 'SERVICE_RESTART',
  1013: 'TRY_AGAIN_LATER',
  1014: 'BAD_GATEWAY',
  1015: 'TLS_HANDSHAKE'
};

class Socket extends BaseSocket {
  constructor(ws, server, url) {
    super(ws, server, url);

    this.parser = new Parser();
    this.binary = this.url.indexOf('b64=1') === -1;

    if (ws)
      this.init();
  }

  bind() {
    const ws = this.ws;
    const url = URL.parse(ws.url);

    this.host = url.hostname;
    this.port = url.port >>> 0;

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      this.connected = true;
      this.emit('open');
    };

    ws.onmessage = async (event) => {
      let data;

      try {
        data = await readBinary(event.data);
      } catch (e) {
        this.emit('error', e);
        return;
      }

      // Textual frame.
      if (typeof data === 'string') {
        this.parser.feedString(data);
        return;
      }

      // Binary frame.
      this.parser.feedBinary(data);
    };

    ws.onerror = (event) => {
      this.emit('error', new Error(event.message));
      this.destroy();
    };

    ws.onclose = (event) => {
      if (event.code === 1000 || event.code === 1001) {
        this.destroy();
        return;
      }

      const code = codes[event.code] || 'UNKNOWN_CODE';
      const reason = event.reason || 'Unknown reason.';
      const msg = `Websocket Closed: ${reason} (code=${code}).`;

      const err = new Error(msg);
      err.code = code;

      this.emit('error', err);
      this.destroy();
    };
  }

  close() {
    this.ws.close();
  }

  send(frame) {
    if (frame.binary && this.binary)
      this.ws.send(frame.toRaw());
    else
      this.ws.send(frame.toString());
  }

  connect(port, host, wss) {
    if (typeof port === 'string')
      [port, host, wss] = util.parseURL(port);

    let protocol = 'ws';

    assert((port & 0xffff) === port, 'Must pass a port.');
    assert(!this.ws, 'Cannot connect twice.');

    if (wss)
      protocol = 'wss';

    if (!host)
      host = 'localhost';

    if (host.indexOf(':') !== -1 && host[0] !== '[')
      host = `[${host}]`;

    const path = '/socket.io';
    const qs = '?transport=websocket';

    this.url = `${protocol}://${host}:${port}${path}/${qs}`;
    this.ws = new WebSocket(this.url);

    this.init();

    return this;
  }

  static connect(port, host, wss) {
    return new this().connect(port, host, wss);
  }
}

/*
 * Helpers
 */

function readBinary(data) {
  return new Promise((resolve, reject) => {
    if (typeof data === 'string') {
      resolve(data);
      return;
    }

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
