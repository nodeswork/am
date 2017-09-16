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
    const [packageName, version] = target.split('@');
    if (packageName == null || version == null) {
      console.error('invalid target', target);
      process.exit(1);
    }
    targets.push({
      naType: 'npm',
      naVersion: '8.3.0',
      packageName,
      version,
    });
  }

  for (const target of targets) {
    await appletManager.run(target);
    console.log(
      `run applet ${target.packageName}@${target.version} sucessfully`
    );
  }
})();
