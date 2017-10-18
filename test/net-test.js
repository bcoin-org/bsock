'use strict';

process.on('unhandledRejection', (err, promise) => {
  throw err;
});

const net = require('net');
const bsock = require('../');
const io = bsock.tcp.createServer();
const server = net.createServer();

function timeout(ms) {
  return new Promise(r => setTimeout(r, ms));
}

io.attach(server);

io.on('socket', (socket) => {
  socket.hook('foo', async () => {
    const result = Buffer.from('test', 'ascii');
    await timeout(3000);
    return result;
  });
  socket.hook('err', async () => {
    throw new Error('Bad call.');
  });
  socket.listen('bar', (data) => {
    console.log('Received bar: %s', data.toString('ascii'));
  });
});

server.listen(8000);

const socket = bsock.tcp.connect(8000);

socket.on('open', async () => {
  console.log('Calling foo...');

  const data = await socket.call('foo');
  console.log('Response for foo: %s', data.toString('ascii'));

  console.log('Sending bar...');

  socket.fire('bar', Buffer.from('baz'));

  console.log('Sending error...');

  try {
    await socket.call('err');
  } catch (e) {
    console.log('Response for error: %s', e.message);
  }
});
