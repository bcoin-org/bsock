'use strict';

const WebSocket = require('faye-websocket');
const Socket = require('./socket');
const BaseServer = require('../baseserver');

class Server extends BaseServer {
  constructor(options) {
    super();
  }

  attach(server) {
    server.on('upgrade', (request, socket, body) => {
      if (WebSocket.isWebSocket(request)) {
        const {url} = request;
        const ws = new WebSocket(request, socket, body);
        const sock = new Socket(ws, this, url);
        this.handleSocket(sock);
      }
    });
    return this;
  }
}

module.exports = Server;
