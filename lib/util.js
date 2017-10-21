'use strict';

const assert = require('assert');
const URL = require('url');

exports.parseURL = function parseURL(url) {
  const data = URL.parse(url);
  const host = data.hostname;

  let port = 80;
  let wss = false;

  if (data.protocol === 'https:' || data.protocol === 'wss:') {
    port = 443;
    wss = true;
  }

  if (data.port != null) {
    port = parseInt(data.port, 10);
    assert((port & 0xffff) === port);
  }

  return [port, host, wss];
};
