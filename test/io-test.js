'use strict';

process.on('unhandledRejection', (err, promise) => {
  throw err;
});

const SocketIO = require('./vendor/socket.io');
const http = require('http');
const bsock = require('../');
const server = http.createServer();

function timeout(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const io = new SocketIO({
  transports: ['websocket'],
  serveClient: false
});

io.attach(server);

io.on('connection', (socket) => {
  socket.on('foo', async (cb) => {
    const result = Buffer.from('test', 'ascii');
    await timeout(3000);
    cb(null, result);
  });
  socket.on('err', (cb) => {
    cb({ message: 'Bad call.' });
  });
  socket.on('bar', (data) => {
    console.log('Received bar: %s', data.toString('ascii'));
  });
});

server.listen(8000);

const socket = bsock.connect(8000);

socket.on('error', () => {});
socket.on('connect', async () => {
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
