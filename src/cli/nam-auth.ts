#!/usr/bin/env node

import * as commander          from 'commander';

import { AuthOptions }         from '../applet-manager';

import { createAppletManager } from './cli-command';

const prompt = require('prompt');

commander
  .action((x) => {
    console.log('unknown argument:', x);
    process.exit(1);
  })
  .parse(process.argv)

const appletManager = createAppletManager();

const promptSchema = {
  properties: {
    email: {
      pattern: /^[a-zA-Z0-9@.\-]+$/,
      message: 'Enter your email address',
      required: true,
    },
    password: {
      hidden: true,
    },
    deviceName: {
      pattern: /^[a-zA-Z0-9@. \-]+$/,
      message: 'Device name must be only letters, numbers, spaces, or dashes',
      required: true,
    },
  },
};

(async () => {
  const info: AuthOptions = await new Promise((resolve, reject) => {
    prompt.get(promptSchema, (err: any, result: any) => {
      err ? reject(err) : resolve(result);
    });
  }) as any;

  if (!info.deviceName) {
    console.error('device name could not be empty');
  }
  try {
    await appletManager.authenticate(info);
    console.log('authenticate successfully!');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
