import * as crypto        from 'crypto';
import * as _             from 'underscore';
import * as fs            from 'fs';
import * as os            from 'os';
import * as path          from 'path';
import * as request       from 'request-promise';
import { Docker }         from 'docker-cli-js';

import * as logger        from '@nodeswork/logger';
import { NodesworkError } from '@nodeswork/utils';

import * as errors        from './errors';
import {
  findPort,
  localStorage,
  LocalStorage,
  sleep,
}                         from './utils';
import { app }            from './server';
import { connectSocket }  from './socket';

const latestVersion: (p: string) => Promise<string> = require('latest-version');
const LOG = logger.getLogger();
const APPLET_MANAGER_KEY = 'appletManager';

const containerVersion = require('../package.json').version;
const isRunning: (pid: number) => boolean = require('is-running');
const machineId: () => string = require('node-machine-id').machineIdSync;

export interface AuthOptions {
  email:       string;
  password:    string;
  deviceName:  string;
}

export interface AppletManagerOptions {
  appPath:          string;
  nodesworkServer:  string;
  port:             number;
  debug?:           boolean;

  // Automatically load or generated.
  pid?:             number;
  token?:           string;
}

export interface AppletRunOptions extends AppletImage {
  port?:          number;
}

export interface AppletImage {
  naType:         string;
  naVersion:      string;
  packageName:    string;
  version:        string;
}

export interface AppletStatus extends AppletImage {
  port:           number;
  status:         string;
}

export interface RouteOptions {
  packageName:  string;
  version:        string;
}

export class AppletManager {

