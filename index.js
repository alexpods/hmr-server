var Server = require('./src/Server');

function createServer(path, options) {
  return new Server(path, options);
}

module.exports = createServer;
module.exports.Server = Server;