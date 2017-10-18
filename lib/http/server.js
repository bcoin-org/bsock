'use strict';

const EventEmitter = require('events');
const WebSocket = require('faye-websocket');
const Socket = require('./socket');

class Server extends EventEmitter {
  constructor(options) {
    super();
  }

  attach(server) {
    server.on('upgrade', (request, socket, body) => {
      if (WebSocket.isWebSocket(request)) {
        const ws = new WebSocket(request, socket, body);
        const rpc = new Socket(ws);
        this.emit('socket', rpc);
      }
    });
    return this;
  }

  static attach(http, options) {
    var server = new this(options);
    return server.attach(http);
  }

  static createServer(options) {
    return new this(options);
  }
}

module.exports = Server;
