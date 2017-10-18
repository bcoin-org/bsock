'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const util = require('./util');
const Packet = require('./packet');
const DUMMY = Buffer.alloc(0);

class BaseSocket extends EventEmitter {
  /**
   * RPCBaseSocket
   * @constructor
   * @ignore
   */

  constructor(socket) {
    super();

    this.socket = null;
    this.parser = null;
    this.jobs = new Map();
    this.hooks = new Map();
    this.events = new EventEmitter();
    this.start = 0;
    this.sequence = 0;
    this.connected = false;
    this.destroyed = false;
    this.host = '0.0.0.0';
    this.port = 0;
  }

  init() {
    this.start = Date.now();

    this.bind();

    this.parser.on('error', (err) => {
      this.emit('error', err);
      this.destroy();
    });

    this.parser.on('message', async (packet) => {
      try {
        await this.handleMessage(packet);
      } catch (e) {
        this.emit('error', e);
        this.destroy();
      }
    });

    this.startStall();
  }

  bind() {
    throw new Error('Abstract method.');
  }

  close() {
    throw new Error('Abstract method.');
  }

  send(packet) {
    throw new Error('Abstract method.');
  }

  connect(port, host, wss) {
    throw new Error('Abstract method.');
  }

  startStall() {
    assert(this.timer == null);
    this.timer = setTimeout(this.maybeStall.bind(this), 5000);
  }

  stopStall() {
    assert(this.timer != null);
    clearTimeout(this.timer);
    this.timer = null;
  }

  maybeStall() {
    const now = Date.now();

    if (!this.connected) {
      if (now - this.start > 10000) {
        this.error('Timed out waiting for connection.');
        this.destroy();
        return;
      }
      return;
    }

    for (const [id, job] of this.jobs) {
      if (now - job.ts > 10000) {
        this.jobs.delete(id);
        job.reject(new Error('Job timed out.'));
      }
    }

    if (!this.challenge) {
      this.challenge = util.nonce();
      this.lastPing = now;
      this.sendPing(this.challenge);
      return;
    }

    if (now - this.lastPing > 30000) {
      this.error('Connection is stalling (ping).');
      this.destroy();
      return;
    }
  }

  error(msg) {
    if (!(msg instanceof Error))
      msg = new Error(msg + '');

    this.emit('error', msg);
  }

  destroy() {
    if (this.destroyed)
      return;

    this.close();
    this.stopStall();

    this.connected = false;
    this.challenge = null;
    this.destroyed = true;

    for (const [id, job] of this.jobs) {
      job.reject(new Error('Socket was destroyed.'));
      this.jobs.delete(id);
    }

    this.emit('close');
  }

  async handleMessage(packet) {
    switch (packet.type) {
      case Packet.types.EVENT:
        return this.handleEvent(packet.event, packet.payload);
      case Packet.types.CALL:
        return this.handleCall(packet.id, packet.event, packet.payload);
      case Packet.types.ACK:
        return this.handleAck(packet.id, packet.payload);
      case Packet.types.ERROR:
        return this.handleError(packet.id, packet.code, packet.msg);
      case Packet.types.PING:
        return this.handlePing(packet.payload);
      case Packet.types.PONG:
        return this.handlePong(packet.payload);
      default:
        throw new Error('Unknown packet.');
    }
  }

  handleEvent(event, data) {
    this.events.emit(event, data);
  }

  async handleCall(id, event, data) {
    const hook = this.hooks.get(event);

    if (!hook)
      throw new Error('Call not found: ' + event + '.');

    let result;
    try {
      result = await hook(data);
    } catch (e) {
      this.sendError(id, e.code | 0, String(e.message));
      return;
    }

    if (result == null)
      result = DUMMY;

    assert(Buffer.isBuffer(result));

    this.sendAck(id, result);
  }

  handleAck(id, data) {
    const job = this.jobs.get(id);

    if (!job)
      throw new Error('Job not found for ' + id + '.');

    this.jobs.delete(id);

    job.resolve(data);
  }

  handleError(id, code, msg) {
    const job = this.jobs.get(id);

    if (!job)
      throw new Error('Job not found for ' + id + '.');

    this.jobs.delete(id);

    const err = new Error(msg);
    err.code = code;

    job.reject(err);
  }

  handlePing(nonce) {
    this.sendPong(nonce);
  }

  handlePong(nonce) {
    if (!this.challenge || nonce.compare(this.challenge) !== 0) {
      this.error('Remote node sent bad pong.');
      this.destroy();
      return;
    }
    this.challenge = null;
  }

  sendEvent(event, data) {
    const packet = new Packet();
    packet.type = Packet.types.EVENT;
    packet.event = event;
    packet.payload = data;
    this.send(packet);
  }

  sendCall(id, event, data) {
    const packet = new Packet();
    packet.type = Packet.types.CALL;
    packet.id = id;
    packet.event = event;
    packet.payload = data;
    this.send(packet);
  }

  sendAck(id, data) {
    const packet = new Packet();
    packet.type = Packet.types.ACK;
    packet.id = id;
    packet.payload = data;
    this.send(packet);
  }

  sendError(id, code, msg) {
    const packet = new Packet();
    packet.type = Packet.types.ERROR;
    packet.id = id;
    packet.msg = msg;
    packet.code = code;
    this.send(packet);
  }

  sendPing(nonce) {
    const packet = new Packet();
    packet.type = Packet.types.PING;
    packet.payload = nonce;
    this.send(packet);
  }

  sendPong(nonce) {
    const packet = new Packet();
    packet.type = Packet.types.PONG;
    packet.payload = nonce;
    this.send(packet);
  }

  fire(event, data) {
    if (data == null)
      data = DUMMY;

    assert(typeof event === 'string', 'Event must be a string.');
    assert(Buffer.isBuffer(data), 'Data must be a buffer.');

    this.sendEvent(event, data);
  }

  call(event, data) {
    if (data == null)
      data = DUMMY;

    assert(typeof event === 'string', 'Event must be a string.');
    assert(Buffer.isBuffer(data), 'Data must be a buffer.');

    const id = this.sequence;

    if (++this.sequence === 0x100000000)
      this.sequence = 0;

    this.sendCall(id, event, data);

    assert(!this.jobs.has(id), 'ID collision.');

    return new Promise((resolve, reject) => {
      this.jobs.set(id, new Job(resolve, reject, Date.now()));
    });
  }

  listen(event, handler) {
    assert(typeof event === 'string', 'Event must be a string.');
    assert(typeof handler === 'function', 'Handler must be a function.');
    this.events.on(event, handler);
  }

  hook(event, handler) {
    assert(typeof event === 'string', 'Event must be a string.');
    assert(typeof handler === 'function', 'Handler must be a function.');
    assert(!this.hooks.has(event), 'Hook already bound.');
    this.hooks.set(event, handler);
  }

  static connect(port, host, wss) {
    throw new Error('Abstract method.');
  }
}

/*
 * Helpers
 */

class Job {
  constructor(resolve, reject, ts) {
    this.resolve = resolve;
    this.reject = reject;
    this.ts = ts;
  }
}

/*
 * Expose
 */

module.exports = BaseSocket;
