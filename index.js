var fs              = require('fs');
var relativePath    = require('path').relative;
var WebSocketServer = require('ws').Server;
var FSWatcher       = require('chokidar').FSWatcher;
var EventEmitter    = require('events').EventEmitter;
var console         = require('console');

function WatchRemotely(paths, options) {
  if (!(this instanceof WatchRemotely)) {
    return new WatchRemotely(paths, options);
  }

  /* eslint-disable no-console */
  this._logger = options && options.logger || console.log;
  /* eslint-enable no-console */

  /* eslint-disable vars-on-top */
  var params = this._normalizeParameters({ paths: paths, options: options });
  /* eslint-enable vars-on-top */

  this._paths = [].concat(params.paths);

  this._ws        = params.options.ws;
  this._watcher   = params.options.watcher;

  this._withContents  = params.options.withContents;
  this._relativePaths = params.options.relativePaths;
  this._basePath      = params.options.basePath;

  this._clients = {};
  this._lastClientId = 0;

  this._onWsConnectionHandler  = null;
  this._onWatcherEventHandlers = {};

  this._clientsSettings = {};
}

function constant(value) {
  return { configurable: false, enumerable: false, writable: false, value: value };
}

function getter(method) {
  return { configurable: false, enumerable: false, 'get': method };
}

function clone(object) {
  /* eslint-disable */
  var newObject = {};
  for (var prop in object) { newObject[prop] = object[prop] };
  return newObject;
  /* eslint-enable */
}

Object.defineProperties(WatchRemotely, {
  DEFAULT_WS_HOST: constant('127.0.0.1'),
  DEFAULT_WS_PORT: constant(4020),
  DEFAULT_WS_PATH: constant(''),
});

Object.defineProperties(WatchRemotely.prototype, {
  ws: getter(function ws() {
    return this._ws;
  }),
  watcher: getter(function watcher() {
    return this._watcher;
  }),
  isRunning: getter(function isRunning() {
    return !!this._onWsConnectionHandler;
  }),
  settings: getter(function settings() {
    return {
      withContents: this._withContents,
      relativePaths: this._relativePaths,
      basePath: this._basePath,
    };
  }),
});

WatchRemotely.prototype.run = function run() {
  var that = this;

  if (that.isRunning) {
    throw new Error('Hot module replacement server is already running!');
  }

  that._ws.on('connection', that._onWsConnectionHandler = that._onWsConnection.bind(that));

  if (that._paths.length) {
    that._watcher.add(that._paths);
  }

  ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach(function addingEventHandler(event) {
    that._watcher.on(event, that._onWatcherEventHandlers[event] = that._onWatcherEvent.bind(that, event));
  });

  return that;
};

WatchRemotely.prototype.stop = function stop() {
  var that = this;

  if (!that.isRunning) {
    throw new Error('Hot module replacement server does not running');
  }

  that._ws.removeListener('connection', that._onWsConnectionHandler);
  that._onWsConnectionHandler = null;

  if (that._paths) {
    that._watcher.unwatch(that._paths);
  }

  ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach(function removingEventHandler(event) {
    that._watcher.removeListener(event, that._onWatcherEventHandlers[event]);
    delete that._onWatcherEventHandlers[event];
  });

  return that;
};

WatchRemotely.prototype.broadcast = function broadcast(event, path, contents) {
  var clientId;

  var payload  = {
    event: event,
    path: this._relativePaths ? relativePath(this._basePath, path) : path,
  };

  if (contents) {
    payload.contents = contents;
  }

  payload = JSON.stringify(payload);

  for (clientId in this._clients) {
    if (this._clients.hasOwnProperty(clientId)) {
      this._clients[clientId].send(payload);
    }
  }

  return this;
};

WatchRemotely.prototype.setSettings = function setSettings(settings) {
  if ('basePath' in settings) {
    this._basePath = settings.basePath;
  }
  if ('withContents' in settings) {
    this._withContents = settings.withContents;
  }
  if ('relativePaths' in settings) {
    this._relativePaths = settings.relativePaths;
  }
  return this;
};

