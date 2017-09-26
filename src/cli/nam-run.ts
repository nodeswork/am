#!/usr/bin/env node

import * as commander          from 'commander';

import { nam }                 from '../def';

import { createAppletManager } from './cli-command';

commander
  .parse(process.argv)

const appletManager = createAppletManager();

(async () => {
  const targets: nam.AppletImage[] = [];
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
