'use strict';

exports.ws = require('faye-websocket');
exports.Server = require('./lib/http/server');
exports.createServer = exports.Server.createServer.bind(exports.Server);
exports.attach = exports.Server.attach.bind(exports.Server);
exports.Socket = require('./lib/http/socket');
exports.connect = exports.Socket.connect.bind(exports.Socket);

exports.tcp = {};
exports.tcp.Server = require('./lib/net/server');
exports.tcp.createServer = exports.tcp.Server.createServer.bind(exports.tcp.Server);
exports.tcp.attach = exports.tcp.Server.attach.bind(exports.tcp.Server);
exports.tcp.Socket = require('./lib/net/socket');
exports.tcp.connect = exports.tcp.Socket.connect.bind(exports.tcp.Socket);