WatchRemotely.prototype._normalizeParameters = function normalizeParameters(params) {
  var paths   = params.paths   || [];
  var options = params.options || {};

  if (typeof paths !== 'string' && Object.prototype.toString.call(paths) !== '[object Array]') {
    options = paths;
    paths   = [];
  }

  paths   = [].concat(paths);
  options = clone(options);

  if (!(options.watcher instanceof EventEmitter)) {
    options.watcher = clone(options.watcher || {});

    options.watcher.ignoreInitial = 'ignoreInitial' in options.watcher ? options.watcher.ignoreInitial : true;

    options.watcher = new FSWatcher(options.watcher);

    this._log('Create file system watcher');
  }


  if (!(options.ws instanceof EventEmitter)) {
    options.ws = clone(options.ws || {});

    /* eslint-disable vars-on-top */
    var host = options.ws.host = 'host' in options.ws ? options.ws.host : WatchRemotely.DEFAULT_WS_HOST;
    var port = options.ws.port = 'port' in options.ws ? options.ws.port : WatchRemotely.DEFAULT_WS_PORT;
    var path = options.ws.path = 'path' in options.ws ? options.ws.path : WatchRemotely.DEFAULT_WS_PATH;
    /* eslint-enable vars-on-top */

    options.ws = new WebSocketServer(options.ws);

    this._log('Create web socket server. Start listening on ws://' + host + ':' + port + '/' + (path || ''));
  }

  if (!('basePath' in options)) {
    options.basePath = process.cwd();
  }

  if (!('relativePaths' in options)) {
    options.relativePaths = false;
  }

  if (!('withContents' in options)) {
    options.withContents = false;
  }

  return {
    paths: paths,
    options: options,
  };
};

WatchRemotely.prototype._log = function _log(message) {
  return this._logger && this._logger(message);
};

WatchRemotely.prototype._onWsConnection = function _onWsConnection(client) {
  var that     = this;
  var clientId = ++that._lastClientId;

  that._clients[clientId] = client;
  that._clientsSettings[clientId] = {};

  client.on('close', function onClose() {
    delete that._clients[clientId];
    delete that._clientsSettings[clientId];

    that._log('Client #' + clientId + ' was disconnected');
  });

  client.on('message', function onMessage(message) {
    var payload = JSON.parse(message);

    if (payload.event === 'settings') {
      return that._onMessageSettings(clientId, payload.settings);
    }

    that._log('Client #' + clientId + ' receive message: ' + message);
  });

  that._log('Client #' + clientId + ' was connected');
};

WatchRemotely.prototype._onWatcherEvent = function _onWatcherEvent(event, path) {
  var that = this;

  if (['add', 'change'].indexOf(event) !== -1 && this._withContents) {
    fs.readFile(path, function onFileRead(error, data) {
      if (error) {
        throw error;
      }

      that.broadcast(event, path, data.toString('utf8'));
    });
  } else {
    that.broadcast(event, path);
  }

  that._log('Event "' + event + '" for path "' + path + '"');
};

WatchRemotely.prototype._onMessageSettings = function _onMessageSettings(clientId, settings) {
  var that = this;
  var clientSettings = that._clientsSettings[clientId];
  var sendClientSettings = {};

  ['basePath', 'relativePaths', 'withContents'].forEach(function setSetting(setting) {
    if (settings && setting in settings) {
      clientSettings[setting] = settings[setting];
    }

    sendClientSettings[setting] = (setting in clientSettings) ? clientSettings[setting] : this['_' + setting];
  });

  if (settings) {
    that._log('Client #' + clientId + ' settings was set: ' + JSON.stringify(settings));
  }

  this._clients[clientId].send(JSON.stringify({ event: 'settings', settings: sendClientSettings }));
};

module.exports = WatchRemotely;
