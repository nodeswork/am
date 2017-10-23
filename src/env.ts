import * as os                     from 'os';

const arch = os.arch();

export let DOCKER_NODE_REPO:     string;
export let DOCKER_MONGODB_REPO:  string;

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
