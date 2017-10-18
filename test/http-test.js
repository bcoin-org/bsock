'use strict';

const http = require('http');
const brpc = require('../');
const rpc = brpc.createServer();
const server = http.createServer();

function timeout(ms) {
  return new Promise(r => setTimeout(r, ms));
}

rpc.attach(server);

rpc.on('socket', (socket) => {
  socket.hook('foo', async function(data) {
    const result = Buffer.from('test', 'ascii');
    await timeout(3000);
    return result;
  });
  socket.hook('error', async (data) => {
    throw new Error('Bad call.');
  });
  socket.listen('bar', function(data) {
    console.log('Received bar: %s', data.toString('ascii'));
  });
});

server.listen(8000);

const socket = brpc.connect(8000);

socket.on('open', async () => {
  console.log('Calling foo...');

  const data = await socket.call('foo');
  console.log('Response for foo: %s', data.toString('ascii'));

  console.log('Sending bar...');
  socket.fire('bar', Buffer.from('baz'));

  console.log('Sending error...');

  try {
    await socket.call('error');
  } catch (e) {
    console.log('Response for error: ', e.message);
  }
});
