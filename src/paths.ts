import * as os            from 'os';
import * as path          from 'path';

import { NodesworkError } from '@nodeswork/utils';

export let appPath: string;
export const containerProxyUrl = 'http://localhost:28320';

switch (os.type()) {
  case 'Darwin':
    appPath = path.join(
      process.env.HOME,
      'Library/Application Support/Nodeswork',
    );
    break;
  default:
    throw new NodesworkError('unkown os type');
}
