import * as os            from 'os';

import * as logger        from '@nodeswork/logger';

const arch = os.arch();
const LOG  = logger.getLogger();

export let DOCKER_NODE_REPO:           string;
export let DOCKER_MONGODB_REPO:        string;
export let DEFAULT_NA:                 string = 'npm';
export let DEFAULT_NA_VERSION:         string = '8.7.0';
export let SUPPORTED_NA_NPM_VERSIONS:  string[] = [
  '8.3.0',
  '8.7.0',
];

switch (arch) {
  case 'arm':
    DOCKER_NODE_REPO = 'arm32v7/node';
    DOCKER_MONGODB_REPO = 'mangoraft/mongodb-arm';
    break;
  case 'arm64':
    DOCKER_NODE_REPO = 'arm64v8/node';
    DOCKER_MONGODB_REPO = 'ip4368/mongo-arm64';
    break;
  // case 'x64':
    // DOCKER_NODE_REPO = 'node';
    // break;
  default:
    DOCKER_NODE_REPO = 'node';
    DOCKER_MONGODB_REPO = 'mongo';
}

LOG.debug('Environment', {
  DOCKER_NODE_REPO,
  DOCKER_MONGODB_REPO,
  DEFAULT_NA,
  DEFAULT_NA_VERSION,
  SUPPORTED_NA_NPM_VERSIONS,
});
