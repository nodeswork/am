#!/usr/bin/env node

import * as fs           from 'fs-extra';
import * as path         from 'path';
import * as commander    from 'commander';

import { AppletManager } from './applet-manager';

import './cli-command';

let cmd: string;

commander
  .arguments('<cmd>')
  .option('--no-daemon', 'disable daemon mode, direct output to console')
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
    case 'stop':
      await appletManager.stop();
      break;
    case 'restart':
      await appletManager.stop();
    case 'start':
      if (appletManager.isStarted()) {
        console.log('daemon is already started.');
        process.exit(0);
      }

      const logPath = path.join(commander.appPath, 'logs/daemon');
      fs.mkdirpSync(logPath);

      const stdoutLog = path.join(logPath, 'stdout');
      const stderrLog = path.join(logPath, 'stderr');

      if (commander.daemon) {
        require('daemon')({
          stdout: fs.openSync(stdoutLog, 'w'),
          stderr: fs.openSync(stderrLog, 'w'),
        });
      }
      await appletManager.start();
      break;
  }
})();
