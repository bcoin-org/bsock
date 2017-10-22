'use strict';

const Server = require('./http/server');
const Socket = require('./http/socket');
const TCPServer = require('./net/server');
const TCPSocket = require('./net/socket');

exports.Server = Server;
exports.server = Server.createServer.bind(Server);
exports.createServer = Server.createServer.bind(Server);
exports.attach = Server.attach.bind(Server);
exports.Socket = Socket;
exports.socket = Socket.connect.bind(Socket);
exports.connect = Socket.connect.bind(Socket);

exports.tcp = {
  Server: TCPServer,
  server: TCPServer.createServer.bind(TCPServer),
  createServer: TCPServer.createServer.bind(TCPServer),
  attach: TCPServer.attach.bind(TCPServer),
  Socket: TCPSocket,
  socket: TCPSocket.connect.bind(TCPSocket),
  connect: TCPSocket.connect.bind(TCPSocket)
};
