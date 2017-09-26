import * as _            from 'underscore';
import * as fs           from 'fs-extra';
import * as path         from 'path';
import * as commander    from 'commander';

import { appPath }       from '../paths';
import { AppletManager } from '../applet-manager';

const srcCommander = new commander.Command();

srcCommander
  .option('--app-path [path]')
  .option('--nodeswork-server [url]')
  .option('--port [port]')
  .option('--debug')
;

const DEFAULT_OPTIONS = {
  appPath,
  nodesworkServer: 'http://api.nodeswork.com',
  port: 28310,
};

commander
  .option('--config [path]', 'load options from config path')
  .option('--app-path [path]', 'override the app home path')
  .option('--nodeswork-server [url]', 'nodeswork server')
  .option(
    '--port [port]', 'the port nam listens to, defaults to 28310', (x) => {
      return parseInt(x);
    }
  )
  .option('--debug', 'run in debug mode')
;

export function createAppletManager(): AppletManager {
  const options = extractCommonOptions();
  return new AppletManager(options);
}

export function extractCommonOptions(): CommonOptions {
  const extraParams = [['fakePath', 'fakeCmd']];
  extraParams.push(loadFromPath('~/.namrc'));
  if (commander.config) {
    extraParams.push(loadFromPath(commander.config));
  }
  const params = _.flatten(extraParams)
  srcCommander.parse(params);

  const result = _.extend(
    {},
    DEFAULT_OPTIONS,
    _.pick(srcCommander, 'port', 'debug', 'nodesworkServer', 'appPath'),
    _.pick(commander, 'port', 'debug', 'nodesworkServer', 'appPath'),
  );
  return result;
}

export interface CommonOptions {
  appPath:          string;
  nodesworkServer:  string;
  port:             number;
  debug?:           boolean;
}

function loadFromPath(filePath: string): string[] {
  let expandedPath: string;
  if (filePath.startsWith('~')) {
    expandedPath = path.join(process.env.HOME, filePath.slice(1));
  } else {
    expandedPath = filePath;
  }
  if (fs.existsSync(expandedPath)) {
    const params: string[] =
      fs.readFileSync(expandedPath).toString().split('\n')
      .join(' ').split(' ')
    ;
    return _.filter(params, (x) => x as any as boolean);
  }
  return [];
}
