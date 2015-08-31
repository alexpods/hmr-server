var fs              = require('fs');
var WebSocketServer = require('ws').Server;
var FSWatcher       = require('chokidar').FSWatcher;

var DEFAULT_WS_PATH = '/hmr';

function Server(paths, options) {
  if (typeof paths !== 'string' || Object.prototype.toString.call(paths) !== '[object Array]') {
    options = paths;
    paths   = null;
  }

  this._paths = paths;

  options = this._normalizeOptions(options);

  this._ws      = options.ws;
  this._watcher = options.watcher;

  this._clients = {};
  this._lastClientId = 0;

  this._onWebSocketConnectionHandler = null;
}

Object.defineProperties(Server.prototype, {
  isRunning: {
    get: function() {
      return !!this._onConnectionHandler;
    }
  }
});

Server.prototype.run = function() {
  if (this.isRunning) {
    throw new Error('Hot module replacement server is already running!');
  }

  this._ws.on('connection', this._onWebSocketConnectionHandler = this._onWebSocketConnection.bind(this));

  if (this._paths) {
    this._watcher.add(this._paths);
  }

  this._watcher.on('add',     this._onWatcherAddHandler    = this._onWatcherChange.bind(this));
  this._watcher.on('change',  this._onWatcherChangeHandler = this._onWatcherChange.bind(this));
  this._watcher.on('unlink',  this._onWatcherUnlinkHandler = this._onWatcherRemove.bind(this));

  return this;
};

Server.prototype.stop = function() {
  if (!this.isRunning) {
    throw new Error('Hot module replacement server does not running');
  }

  this._ws.removeListener('connection', this._onWebSocketConnectionHandler);

  if (this._paths) {
    this._watcher.unwatch(this._paths);
  }

  this._watcher.removeListener('add',     this._onWatcherAddHandler);
  this._watcher.removeListener('change',  this._onWatcherChangeHandler);
  this._watcher.removeListener('unlink',  this._onWatcherUnlinkHandler);

  this._onWebSocketConnectionHandler = null;

  this._onWatcherAddHandler    = null;
  this._onWatcherChangeHandler = null;
  this._onWatcherUnlinkHandler = null;

  return this;
};

Server.prototype._onWebSocketConnection = function(client) {
  var server   = this;
  var clientId = ++server._lastClientId;

  server._clients[clientId] = client;

  client.on('close', function() {
    delete server._clients[clientId];
  });
};

Server.prototype._onWatcherChange = function(path) {
  var that = this;

  fs.readFile(path, function(error, data) {
    if (error) {
      return;
    }

    that.broadcast({ type: 'change', path: path, content: data });
  });
};

Server.prototype._onWatcherRemove = function(path) {
  this.broadcast({ type: 'remove', path: path });
};

Server.prototype._normalizeOptions = function(options) {
  options = options || {};

  if (!options.ws || options.ws.constructor.name !== 'WebSocketServer') {
    options.ws = new WebSocketServer(this._normalizeOptionsWS(options.ws));
  }

  if (!options.watcher || options.watcher.constructor.name !== 'FSWatcher') {
    options.watcher = new FSWatcher(this._normalizeOptionsWatcher(options.watcher));
  }

  return options;
};

Server.prototype._normalizeOptionsWS = function(wsOptions) {
  wsOptions = wsOptions || {};

  if (!wsOptions.path) {
    wsOptions.path = DEFAULT_WS_PATH;
  }

  return wsOptions;
};

Server.prototype._normalizeOptionsWatcher = function(watcherOptions) {
  watcherOptions = watcherOptions || {};

  return watcherOptions;
};

module.exports = Server;