'use strict';

try {
  module.exports = require('./uws');
} catch (e) {
  module.exports = require('faye-websocket');
}
