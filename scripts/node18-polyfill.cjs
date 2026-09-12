const crypto = require("node:crypto");

if (typeof crypto.hash !== "function") {
  crypto.hash = function(algorithm, data, outputEncoding) {
    const hash = crypto.createHash(algorithm);
    hash.update(data);
    return outputEncoding ? hash.digest(outputEncoding) : hash.digest();
  };
}

if (!globalThis.crypto) {
  globalThis.crypto = crypto.webcrypto || crypto;
}
