'use strict';

const EventEmitter = require('events');

class BaseServer extends EventEmitter {
  constructor(options) {
    super();

    this.sockets = new Set();
    this.channels = new Map();
    this.mounts = [];
  }

  attach() {
    throw new Error('Abstract method.');
  }

  mount() {}

  async open() {}

  async close() {}

  join() {
    return true;
  }

  leave() {
    return true;
  }

  channel() {
    return this.sockets;
  }

  to() {}

  all() {}

  static attach(parent, options) {
    const server = new this(options);
    return server.attach(parent);
  }

  static createServer(options) {
    return new this(options);
  }
}

module.exports = BaseServer;
