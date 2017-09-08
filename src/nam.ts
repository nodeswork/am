#!/usr/bin/env node

import * as commander from 'commander';

import { AppletManager } from './applet-manager';

commander
  .version('1.0')

commander
  .command('auth', 'authenticate for nam')
  .command('applets', 'list installed applets')
  .command('daemon', 'manage the daemon')
  .command('install [package]', 'install an applet')
  .command('run [package]', 'run an applet')
  .command('ps', 'list running applets')
;

commander
  .parse(process.argv);
