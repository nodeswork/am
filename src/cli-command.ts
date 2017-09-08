import * as commander from 'commander';

import { appPath }    from './paths';

commander
  .option('--app-path [path]', 'override the app home path', appPath)
  .option('--nodeswork-server [url]', 'nodeswork server', 'http://api.nodeswork.com')
  .option(
    '--port [port]', 'the port nam listens to, defaults to 28310', parseInt,
    28310,
  )
  .option('--debug', 'run in debug mode')
