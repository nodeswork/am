import * as crypto           from 'crypto';
import * as _                from 'underscore';
import * as fs               from 'fs';
import * as os               from 'os';
import * as path             from 'path';
import * as request          from 'request-promise';
import { Docker }            from 'docker-cli-js';
import { CronJob }           from 'cron';
import * as uuid             from 'uuid/v5';

import * as sbase            from '@nodeswork/sbase';
import * as logger           from '@nodeswork/logger';
import { NodesworkError }    from '@nodeswork/utils';
import * as applet           from '@nodeswork/applet';

import * as errors           from './errors';
import {
  findPort,
  localStorage,
  LocalStorage,
  sleep,
}                            from './utils';
import { app, server }       from './server';
import { connectSocket }     from './socket';
import { nam }               from './def';
import { containerProxyUrl } from './paths';

import compareVersion = require('compare-version');

const latestVersion: (p: string) => Promise<string> = require('latest-version');
const LOG = logger.getLogger();
const APPLET_MANAGER_KEY = 'appletManager';

const containerVersion = require('../package.json').version;
const isRunning: (pid: number) => boolean = require('is-running');
const machineId: () => string = require('node-machine-id').machineIdSync;
const UUID_NAMESPACE = '5daabcd8-f17e-568c-aa6f-da9d92c7032c';

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
  dev?:             boolean;

  // Automatically load or generated.
  pid?:             number;
  token?:           string;
}

export class AppletManager implements nam.INAM {

  ls:              LocalStorage;
  docker:          Docker = new Docker();
  network:         Network;
  containerProxy:  ContainerProxy;
  cronJobs:        WorkerCronJob[] = [];

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
  async startServer() {
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
    server.listen(this.options.port);
    connectSocket(this.options.nodesworkServer, this.options.token, this);
    LOG.info(`Server is started at http://localhost:${this.options.port}`);
    await this.updateDevice();
  }

  /**
   * Stop the container.
   *
   * @throws UNAUTHENTICATED_ERROR
   */
  async stopServer() {
    // Stop the applet manager.
    if (this.options.pid) {
      process.kill(this.options.pid);
      this.options.pid = null;
      await sleep(1000);
    }
  }

