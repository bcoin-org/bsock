'use strict';

const Socket = require('./socket');
const BaseServer = require('../baseserver');

class Server extends BaseServer {
  constructor(options) {
    super();
  }

  attach(server) {
    server.on('connection', (socket) => {
      if (socket.remoteAddress) {
        const sock = new Socket(socket, this);
        this.emit('socket', sock);
      }
    });
    return this;
  }
}

module.exports = Server;
