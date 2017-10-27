'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const UWS = require('uws');
const UWSClient = UWS;
const UWSServer = UWSClient.Server;

let server = null;

// Make UWS look like Faye.
class API extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.binaryType = 'arraybuffer';
    this.readable = true;
    this.writable = true;
    this.protocol = '';
    this.url = '';
    this.version = 0;
    this.onopen = () => {};
    this.onclose = () => {};
    this.onerror = () => {};
    this.onmessage = () => {};
    this.onping = () => {};
    this.onpong = () => {};
    this.on('error', () => {});
  }

  _open(ws, outbound) {
    assert(ws);

    this.ws = ws;

    if (outbound) {
      ws.onopen = () => {
        this.onopen();
        this.emit('open');
      };
    }

    ws.onclose = ({code, reason}) => {
      const event = {
        code: Number(code),
        reason: String(reason)
      };
      this.onclose(event);
      this.emit('close', event);
    };

    ws.onerror = ({message}) => {
      if (message === 'uWs client connection error')
        message = `Network error: ${this.url}: connect ECONNREFUSED`;

      const event = {
        message: String(message)
      };

      this.onerror(event);
      this.emit('error', event);
    };

    ws.onmessage = ({data}) => {
      // UWS is zero copy.
      if (typeof data !== 'string') {
        assert(data instanceof ArrayBuffer);
        const ab = Buffer.from(data);
        data = Buffer.allocUnsafe(ab.length);
        ab.copy(data, 0);
      }

      const event = { data };

      this.onmessage(event);
      this.emit('message', event);
    };

    ws.onping = () => {
      this.onping();
      this.emit('ping');
    };

    ws.onpong = () => {
      this.onpong();
      this.emit('pong');
    };
  }

  write(data) {
    return this.send(data);
  }

  end(data) {
    if (data !== undefined)
      this.write(data);
    this.close();
  }

  pause() {
    ;
  }

  resume() {
    ;
  }

  send(data) {
    if (!this.ws)
      return;

    this.ws.send(data);

    return true;
  }

  get readyState() {
    if (!this.ws)
      return API.CONNECTING;

    return this.ws.readyState;
  }

  ping(msg, callback) {
    if (!this.ws)
      return;

    if (this.readyState > API.OPEN)
      return false;

    this.ws.ping(msg);

    if (callback)
      callback();

    return true;
  }

  close() {
    if (!this.ws)
      return;

    this.ws.close();
  }

  static isWebSocket(req) {
    if (!req)
      return false;

    const key = req.headers['sec-websocket-key'];

    if (key == null)
      return false;

    return key.length === 24;
  }
}

API.CONNECTING = 0;
API.OPEN = 1;
API.CLOSING = 2;
API.CLOSED = 3;
API.CLOSE_TIMEOUT = 3000;

class Client extends API {
  constructor(url) {
    super();

    assert(typeof url === 'string');

    url = url.replace(/^http:/, 'ws:');
    url = url.replace(/^https:/, 'wss:');

    if (url.indexOf('://') === -1)
      url = `ws://${url}`;

    url = url.replace('://localhost', '://127.0.0.1');

    this.url = url;
    this._open(new UWSClient(url), true);
  }
}

class WebSocket extends API {
  constructor(req, socket, body) {
    super();

    assert(req && socket && body);

    this.url = req.url;

    if (!server)
      server = new UWSServer({ noServer: true });

    server.handleUpgrade(req, socket, body, (ws) => {
      setImmediate(() => {
        this._open(ws, false);
        this.onopen();
        this.emit('open');
      });
    });
  }
}

WebSocket.Client = Client;

module.exports = WebSocket;
