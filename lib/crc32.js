'use strict';

const TABLE = (() => {
  const tbl = new Array(256);

  for (let i = 0; i < 256; i++) {
    let n = i;
    for (let j = 0; j < 8; j++) {
      if (n & 1)
        n = (n >>> 1) ^ 0xedb88320;
      else
        n >>>= 1;
    }
    tbl[i] = n;
  }

  return tbl;
})();

function crc32(data) {
  const left = data.length % 4;
  const len = data.length - left;
  const T = TABLE;

  let hash = 0xffffffff;
  let i = 0;

  while (i < len) {
    hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
    hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
    hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
    hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
  }

  switch (left) {
    case 3:
      hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
    case 2:
      hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
    case 1:
      hash = (hash >>> 8) ^ T[(hash ^ data[i++]) & 0xff];
  }

  hash ^= 0xffffffff;

  return hash >>> 0;
}

/*
 * Expose
 */

module.exports = crc32;
