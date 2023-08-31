'use strict';

/** @type {any} */
const WebSocket = require('../vendor/faye-websocket');

exports.WebSocket = WebSocket;
exports.Client = WebSocket.Client;
exports.EventSource = WebSocket.EventSource;
