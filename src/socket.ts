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
  nodesworkServer = 'http://localhost:3000/device'

  const url = `${nodesworkServer}`;
  const socket = Socket(url, { query: `token=${token}`});

  LOG.info('Connecting to socket server', { url });

  socket
    .on('connect', () => {
      LOG.info('Device socket is connected.');

      sbase.socket.socketRpcHost(
        socket, appletManager, nam.socketRpcEventNamePrefix,
      );
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
      LOG.info('Device socket connects failed');
    })
    .on('connect_error', () => {
      // Connection lost.
      LOG.info('Device socket connection lost');
    })
    .on('disconnect', function() {
      LOG.error('Device socket disconnected', arguments);
    })
  ;
}
