#!/usr/bin/env node

var commander     = require('commander');
var WatchRemotely = require('./index');

var paths       = null;
var options     = null;
var remoteWatch = null;

commander
  .version('0.1.0')
  .usage('[options] <paths ...>')
  .option('-P, --port <port>', 'Port for web socket server')
  .option('-H, --host <host>', 'Host for web socket server')
  .option('-b, --base-path <basePath>', 'Base path')
  .option('-r, --relative-paths', 'Use relative paths (relative to <basePath)')
  .option('-c, --with-contents', 'Send "add" and "change" events with file contents')
  .option('-i, --ignored <path>', 'Ignore watching specified files')
  .parse(process.argv);

paths   = commander.args;
options = { ws: {}, watcher: {} };

if (!paths.length) {
  paths = [process.cwd()];
}

// Well, it's not so nice. But one of the main purposes of this package is hot module replacement.
// I think we should think pragmatically.
options.watcher.ignored = [process.cwd() + '/jspm_packages'];

if ('host' in commander) {
  options.ws.host = commander.host;
}
if ('port' in commander) {
  options.ws.port = commander.port;
}

if ('basePath' in commander) {
  options.basePath = commander.basePath;
}
if ('relativePaths' in commander) {
  options.relativePaths = commander.relativePaths;
}
if ('withContents' in commander) {
  options.withContents = commander.withContents;
}
if ('ignored' in commander) {
  options.watcher.ignored.push(commander.ignored);
}

remoteWatch = new WatchRemotely(paths, options);
remoteWatch.run();
