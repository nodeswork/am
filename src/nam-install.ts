#!/usr/bin/env node

import * as commander from 'commander';

import { AppletManager, AppletImage } from './applet-manager';

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
  const targets: AppletImage[] = [];
  for (const target of commander.args) {
    const [appletPackage, version] = target.split('@');
    if (appletPackage == null || version == null) {
      console.error('invalid target', target);
      process.exit(1);
    }
    targets.push({
      naType: 'npm',
      naVersion: '8.3.0',
      appletPackage,
      version,
    });
  }

  for (const target of targets) {
    await appletManager.install(target);
    console.log(
      `install applet ${target.appletPackage}@${target.version} sucessfully`
    );
  }
})();
