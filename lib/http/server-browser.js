'use strict';

const BaseServer = require('../baseserver');

class Server extends BaseServer {
  constructor(options) {
    super();
  }

  attach() {
    return this;
  }
}

module.exports = Server;
