#!/usr/bin/env node

import * as commander from 'commander';

import { AppletManager } from './applet-manager';

import './cli-command';

commander
  .parse(process.argv)

const appletManager = new AppletManager({
  appPath:          commander.appPath,
  nodesworkServer:  commander.nodesworkServer,
  port:             commander.port,
  debug:            commander.debug,
});

(async () => {
  console.log(await appletManager.ps());
})();
