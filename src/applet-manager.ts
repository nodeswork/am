import * as crypto        from 'crypto';
import * as _             from 'underscore';
import * as fs            from 'fs';
import * as os            from 'os';
import * as path          from 'path';
import * as request       from 'request-promise';

import * as logger        from '@nodeswork/logger';
import { NodesworkError } from '@nodeswork/utils';

import * as errors        from './errors';
import {
  localStorage,
  LocalStorage,
}                         from './utils';

const LOG = logger.getLogger();
const APPLET_MANAGER_KEY = 'appletManager';

const containerVersion = require('../package.json').version;
const isRunning: (pid: number) => boolean = require('is-running');
const machineId: () => string = require('node-machine-id').machineIdSync;

export interface AppletManagerOptions {
  appPath:          string;
  nodesworkServer:  string;
  port:             number;
  debug?:           boolean;

  // Automatically load or generated.
  pid?:             number;
  token?:           string;
}

export class AppletManager {

  ls:     LocalStorage;

  constructor(private options: AppletManagerOptions) {
    if (this.options.debug) {
      LOG.level = 'debug';
    }

    const configPath = path.join(options.appPath, 'config.json');

    LOG.debug('Load configuration from configPath', configPath);

    this.ls          = localStorage(configPath);

    let amOptions    = this.ls.getItemSync(APPLET_MANAGER_KEY);
    let running      = false;

    if (amOptions == null) {
      amOptions = this.options;
      LOG.debug('Initialize Applet Manager Options to local:', amOptions);
      this.ls.setItemSync(APPLET_MANAGER_KEY, amOptions);
    } else {
      LOG.debug('Got Applet Manager Options from local:', amOptions);
      if (amOptions.pid) {
        running = isRunning(amOptions.pid);
      }
      this.options.token = amOptions.token;
    }

    if (running && (this.options.appPath !== amOptions.appPath ||
      this.options.nodesworkServer !== amOptions.nodesworkServer ||
      this.options.port !== amOptions.port)) {
      throw new NodesworkError(
        'Configuration does not match with existing Applet Manager',
        {
          newOption:      this.options,
          runningOption:  _.pick(
            amOptions, 'appPath', 'nodesworkServer', 'port'
          ),
        },
      );
    }

    if (running) {
      this.options.pid    = amOptions.pid;
      this.options.token  = amOptions.token;
    }
  }

  authenticated(): boolean {
    return this.options.token != null;
  }

  /**
   * Authenticate the container by email and password.
   *
   * @throws UNAUTHENTICATED_ERROR
   */
  async authenticate(
    options: { email: string, password: string, deviceName: string },
  ): Promise<void> {
    try {
      const resp = await request.post({
        baseUrl:     this.options.nodesworkServer,
        uri:         '/v1/u/user/login',
        body:        {
          email:     options.email,
          password:  options.password,
        },
        json:        true,
        jar:         true,
      });
      LOG.debug('Login successfully');
    } catch (e) {
      if (e.name === 'RequestError') {
        throw new NodesworkError('Server is not available', {
          path: this.options.nodesworkServer + '/v1/u/user/login',
        }, e);
      } else if (e.statusCode === 401) {
        throw new NodesworkError('Wrong password');
      } else if (e.statusCode === 422) {
        throw new NodesworkError('Wrong email');
      } else {
        throw e;
      }
    }

    try {
      const mid = machineId();
      LOG.debug('Got machine id:', mid);

      const deviceIdentifier = crypto.createHash('md5')
        .update(mid)
        .update(options.email)
        .digest('hex');
      let operatingSystem: string = ({
        Darwin:      'MacOS',
        Windows_NT:  'Windows',
        Linux:       'Linux',
      } as any)[os.type()];

      const device = {
        deviceType: 'UserDevice',
        deviceIdentifier,
        os: operatingSystem,
        osVersion: os.release(),
        containerVersion,
        name: options.deviceName,
      };

      LOG.debug('Collected device information:', device);

      const resp = await request.post({
        baseUrl:     this.options.nodesworkServer,
        uri:         '/v1/u/devices',
        body:        device,
        json:        true,
        jar:         true,
      });

      LOG.debug('Device registered successfully', resp);

      this.options.token = resp.token;
      this.ls.setItemSync(APPLET_MANAGER_KEY, this.options);
      LOG.debug('Save token to local', this.options);

      console.log( resp );
    } catch (e) {
      if (e.name === 'RequestError') {
        throw new NodesworkError('Server is not available', {
          path: this.options.nodesworkServer + '/v1/u/user/login',
        }, e);
      } else {
        throw e;
      }
    }
    return;
  }

  /**
   * Start the container.
   *
   * @throws UNAUTHENTICATED_ERROR
   */
  async start() {
  }
}