  ls:              LocalStorage;
  docker:          Docker = new Docker();
  network:         Network;
  containerProxy:  ContainerProxy;

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
    } else {
      this.options.pid    = null;
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
  async authenticate(options: AuthOptions): Promise<void> {
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

      await this.updateDevice();
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

  isStarted(): boolean {
    return this.options.pid != null;
  }

  /**
   * Start the container.
   *
   * @throws UNAUTHENTICATED_ERROR
   */
  async start() {
    if (this.options.pid != null) {
      console.log('daemon has already started');
      return;
    }

    if (this.options.token == null) {
      throw errors.UNAUTHENTICATED_ERROR;
    }

    await this.checkEnvironment();

    // Start the applet manager.
    this.options.pid = process.pid;
    this.ls.setItemSync(APPLET_MANAGER_KEY, this.options);
    app.appletManager = this;
    app.listen(this.options.port);
    connectSocket(this.options.nodesworkServer, this.options.token, this);
    LOG.info(`Server is started at http://localhost:${this.options.port}`);
    await this.updateDevice();
  }

  /**
   * Stop the container.
   *
   * @throws UNAUTHENTICATED_ERROR
   */
  async stop() {
    // Stop the applet manager.
    if (this.options.pid) {
      process.kill(this.options.pid);
      this.options.pid = null;
      await sleep(1000);
    }
  }

  async install(options: AppletImage) {
    const docker = new Docker();
    const cmd = `build -t ${imageName(options)} --build-arg package=${options.packageName} --build-arg version=${options.version} docker/${options.naType}/${options.naVersion}`;

    LOG.debug('Execute command to install applet', { cmd });
    try {
      const result = await docker.command(cmd);
      LOG.debug('Execute build command log', result);
      await this.updateDevice();
    } catch (e) {
      throw e;
    }
  }

  async images(): Promise<AppletImage[]> {
    const docker = new Docker();
    const images = await docker.command('images');
    return _.chain(images.images)
      .filter((image) => {
        const [na, naType, naVersion, ...others] = image.repository.split('-');
        return na === 'na' && (
          naType === 'npm'
        ) && (
          naVersion === '8.3.0'
        );
      })
      .map((image) => {
        const [na, naType, naVersion, ...others] = image.repository.split('-');
        return {
          naType,
          naVersion,
          packageName: others.join('-'),
          version: image.tag,
        };
      })
      .value();
  }

  async run(options: AppletRunOptions) {
    await this.checkEnvironment();

    if (options.port == null) {
      options.port = await findPort();
      LOG.debug('Find a free port to run', options.port);
    }

    const uniqueName = `na-npm-${options.packageName}_${options.version}`;

    const rmCmd = `rm ${uniqueName}`;
    LOG.debug('Execute command to run applet', { cmd: rmCmd });
    try {
      const docker = new Docker();
      const result = await docker.command(rmCmd);
      LOG.debug('Execute build command log', result);
    } catch (e) {
      LOG.debug('Container does not exist');
    }

    const image = imageName(options);
    const cmd = `run --name ${uniqueName} --network nodeswork -d -p ${options.port}:28900 ${image}`;

    LOG.debug('Execute command to run applet', { cmd });

    try {
      const docker = new Docker();
      const result = await docker.command(cmd);
      LOG.debug('Execute build command log', result);
      await this.updateDevice();
    } catch (e) {
      throw e;
    }
  }

  async kill(options: AppletRunOptions) {
    const uniqueName = `na-npm-${options.packageName}_${options.version}`;
    const cmd = `stop ${uniqueName}`;

    LOG.debug('Execute command to run applet', { cmd });

    try {
      const docker = new Docker();
      const result = await docker.command(cmd);
      LOG.debug('Execute build command log', result);
      await this.updateDevice();
    } catch (e) {
      throw e;
    }
  }

  async ps(): Promise<AppletStatus[]> {
    await this.checkEnvironment();

    const psResult = await this.docker.command('ps');
    const psApplets = _.chain(psResult.containerList)
      .map((container) => {
        const image = parseAppletImage(container.image);
        if (image == null) {
          return null;
        }
        const port = parseMappingPort(container.ports);
        return _.extend(
          image,
          {
            port: port,
            status: container.status,
          },
        );
      })
      .filter(_.identity)
      .value();

    const networkResults = Object.values((
      await this.docker.command('network inspect nodeswork')
    ).object[0].Containers);

    return _.filter(psApplets, (psApplet) => {
      const appletName = `na-${psApplet.naType}-${psApplet.packageName}_${psApplet.version}`
      const networkResult = _.find(networkResults, (result) => {
        return result.Name === appletName;
      });

      if (networkResult == null) {
        LOG.warn(
          `Applet ${appletName} is running but not in the correct network`,
        );
        return false;
      }
      psApplet.ip = networkResult.IPv4Address.split('/')[0];
      return true;
    });
  }

  async route(options: RouteOptions): Promise<string> {
    const statuses = await this.ps();
    const appletStatus: AppletStatus = _.find(
      statuses,
      (s) => (
        s.packageName === options.packageName &&
        s.version === options.version
      ),
    );
    return appletStatus && `http://localhost:${appletStatus.port}`;
  }

  async updateDevice() {
    if (this.options.token == null) {
      throw errors.UNAUTHENTICATED_ERROR;
    }

    const installedApplets = await this.images();
    const runningApplets = await this.ps();

    try {
      const resp = await request.post({
        headers:             {
          'device-token':    this.options.token,
        },
        baseUrl:             this.options.nodesworkServer,
        uri:                 '/v1/d/devices',
        body:                {
          installedApplets,
          runningApplets,
        },
        json:                true,
        jar:                 true,
      });
      LOG.debug('Update device successfully');
    } catch (e) {
      throw e;
    }
  }

  async checkEnvironment() {
    // Step 1: Check network configuration
    const networks = await this.docker.command('network ls');
    const targetNetwork = _.find(
      networks.network, (c: any) => c.name === 'nodeswork',
    );

    if (targetNetwork == null) {
      LOG.debug('network is not setup, creating');
      await this.docker.command('network create nodeswork --internal');
    }

    const inspect = await this.docker.command('network inspect nodeswork');
    LOG.debug('inspecting network', inspect.object[0]);

    const IPAMConfig = inspect.object[0].IPAM.Config[0];

    this.network = {
      subnet:      IPAMConfig.Subnet,
      gateway:     IPAMConfig.Gateway,
      containers:  inspect.object[0].Containers,
    };

    LOG.debug('Network configuration', this.network);

    // Step 2: Check pre installed containers
    // Step 2.1: Check proxy container

    const containers = await this.docker.command('ps');
    const proxyContainer = _.find(
      containers.containerList,
      (container: any) => container.names === 'nodeswork-container-proxy',
    );

    if (proxyContainer == null) {
      LOG.debug('Container proxy is not running, starting');
      await this.installContainerProxy();
    } else {
      const version = proxyContainer.image.split(':')[1];
      const lVersion = await latestVersion('@nodeswork/container-proxy');
      this.containerProxy = {
        version,
        latestVersion: lVersion,
      };
    }

    const proxyInNetwork = _.find(this.network.containers, (container: any) => {
      return container.Name === 'nodeswork-container-proxy';
    });

    if (proxyInNetwork == null) {
      LOG.debug('Proxy container is not in network');
      await this.docker.command(`network connect nodeswork nodeswork-container-proxy`);
    }

    LOG.debug('Container Proxy configuration', this.containerProxy);

    LOG.debug('Environment setup correctly');
  }

  private async installContainerProxy() {
    const version = await latestVersion('@nodeswork/container-proxy');
    LOG.debug('Fetched latest version container-proxy', { version });

    const output = await this.docker.command(
      `build -t nodeswork-container-proxy:${version} docker/container-proxy --build-arg version=${version}`,
    );
    LOG.debug('Building container proxy', output);

    try {
      await this.docker.command(`rm nodeswork-container-proxy`);
    } catch (e) {
      LOG.debug('Remove container proxy error', e);
    }

    try {
      await this.docker.command(`run --name nodeswork-container-proxy -d -e NAM_HOST=${os.hostname()} -e SUB_NET=${this.network.subnet} -p 28320:80 nodeswork-container-proxy:${version}`);
    } catch (e) {
      LOG.debug('Remove container proxy error', e);
    }

    this.containerProxy = { version, latestVersion: version };
  }
}

function imageName(image: AppletImage): string {
  return `na-${image.naType}-${image.naVersion}-${image.packageName}\
:${image.version}`;
}

function parseAppletImage(imageName: string): AppletImage {
  const [full, version] = imageName.split(':');
  if (version == null) {
    return null;
  }

  const [na, naType, naVersion, ...rest] = full.split('-');
  if (na !== 'na' || (naType !== 'npm') || (naVersion !== '8.3.0') ||
    rest.length == 0) {
    return null;
  }
  return {
    naType,
    naVersion,
    packageName: rest.join('-'),
    version,
  };
}

function parseMappingPort(ports: string): number {
  return parseInt(ports.split(':')[1]);
}

export interface Network {
  subnet:      string;
  gateway:     string;
  containers:  object[];
}

export interface ContainerProxy {
  version:        string;
  latestVersion:  string;
}
