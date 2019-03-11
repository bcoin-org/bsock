'use strict';

process.on('unhandledRejection', (err, promise) => {
  throw err;
});

const SocketIO = require('./vendor/socket.io-client');
const http = require('http');
const bsock = require('../');
const io = bsock.createServer();
const server = http.createServer();

function timeout(ms) {
  return new Promise(r => setTimeout(r, ms));
}

io.attach(server);

io.on('socket', (socket) => {
  socket.on('error', () => {});
  socket.hook('foo', async () => {
    const result = Buffer.from('test', 'ascii');
    await timeout(3000);
    return result;
  });
  socket.hook('err', async () => {
    throw new Error('Bad call.');
  });
  socket.bind('bar', (data) => {
    console.log('Received bar: %s', data.toString('ascii'));
  });
});

server.listen(8000);

const socket = new SocketIO('ws://127.0.0.1:8000', {
  transports: ['websocket'],
  forceNew: true
});

console.log('Calling foo...');

socket.emit('foo', (err, data) => {
  console.log('Response for foo: %s', data.toString('ascii'));
});

console.log('Sending bar...');

socket.emit('bar', Buffer.from('baz'));

console.log('Sending error...');

socket.emit('err', (err) => {
  console.log('Response for error: %s', err.message);
});
