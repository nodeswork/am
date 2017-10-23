import * as os            from 'os';
import * as path          from 'path';

import * as logger        from '@nodeswork/logger';
import { NodesworkError } from '@nodeswork/utils';

const AppDirectory                = require('appdirectory');
const appDirectory: AppDirectory  = new AppDirectory('Nodeswork');
const LOG                         = logger.getLogger();

export const appPath             = appDirectory.userData();
export const appConfig           = appDirectory.userConfig();
export const appCache            = appDirectory.userCache();
export const appLogs             = appDirectory.userLogs();
export const containerProxyUrl   = 'http://localhost:28320';

LOG.debug('Directory configurations', {
  appPath, appConfig, appCache, appLogs,
});

interface AppDirectory {
  userData():    string;
  userConfig():  string;
  userCache():   string;
  userLogs():    string;
}
