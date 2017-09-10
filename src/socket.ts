import * as Socket       from 'socket.io-client';

import * as logger       from '@nodeswork/logger';
import * as sbase        from '@nodeswork/sbase';

import { AppletManager } from './applet-manager';

const LOG = logger.getLogger();

export function connectSocket(
  nodesworkServer:  string,
  token:            string,
  appletManager:    AppletManager,
) {
  const url = `${nodesworkServer}/device`;
  const socket = Socket(url, { query: `token=${token}`});

  socket
    .on('connect', () => {
      LOG.info('Device socket is connected.');

      sbase.socket.socketRpcHost(
        socket, appletManager, nam.socketRpcEventNamePrefix,
      );
    });
}
