var expect        = require('chai').expect;
var sinon         = require('sinon');
var readFileSync  = require('fs').readFileSync;
var EventEmitter  = require('events').EventEmitter;
var proxyquire    = require('proxyquire');

var WebSocketServerStub = sinon.spy();
var FSWatcherStub       = sinon.spy();

var WatchRemotely = proxyquire('./index', {
  console:  { log: function() {}             },
  ws:       { Server:    WebSocketServerStub },
  chokidar: { FSWatcher: FSWatcherStub       }
});

describe('WatchRemotely', function() {

  describe('initializing', function() {
    it('should take ready web socket server if it implements EventEmitter', function() {
      var mockWs      = createFakeWebSocketServer();
      var remoteWatch = new WatchRemotely({ ws: mockWs });

      expect(remoteWatch.ws).to.equal(mockWs);
    });

    it('should take ready watcher if it implements EventEmitter', function() {
      var mockWatcher = createFakeFSWatcher();
      var remoteWatch = new WatchRemotely({ watcher: mockWatcher });

      expect(remoteWatch.watcher).to.equal(mockWatcher);
    });

    it('should create new web socket server with specified options', function() {
      var wsOptions = { port: 1234, host: 'localhost', path: '/hello' };
      var remoteWatch = new WatchRemotely({ ws: wsOptions });

      expect(WebSocketServerStub.calledWith(wsOptions)).to.equal(true);
    });

    it('should initialize web socket server with default host is it\'s not specified', function() {
      var remoteWatch = new WatchRemotely({ ws: {} });

      expect(WebSocketServerStub.args[0][0].host).to.equal(WatchRemotely.DEFAULT_WS_HOST);
    });

    it('should initialize web socket server with default port if it\'s not specified', function() {
      var remoteWatch = new WatchRemotely({ ws: {} });

      expect(WebSocketServerStub.args[0][0].port).to.equal(WatchRemotely.DEFAULT_WS_PORT);
    });

    it('should create new watcher with specified options', function() {
      var watcherOptions = { persistent: true, usePolling: true, ignoreInitial: false };
      var remoteWatch = new WatchRemotely({ watcher: watcherOptions });

      expect(FSWatcherStub.calledWith(watcherOptions)).to.equal(true);
    });

    it('should set settings options if such specified', function() {
      var options = { basePath: '/some/base/path', withContents: true, relativePaths: true };
      var remoteWatch = new WatchRemotely(options);

      expect(remoteWatch.settings).to.deep.equal(options);
    });

    it('should set settings through "setSettings()" method', function() {
      var initSettings = { basePath: '/some/initial/path', withContents: true, relativePaths: true };
      var remoteWatch  = new WatchRemotely(initSettings);

      expect(remoteWatch.settings).to.deep.equal(initSettings);

      var settings = { basePath: '/some/other/path', withContents: false, relativePaths: false };
      remoteWatch.setSettings(settings);

      expect(remoteWatch.settings).to.deep.equal(settings);
    });
  });

  describe('starting', function() {
    var remoteWatch, fakeWs, fakeWatcher, paths;

    beforeEach(function() {
      fakeWs      = createFakeWebSocketServer();
      fakeWatcher = createFakeFSWatcher();
      paths       = ['some/path1', 'some/path2'];
      remoteWatch = new WatchRemotely(paths, { ws: fakeWs, watcher: fakeWatcher });
    });

    it('should set "isRunning" to true after run', function() {
      expect(remoteWatch.isRunning).to.equal(false);
      remoteWatch.run();
      expect(remoteWatch.isRunning).to.equal(true);
    });

    it('should start listen to the watcher and web socket server events', function() {
      expect(fakeWs.on.notCalled).to.equal(true);
      expect(fakeWatcher.on.notCalled).to.equal(true);

      remoteWatch.run();

      expect(fakeWs.on.calledWithMatch('connection')).to.equal(true);
      expect(fakeWs.listenerCount('connection')).to.equal(1);

      ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach(function(event) {
        expect(fakeWatcher.on.calledWith(event)).to.equal(true);
        expect(fakeWatcher.listenerCount(event)).to.equal(1);
      })
    });

    it('should add specified paths to watcher after run', function() {
      expect(fakeWatcher.add.notCalled).to.equal(true);
      remoteWatch.run();
      expect(fakeWatcher.add.calledWith(paths)).to.equal(true);
    });
  });

  describe('running', function() {
    var remoteWatch, fakeWs, fakeWatcher;

    beforeEach(function() {
      fakeWs      = createFakeWebSocketServer();
      fakeWatcher = createFakeFSWatcher();
      remoteWatch = new WatchRemotely('', { ws: fakeWs, watcher: fakeWatcher });

      return remoteWatch.run();
    });

    it('should broadcast changes to all of its connected clients', function() {
      var clients = generateFakeConnections(fakeWs, 2);

      var event    = 'someEvent';
      var path     = 'some/path';
      var contents = 'content';

      remoteWatch.broadcast(event, path, contents);

      var payload = JSON.stringify({ event: event, path: path, contents: contents });

      clients.forEach(function(client) {
        expect(client.send.calledWith(payload)).to.equal(true);
      });
    });

    it('should remove client if it closes connection', function() {
      var clients = generateFakeConnections(fakeWs, 2);

      clients[1].emit('close');

      remoteWatch.broadcast('someEvent', 'some/path');

      expect(clients[0].send.calledOnce).to.equal(true);
      expect(clients[1].send.notCalled).to.equal(true);
    });

    ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach(function(event) {

      it('should broadcast "' + event + '" event on new file creation', function() {
        var clients = generateFakeConnections(fakeWs, 3);
        var path    = 'some/path';

        fakeWatcher.emit(event, path);

        var payload = JSON.stringify({ event: event, path: path });

        clients.forEach(function(client) {
          expect(client.send.calledWith(payload)).to.equal(true);
        })
      });

      it('should broadcast "' + event + '" event with relative path if such settings is set', function() {
        remoteWatch.setSettings({ relativePaths: true, basePath: '/some/base/path' });

        var clients = generateFakeConnections(fakeWs, 3);
        var path    = '/some/base/path/some/file/path';

        fakeWatcher.emit(event, path);

        var payload = JSON.stringify({ event: event, path: 'some/file/path' });

        clients.forEach(function(client) {
          expect(client.send.calledWith(payload)).to.equal(true);
        });
      });
    });

    ['add', 'change'].forEach(function(event) {

      it('should broadcast "' + event + '" event with file contents if such setting is set', function() {
        remoteWatch.setSettings({ withContents: true });

        var clients = generateFakeConnections(fakeWs, 3);
        var path    = __dirname + '/package.json';

        var expectedPayload = JSON.stringify({
          event: event,
          path: path,
          contents: readFileSync(path).toString('utf8'),
        });

        var promises = clients.map(function(client) {
          return new Promise(function(resolve) {
            client.send = function(payload) {
              expect(payload).to.equal(expectedPayload);
              resolve();
            };
          });
        });

        fakeWatcher.emit(event, path);

        return Promise.all(promises);
      });
    });

    it('should set and send settings for concrete client when "settings" message is received', function() {
      var clients = generateFakeConnections(fakeWs, 3);

      var settings = [];
      clients.forEach(function(client, index) {
        var settings = {
          basePath: '/some/base/path/' + index,
          relativePaths: Math.random() < 0.5,
          withContents: Math.random() < 0.5
        };

        client.emit('message', JSON.stringify({ event: 'settings', settings: settings }));

        expect(client.send.calledWith(JSON.stringify({ event: 'settings', settings: settings }))).to.equal(true);
      });
    });
  });

  describe('stopping', function() {
    var remoteWatch, fakeWs, fakeWatcher, paths;

    beforeEach(function() {
      fakeWs      = createFakeWebSocketServer();
      fakeWatcher = createFakeFSWatcher();
      paths       = ['some/paths'];
      remoteWatch = new WatchRemotely(paths, { ws: fakeWs, watcher: fakeWatcher });

      remoteWatch.run();
    });

    it('should set "isRunning" to false after stopping', function() {
      expect(remoteWatch.isRunning).to.equal(true);
      remoteWatch.stop();
      expect(remoteWatch.isRunning).to.equal(false);
    });

    it('should stop listen to the web socket server and watcher events', function() {
      expect(fakeWs.listenerCount('connection')).to.equal(1);

      ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach(function(event) {
        expect(fakeWatcher.listenerCount(event)).to.equal(1);
      });

      remoteWatch.stop();

      expect(fakeWs.listenerCount('connection')).to.equal(0);

      ['add', 'change', 'unlink', 'addDir', 'unlinkDir'].forEach(function(event) {
        expect(fakeWatcher.listenerCount(event)).to.equal(0);
      });
    });

    it('should unwatch specified paths from watcher after stop', function() {
      expect(fakeWatcher.unwatch.notCalled).to.equal(true);
      remoteWatch.stop();
      expect(fakeWatcher.unwatch.calledWith(paths)).to.equal(true);
    });
  });
});

function createFakeClient() {
  var client = new EventEmitter();
  client.send = sinon.spy();
  return client;
}

function createFakeWebSocketServer() {
  var webSocketServer = new EventEmitter();
  webSocketServer.on = sinon.spy(webSocketServer, 'on');
  return webSocketServer;
}

function createFakeFSWatcher() {
  var watcher = new EventEmitter();
  watcher.on      = sinon.spy(watcher, 'on');
  watcher.add     = sinon.spy();
  watcher.unwatch = sinon.spy();
  return watcher;
}

function generateFakeConnections(fakeWs, count) {
  var clients = [];

  for (var i = 0; i < count; ++i) {
    clients[i] = createFakeClient();

    fakeWs.emit('connection', clients[i]);
  }
  return clients;
}