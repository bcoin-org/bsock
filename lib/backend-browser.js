'use strict';

exports.Client = global.WebSocket || global.MozWebSocket;
exports.EventSource = global.EventSource;