  async install(options: nam.AppletImage) {
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

  async images(): Promise<nam.AppletImage[]> {
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

  async run(options: nam.AppletRunOptions) {
    await this.checkEnvironment();

    const uniqueName = this.name(options);

    const rmCmd = `rm ${uniqueName}`;
    LOG.debug('Execute command to rm applet', { cmd: rmCmd });
    try {
      const docker = new Docker();
      const result = await docker.command(rmCmd);
      LOG.debug('Execute build command log', result);
    } catch (e) {
      LOG.debug('Container does not exist');
    }

    const image = imageName(options);
    const cmd = `run --name ${uniqueName} --network nodeswork -d -e ${applet.constants.environmentKeys.APPLET_ID}=${options.appletId} -e ${applet.constants.environmentKeys.APPLET_TOKEN}=${options.appletToken} ${image}`;

    LOG.debug('Execute command to run applet', { cmd });

    try {
      const docker = new Docker();
      const result = await docker.command(cmd);
      LOG.debug('Execute run command result', result);
      await this.updateDevice();
    } catch (e) {
      LOG.error('Execute run command failed', e);
      throw e;
    }
  }

  async kill(options: nam.AppletImage) {
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

  async ps(): Promise<nam.AppletStatus[]> {
    await this.checkEnvironment();

    const psResult = await this.docker.command('ps');
    const psApplets = _.chain(psResult.containerList)
      .map((container) => {
        const image = parseAppletImage(container.image);
        if (image == null) {
          return null;
        }
        const port = parseMappingPort(container.ports) || 28900;
        return _.extend(
          image,
          {
            port,
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

  async refreshWorkerCrons() {
    const self = this;
    try {
      const userApplets = await request.get({
        headers:             {
          'device-token':    this.options.token,
        },
        baseUrl:             this.options.nodesworkServer,
        uri:                 '/v1/d/user-applets',
        json:                true,
        jar:                 true,
      });
      const newJobs: WorkerCronJob[] = _
        .chain(userApplets)
        .map((ua) => {
          const appletConfig = ua.config.appletConfig;
          const image: nam.AppletImage = {
            naType: appletConfig.naType,
            naVersion: appletConfig.naVersion,
            packageName: appletConfig.packageName,
            version: appletConfig.version,
          };
          return _.map(appletConfig.workers, (workerConfig: any) => {
            const worker: nam.Worker = {
              handler: workerConfig.handler,
              name: workerConfig.name,
            };
            return {
              jobUUID: uuid([
                ua.applet._id,
                ua._id,
                image.naType,
                image.naVersion,
                image.packageName,
                image.version,
                worker.handler,
                worker.name,
              ].join(':'), UUID_NAMESPACE),
              appletId:    ua.applet._id,
              userApplet:  ua._id,
              image,
              worker,
              schedule:    workerConfig.schedule,
            };
          });
        })
        .flatten()
        .filter((x) => x.schedule != null)
        .value();

      LOG.debug('Fetch applets for current device successfully');

      for (const cron of this.cronJobs) {
        const u = _.find(newJobs, (newJob) => newJob.jobUUID === cron.jobUUID);
        if (u == null) {
          cron.cronJob.stop();
          LOG.info(
            'Stop cron job successfully', _.omit(cron, 'cronJob'),
          );
        }
      }
      for (const newJob of newJobs) {
        const cron = _.find(this.cronJobs, (c) => newJob.jobUUID === c.jobUUID);
        if (cron == null) {
          const cronJob = (function (c: WorkerCronJob): WorkerCronJob {
            try {
              c.cronJob = new CronJob({
                cronTime: c.schedule,
                onTick: async () => {
                  LOG.debug('Run cron job', _.omit(c, 'cronJob'));
                  try {
                    await self.executeCronJob(c);
                    LOG.info(
                      'Run cron job successfully', _.omit(c, 'cronJob'),
                    );
                  } catch (e) {
                    LOG.error(
                      'Run cron job failed', e, _.omit(c, 'cronJob'),
                    );
                  }
                },
                start: true,
              });
            } catch (e) {
              LOG.error('Create cron job failed', _.omit(c, 'cronJob'));
            }
            LOG.info('Create cron job successfully', _.omit(c, 'cronJob'));
            return c;
          })(newJob);
          this.cronJobs.push(cronJob);
        }
      }
    } catch (e) {
      throw e;
    }
  }

  async executeCronJob(job: WorkerCronJob): Promise<any> {
    try {
      const accounts = await request.get({
        headers:             {
          'device-token':    this.options.token,
        },
        baseUrl:             this.options.nodesworkServer,
        uri:                 `/v1/d/user-applets/${job.userApplet}/accounts`,
        json:                true,
        jar:                 true,
      });
      LOG.debug('Fetch accounts successfully', accounts);
      const payload = {
        accounts,
      };
      const result = await this.work({
        route:          {
          appletId:     job.appletId,
          naType:       job.image.naType,
          naVersion:    job.image.naVersion,
          packageName:  job.image.packageName,
          version:      job.image.version,
        },
        worker:         job.worker,
        payload,
      });
      LOG.info(
        'Execute cron job successfully.', {
          job: _.omit(job, 'cronJob'),
          result,
        },
      );
    } catch (e) {
      throw e;
    }
  }

  async work(options: nam.WorkOptions): Promise<any> {
    LOG.debug('Get work request', options);
    const requestOptions: nam.RequestOptions = {
      appletId:     options.route.appletId,
      naType:       options.route.naType,
      naVersion:    options.route.naVersion,
      packageName:  options.route.packageName,
      version:      options.route.version,
      uri:          `/workers/${options.worker.handler}/${options.worker.name}`,
      method:       'POST',
      body:         options.payload,
    };
    return await this.request(requestOptions);
  }

  async request<T>(
    options: nam.RequestOptions,
  ): Promise<nam.RequestResponse | T> {
    LOG.info('Get request', { options });
    const routeAddress = await this.route(options);
    if (routeAddress == null) {
      throw new NodesworkError('Applet is not running');
    }

    const headers = _.extend({}, options.headers);
    headers[sbase.constants.headers.request.NODESWORK_FORWARDED_TO] = (
      routeAddress.route
    );
    const requestOptions = {
      uri:      routeAddress.target + options.uri,
      method:   options.method,
      proxy:    routeAddress.target,
      body:     options.body,
      headers,
      json:     true,
    };
    LOG.debug('Request options', requestOptions);
    const resp = await request(requestOptions);
    LOG.debug('Request response', resp);
    return resp;
  }

  async operateAccount(options: nam.AccountOperateOptions): Promise<any> {
    const requestOptions = {
      uri:               `/v1/d/applets/${options.appletId}/accounts/${options.accountId}/operate`,
      baseUrl:           this.options.nodesworkServer,
      body:              options.body,
      headers:           {
        'device-token':  this.options.token,
      },
      json:              true,
      jar:               true,
    };
    return await request.post(requestOptions);
  }

  async route(options: nam.RouteOptions): Promise<nam.Route> {
    if (this.options.dev) {
      try {
        const devServer = await request({
          uri:   'http://localhost:28900/sstats',
          json:  true,
        });
        if (devServer.applet &&
          devServer.applet.packageName === options.packageName &&
          compareVersion(devServer.applet.packageVersion, options.version) >= 0) {
          return {
            route: 'localhost:28900',
            target: 'http://localhost:28900',
          };
        }
      } catch (e) {
        // Fallback
      }
    }

    return {
      route: `${this.name(options)}:28900`,
      target: containerProxyUrl,
    };
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
    await this.refreshWorkerCrons();
  }

  async checkEnvironment() {
    // Step 1: Check network configuration
    const networks = await this.docker.command('network ls');
    const targetNetwork = _.find(
      networks.network, (c: any) => c.name === 'nodeswork',
    );

    if (targetNetwork == null) {
      LOG.debug('network is not setup, creating');
      await this.docker.command('network create nodeswork');
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

  private name(options: nam.RouteOptions): string {
    return `na-${options.naType}-${options.naVersion}-${options.packageName}_${options.version}-${options.appletId}`;
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
      // sudo ifconfig lo0 alias 172.16.222.111
      await this.docker.command(`run --name nodeswork-container-proxy -d -e NAM_HOST=172.16.222.111:28310 -e SUB_NET=${this.network.subnet} -p 28320:28320 nodeswork-container-proxy:${version}`);
    } catch (e) {
      LOG.debug('Remove container proxy error', e);
    }

    this.containerProxy = { version, latestVersion: version };
  }
}

function imageName(image: nam.AppletImage): string {
  return `na-${image.naType}-${image.naVersion}-${image.packageName}\
:${image.version}`;
}

function parseAppletImage(imageName: string): nam.AppletImage {
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

export interface WorkerCronJob {
  jobUUID:     string;
  userApplet:  string;
  appletId:    string;
  image:       nam.AppletImage;
  worker:      nam.Worker;
  schedule:    string;
  cronJob?:    CronJob;
}
