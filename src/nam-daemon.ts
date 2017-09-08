#!/usr/bin/env node

import * as commander from 'commander';

import { AppletManager } from './applet-manager';

import './cli-command';

let cmd: string;

commander
  .arguments('<cmd>')
  .action((c) => {
    cmd = c;
  })
  .parse(process.argv)

if (cmd == null) {
  console.error('no command given!');
  process.exit(1);
}

if (cmd !== 'start' && cmd !== 'stop' && cmd != 'restart') {
  console.error('command should be either start, stop, or restart!');
  process.exit(1);
}

const appletManager = new AppletManager({
  appPath:          commander.appPath,
  nodesworkServer:  commander.nodesworkServer,
  port:             commander.port,
  debug:            commander.debug,
});

(async () => {
  switch (cmd) {
    case 'start':
      await appletManager.start();
      break;
    case 'stop':
      await appletManager.stop();
      break;
    case 'restart':
      await appletManager.stop();
      await appletManager.start();
      break;
  }
})();
