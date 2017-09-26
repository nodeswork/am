#!/usr/bin/env node

import * as commander    from 'commander';

import { createAppletManager } from './cli-command';

commander
  .parse(process.argv)

const appletManager = createAppletManager();

(async () => {
  console.log(await appletManager.ps());
})();
