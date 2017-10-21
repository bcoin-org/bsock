'use strict';

const WebSocket = require('./http/backend');
const Server = require('./http/server');
const Socket = require('./http/socket');
const TCPServer = require('./net/server');
const TCPSocket = require('./net/socket');

exports.WebSocket = WebSocket;

exports.Server = Server;
exports.createServer = Server.createServer.bind(Server);
exports.attach = Server.attach.bind(Server);
exports.Socket = Socket;
exports.connect = Socket.connect.bind(Socket);

exports.tcp = {
  Server: TCPServer,
  createServer: TCPServer.createServer.bind(TCPServer),
  attach: TCPServer.attach.bind(TCPServer),
  Socket: TCPSocket,
  connect: TCPSocket.connect.bind(TCPSocket)
};
