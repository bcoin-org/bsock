/* eslint-env mocha */

'use strict';

const assert = require('bsert');
const SIO = require('./vendor/socket.io');
const SIOC = require('./vendor/socket.io-client');
const http = require('http');
const bsock = require('../');

function timeout(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function emit(socket, event) {
  return new Promise((resolve, reject) => {
    socket.emit(event, (err, res) => {
      if (err)
        reject(err);
      else
        resolve(res);
    });
  });
}

describe('Socket', () => {
  describe('socket.io client -> bsock server', () => {
    const io = bsock.createServer();
    const server = http.createServer();

    let socket = null;
    let barData = null;

    it('should setup server', (cb) => {
      io.attach(server);

      io.on('socket', (socket) => {
        socket.on('error', () => {});

        socket.hook('foo', async () => {
          return Buffer.from('test', 'ascii');
        });

        socket.hook('err', async () => {
          throw new Error('Bad call.');
        });

        socket.bind('bar', (data) => {
          assert(!barData);
          barData = data;
        });
      });

      server.listen(8000, cb);
    });

    it('should setup socket', () => {
      socket = new SIOC('ws://127.0.0.1:8000', {
        transports: ['websocket'],
        forceNew: true
      });
    });

    it('should call hook', async () => {
      const data = await emit(socket, 'foo');

      assert(Buffer.isBuffer(data));
      assert.bufferEqual(data, 'test', 'ascii');
    });

    it('should call error hook', async () => {
      await assert.rejects(emit(socket, 'err'), {
        message: 'Bad call.'
      });
    });

    it('should fire event', async () => {
      socket.emit('bar', Buffer.from('baz'));

      await timeout(100);

      assert(Buffer.isBuffer(barData));
      assert.bufferEqual(barData, 'baz', 'ascii');
    });

    it('should close', (cb) => {
      socket.destroy();
      server.close(cb);
    });
  });

  describe('bsock client -> socket.io server', () => {
    const io = new SIO({
      transports: ['websocket'],
      serveClient: false
    });

    const server = http.createServer();

    let socket = null;
    let barData = null;

    it('should setup server', (cb) => {
      io.attach(server);

      io.on('connection', (socket) => {
        socket.on('foo', async (cb) => {
          cb(null, Buffer.from('test', 'ascii'));
        });

        socket.on('err', (cb) => {
          cb({ message: 'Bad call.' });
        });

        socket.on('bar', (data) => {
          assert(!barData);
          barData = data;
        });
      });

      server.listen(8000, cb);
    });

    it('should setup socket', () => {
      socket = bsock.connect(8000);
      socket.on('error', () => {});
    });

    it('should call hook', async () => {
      const data = await socket.call('foo');

      assert(Buffer.isBuffer(data));
      assert.bufferEqual(data, 'test', 'ascii');
    });

    it('should call error hook', async () => {
      await assert.rejects(socket.call('err'), {
        message: 'Bad call.'
      });
    });

    it('should fire event', async () => {
      socket.fire('bar', Buffer.from('baz'));

      await timeout(100);

      assert(Buffer.isBuffer(barData));
      assert.bufferEqual(barData, 'baz', 'ascii');
    });

    it('should not queue on destroyed socket', async () => {
      socket.destroy();
      await assert.rejects(socket.call('foo'), {
        message: 'Socket destroyed.'
      });
    });

    it('should close', (cb) => {
      server.close(cb);
    });
  });

  describe('bsock client -> bsock server', () => {
    const io = bsock.createServer();
    const server = http.createServer();

    let socket = null;
    let barData = null;
    let clientFailedCallDone = false;
    let serverCallError = null;

    it('should setup server', (cb) => {
      io.attach(server);

      io.on('socket', (socket) => {
        socket.on('error', () => {});

        socket.hook('echo', async (json) => {
          return json;
        });

        socket.hook('foo', async () => {
          return Buffer.from('test', 'ascii');
        });

        socket.hook('err', async () => {
          throw new Error('Bad call.');
        });

        socket.bind('bar', (data) => {
          assert(!barData);
          barData = data;
        });

        socket.bind('join', (name) => {
          io.join(socket, name);
          io.to(name, 'test', 'testing');
          io.leave(socket, name);
          io.to(name, 'test', 'testing again');
        });

        socket.bind('trigger client hook and event', async (data) => {
          await socket.call('client hook', data);
          await socket.fire('client event', data);
        });

        socket.hook('socket call back with delay', async (n) => {
          await timeout(n);
          try {
            await socket.call('call response');
          } catch (e) {
            serverCallError = e;
          } finally {
            clientFailedCallDone = true;
          }
        });
      });

      server.listen(8000, cb);
    });

    it('should setup socket', () => {
      socket = bsock.connect(8000);
      socket.on('error', () => {});
    });

    it('should call hook', async () => {
      const data = await socket.call('foo');

      assert(Buffer.isBuffer(data));
      assert.bufferEqual(data, 'test', 'ascii');
    });

    it('should call error hook', async () => {
      await assert.rejects(socket.call('err'), {
        message: 'Bad call.'
      });
    });

    it('should fire event', async () => {
      socket.fire('bar', Buffer.from('baz'));

      await timeout(100);

      assert(Buffer.isBuffer(barData));
      assert.bufferEqual(barData, 'baz', 'ascii');
    });

    it('should receive channel event', async () => {
      const data = [];

      socket.bind('test', (str) => {
        data.push(str);
      });

      socket.fire('join', 'test-channel');

      await timeout(100);

      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0], 'testing');
    });

    it('should send complex data', async () => {
      const obj = {
        foo: {
          a: 1,
          b: 'z',
          c: Buffer.from('foo')
        },
        bar: {
          d: 100,
          e: 'bar'
        }
      };

      const json = await socket.call('echo', obj);

      assert.deepStrictEqual(json, obj);
    });

    it('should receive hook and event', async () => {
      const hook = new Promise((resolve) => {
        const hook = async (data) => {
          resolve(data);
          socket.unhook('client hook', hook);
          return null;
        };

        socket.hook('client hook', hook);
      });

      const event = new Promise((resolve) => {
        const event = async (data) => {
          resolve(data);
          socket.unbind('client event', event);
        };

        socket.bind('client event', event);
      });

      socket.fire('trigger client hook and event', 'hello');
      assert.strictEqual(await hook, 'hello');
      assert.strictEqual(await event, 'hello');
    });

    it('should not queue hook on destroyed socket (server)', async () => {
      let callError = null;

      socket
        .call('socket call back with delay', 200)
        .catch((err) => {
          callError = err;
        });

      await timeout(100);
      socket.destroy();
      await timeout(150);

      assert.strictEqual(callError.message, 'Job timed out.');
      assert.strictEqual(clientFailedCallDone, true);
      assert(serverCallError);
      assert.strictEqual(serverCallError.message, 'Socket destroyed.');
    });

    it('should close', (cb) => {
      server.close(cb);
    });
  });
});
