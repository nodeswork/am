import * as Socket       from 'socket.io-client';

import * as logger       from '@nodeswork/logger';
import * as sbase        from '@nodeswork/sbase';

import { AppletManager } from './applet-manager';

import { nam }           from './def';

import * as errors       from './errors';

const LOG = logger.getLogger();

export function connectSocket(
  nodesworkServer:  string,
  token:            string,
  appletManager:    AppletManager,
) {
  const url = `${nodesworkServer}/device`;
  const socket = Socket(url, { query: `token=${token}`});

  LOG.info('Connecting to socket server', { url });

  sbase.socket.socketRpcHost(
    socket, appletManager, nam.socketRpcEventNamePrefix,
  );

  socket
    .on('connect', () => {
      LOG.info('Device socket is connected.');
    })
    .on('error', (msg: string) => {
      switch (msg) {
        case 'token is invalid':
          throw errors.UNAUTHENTICATED_ERROR;
        default:
          LOG.error('Socket connection error', msg);
      }
    })
    .on('connect_failed', () => {
      LOG.error('Device socket connects failed');
    })
    .on('connect_error', () => {
      // Connection lost.
      LOG.error('Device socket connection lost');
    })
    .on('disconnect', function() {
      LOG.error('Device socket disconnected', arguments);
    })
  ;
}
