'use strict';

const assert = require('assert');
const EventEmitter = require('events');
const Packet = require('./packet');
const Frame = require('./frame');

const blacklist = {
  connect: true,
  connect_error: true,
  connect_timeout: true,
  connecting: true,
  disconnect: true,
  error: true,
  reconnect: true,
  reconnect_attempt: true,
  reconnect_failed: true,
  reconnect_error: true,
  reconnecting: true,
  ping: true,
  pong: true
};

class BaseSocket extends EventEmitter {
  constructor(ws, server, url) {
    super();

    this.ws = ws || null;
    this.server = server || null;
    this.url = url || 'ws://localhost';
    this.parser = null;
    this.binary = true;
    this.packet = null;
    this.jobs = new Map();
    this.hooks = new Map();
    this.channels = new Set();
    this.events = new EventEmitter();
    this.start = 0;
    this.sequence = 0;
    this.connected = false;
    this.destroyed = false;
    this.host = '0.0.0.0';
    this.port = 0;
    this.lastPing = 0;

    this.pingInterval = 25000;
    this.pingTimeout = 60000;
  }

  init() {
    this.start = Date.now();

    this.bind();

    this.parser.on('error', (err) => {
      this.emit('error', err);
      this.destroy();
    });

    this.parser.on('frame', async (frame) => {
      try {
        await this.handleFrame(frame);
      } catch (e) {
        this.emit('error', e);
        this.destroy();
      }
    });

    this.on('open', () => {
      this.sendHandshake();
      this.sendConnect();
    });

    this.startStall();
  }

  bind() {
    throw new Error('Abstract method.');
  }

  close() {
    throw new Error('Abstract method.');
  }

  send(frame) {
    throw new Error('Abstract method.');
  }

  connect(port, host, wss) {
    throw new Error('Abstract method.');
  }

  startStall() {
    assert(this.timer == null);
    this.timer = setTimeout(() => this.maybeStall(), 5000);
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
      if (now - job.time > 10000) {
        this.jobs.delete(id);
        job.reject(new Error('Job timed out.'));
      }
    }

    if (!this.challenge) {
      this.challenge = true;
      this.lastPing = now;
      this.sendPing();
      return;
    }

