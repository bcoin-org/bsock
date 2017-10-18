'use strict';

const EventEmitter = require('events');
const Socket = require('./socket');

class Server extends EventEmitter {
  constructor(options) {
    super();
  }

  attach(server) {
    server.on('connection', (socket) => {
      if (socket.remoteAddress) {
        const rpc = new Socket(socket);
        this.emit('socket', rpc);
      }
    });
    return this;
  }

  static attach(tcp, options) {
    const server = new this(options);
    return server.attach(tcp);
  }

  static createServer(options) {
    return new this(options);
  }
}

module.exports = Server;