    if (now - this.lastPing > this.pingTimeout) {
      this.error('Connection is stalling (ping).');
      this.destroy();
      return;
    }
  }

  error(msg) {
    this.emit('error', new Error(msg));
  }

  destroy() {
    if (this.destroyed)
      return;

    this.close();
    this.stopStall();

    this.connected = false;
    this.challenge = false;
    this.destroyed = true;
    this.lastPing = 0;

    for (const [id, job] of this.jobs) {
      job.reject(new Error('Socket was destroyed.'));
      this.jobs.delete(id);
    }

    this.emit('close');
  }

  /*
   * Frames
   */

  async handleFrame(frame) {
    switch (frame.type) {
      case Frame.types.OPEN:
        return this.handleOpen(frame);
      case Frame.types.CLOSE:
        return this.handleClose(frame);
      case Frame.types.PING:
        return this.handlePing(frame);
      case Frame.types.PONG:
        return this.handlePong(frame);
      case Frame.types.MESSAGE:
        return this.handleMessage(frame);
      case Frame.types.UPGRADE:
        return this.handleUpgrade(frame);
      case Frame.types.NOOP:
        return this.handleNoop(frame);
      default: {
        throw new Error('Unknown frame.');
      }
    }
  }

  async handleOpen(frame) {
    if (frame.binary)
      throw new Error('Received a binary open frame.');

    const json = JSON.parse(frame.data);

    enforce(json && typeof json === 'object', 'open', 'object');

    const {pingInterval, pingTimeout} = json;

    enforce((pingInterval >>> 0) === pingInterval, 'interval', 'uint32');
    enforce((pingTimeout >>> 0) === pingTimeout, 'timeout', 'uint32');

    this.pingInterval = pingInterval;
    this.pingTimeout = pingTimeout;
  }

  async handleClose(frame) {
    ;
  }

  async handlePing() {
    this.sendPong();
  }

  async handlePong() {
    if (!this.challenge) {
      this.error('Remote node sent bad pong.');
      this.destroy();
      return;
    }
    this.challenge = false;
  }

  async handleMessage(frame) {
    if (this.packet) {
      const packet = this.packet;

      if (!frame.binary)
        throw new Error('Received non-binary frame as attachment.');

      packet.buffers.push(frame.data);

      if (packet.buffers.length === packet.attachments) {
        this.packet = null;
        return this.handlePacket(packet);
      }

      return undefined;
    }

    if (frame.binary)
      throw new Error('Received binary frame as a message.');

    const packet = Packet.fromString(frame.data);

    if (packet.attachments > 0) {
      this.packet = packet;
      return undefined;
    }

    return this.handlePacket(packet);
  }

  async handleUpgrade(frame) {
    throw new Error('Cannot upgrade from websocket.');
  }

  async handleNoop(frame) {
    ;
  }

  sendFrame(type, data, binary) {
    this.send(new Frame(type, data, binary));
  }

  sendOpen(data) {
    this.sendFrame(Frame.types.OPEN, data, false);
  }

  sendClose(data) {
    this.sendFrame(Frame.types.CLOSE, data, false);
  }

  sendPing(data) {
    this.sendFrame(Frame.types.PING, data, false);
  }

  sendPong(data) {
    this.sendFrame(Frame.types.PONG, data, false);
  }

  sendMessage(data) {
    this.sendFrame(Frame.types.MESSAGE, data, false);
  }

  sendBinary(data) {
    this.sendFrame(Frame.types.MESSAGE, data, true);
  }

  sendHandshake() {
    const handshake = JSON.stringify({
      sid: '00000000000000000000',
      upgrades: [],
      pingInterval: this.pingInterval,
      pingTimeout: this.pingTimeout
    });

    this.sendOpen(handshake);
  }

  /*
   * Packets
   */

  async handlePacket(packet) {
    switch (packet.type) {
      case Packet.types.CONNECT: {
        return this.handleConnect();
      }
      case Packet.types.DISCONNECT: {
        return this.handleDisconnect();
      }
      case Packet.types.EVENT:
      case Packet.types.BINARY_EVENT: {
        const args = packet.getData();

        enforce(Array.isArray(args), 'args', 'array');
        enforce(args.length > 0, 'args', 'array');
        enforce(typeof args[0] === 'string', 'event', 'string');

        if (packet.id !== -1)
          return this.handleCall(packet.id, args);

        return this.handleEvent(args);
      }
      case Packet.types.ACK:
      case Packet.types.BINARY_ACK: {
        enforce(packet.id !== -1, 'id', 'uint32');

        const json = packet.getData();

        enforce(json == null || Array.isArray(json), 'args', 'array');

        let err = null;
        let result = null;

        if (json && json.length > 0)
          err = json[0];

        if (json && json.length > 1)
          result = json[1];

        if (result == null)
          result = null;

        if (err) {
          enforce(typeof err === 'object', 'error', 'object');
          return this.handleError(packet.id, err);
        }

        return this.handleAck(packet.id, result);
      }
      case Packet.types.ERROR: {
        const err = packet.getData();
        enforce(err && typeof err === 'object', 'error', 'object');
        return this.handleError(-1, err);
      }
      default: {
        throw new Error('Unknown packet.');
      }
    }
  }

  async handleConnect() {
    ;
  }

  async handleDisconnect() {
    ;
  }

  async handleEvent(args) {
    const event = args[0];
    try {
      if (blacklist[event])
        throw new Error(`Cannot emit blacklisted event: ${event}.`);
      this.events.emit(...args);
    } catch (e) {
      this.sendError(-1, e);
    }
  }

  async handleCall(id, args) {
    const event = args[0];
    const arg = args.slice(1);
    const handler = this.hooks.get(event);

    if (!handler)
      throw new Error(`Call not found: ${event}.`);

    let result;
    try {
      result = await handler(...arg);
    } catch (e) {
      this.sendError(id, e);
      return;
    }

    if (result == null)
      result = null;

    this.sendAck(id, result);
  }

  async handleAck(id, data) {
    const job = this.jobs.get(id);

    if (!job)
      throw new Error(`Job not found for ${id}.`);

    this.jobs.delete(id);

    job.resolve(data);
  }

  async handleError(id, err) {
    const msg = castMsg(err.message);
    const code = castCode(err.code);
    const type = castType(err.type);

    if (id === -1) {
      const e = new Error(msg);
      e.code = code;
      e.type = type;
      this.emit('error', e);
      return;
    }

    const job = this.jobs.get(id);

    if (!job)
      throw new Error(`Job not found for ${id}.`);

    this.jobs.delete(id);

    const e = new Error(msg);
    e.code = code;
    e.type = type;

    job.reject(e);
  }

  sendPacket(packet) {
    this.sendMessage(packet.toString());

    for (const data of packet.buffers)
      this.sendBinary(data);
  }

  sendConnect() {
    this.sendPacket(new Packet(Packet.types.CONNECT));
  }

  sendDisconnect() {
    this.sendPacket(new Packet(Packet.types.DISCONNECT));
  }

  sendEvent(data) {
    const packet = new Packet();
    packet.type = Packet.types.EVENT;
    packet.setData(data);
    this.sendPacket(packet);
  }

  sendCall(id, data) {
    const packet = new Packet();
    packet.type = Packet.types.EVENT;
    packet.id = id;
    packet.setData(data);
    this.sendPacket(packet);
  }

  sendAck(id, data) {
    const packet = new Packet();
    packet.type = Packet.types.ACK;
    packet.id = id;
    packet.setData([null, data]);
    this.sendPacket(packet);
  }

  sendError(id, err) {
    const message = castMsg(err.message);
    const code = castCode(err.code);
    const type = castType(err.type);

    if (id === -1) {
      const packet = new Packet();
      packet.type = Packet.types.ERROR;
      packet.setData({ message, code, type });
      this.sendPacket(packet);
      return;
    }

    const packet = new Packet();
    packet.type = Packet.types.ACK;
    packet.id = id;
    packet.setData([{ message, code, type }]);
    this.sendPacket(packet);
  }

  /*
   * API
   */

  listen(event, handler) {
    enforce(typeof event === 'string', 'event', 'string');
    enforce(typeof handler === 'function', 'handler', 'function');
    assert(!blacklist[event], 'Blacklisted event.');
    this.events.on(event, handler);
  }

  fire(...args) {
    enforce(args.length > 0, 'event', 'string');
    enforce(typeof args[0] === 'string', 'event', 'string');
    this.sendEvent(args);
  }

  hook(event, handler) {
    enforce(typeof event === 'string', 'event', 'string');
    enforce(typeof handler === 'function', 'handler', 'function');
    assert(!this.hooks.has(event), 'Hook already bound.');
    assert(!blacklist[event], 'Blacklisted event.');
    this.hooks.set(event, handler);
  }

  call(...args) {
    enforce(args.length > 0, 'event', 'string');
    enforce(typeof args[0] === 'string', 'event', 'string');

    const id = this.sequence;

    this.sequence += 1;
    this.sequence >>>= 0;

    this.sendCall(id, args);

    assert(!this.jobs.has(id), 'ID collision.');

    return new Promise((resolve, reject) => {
      this.jobs.set(id, new Job(resolve, reject, Date.now()));
    });
  }

  join(name) {
    if (!this.server)
      return false;
    return this.server.join(this, name);
  }

  leave(name) {
    if (!this.server)
      return false;
    return this.server.leave(this, name);
  }

  static connect(port, host, wss) {
    throw new Error('Abstract method.');
  }
}

/*
 * Helpers
 */

class Job {
  constructor(resolve, reject, time) {
    this.resolve = resolve;
    this.reject = reject;
    this.time = time;
  }
}

function castCode(code) {
  if (code !== null
    && typeof code !== 'number'
    && typeof code !== 'string') {
    return null;
  }
  return code;
}

function castMsg(msg) {
  if (typeof msg !== 'string')
    return 'No message.';
  return msg;
}

function castType(type) {
  if (typeof type !== 'string')
    return null;
  return type;
}

function enforce(value, name, type) {
  if (!value) {
    const err = new TypeError(`'${name}' must be a(n) ${type}.`);
    if (Error.captureStackTrace)
      Error.captureStackTrace(err, enforce);
    throw err;
  }
}

/*
 * Expose
 */

module.exports = BaseSocket;
