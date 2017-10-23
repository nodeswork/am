import * as Router           from 'koa-router';
import * as Koa              from 'koa';
import * as url              from 'url';
import * as httpProxy        from 'http-proxy';
import * as http             from 'http';
import * as pathToRegexp     from 'path-to-regexp';

import * as sbase            from '@nodeswork/sbase';
import * as logger           from '@nodeswork/logger';
import * as applet           from '@nodeswork/applet';
import { NodesworkError }    from '@nodeswork/utils';

import { AppletManager }     from './applet-manager';

const LOG = logger.getLogger();

export class Application extends Koa {
  appletManager: AppletManager;
}

const bodyParser              = require('koa-bodyparser');
export const app: Application = new Application();

const router     = new Router();
const version    = require('../package.json').version;
const proxy      = httpProxy.createProxyServer({
});

router
  .get('/sstats', sstats)
  .post('/executions/:executionId/metrics', async(ctx) => {
    const appletId = ctx.request.get(applet.constants.headers.request.APPLET_ID);
    if (appletId == null) {
      throw NodesworkError.badRequest('applet id is missing');
    }
    ctx.body = await app.appletManager.updateExecutionMetrics(
      ctx.params.executionId, {
        dimensions:  ctx.request.body.dimensions,
        name:        ctx.request.body.name,
        value:       ctx.request.body.value,
      },
    );
  })
  .post('/accounts/:accountId/operate', async (ctx) => {
    const appletId = ctx.request.get(applet.constants.headers.request.APPLET_ID);
    if (appletId == null) {
      throw NodesworkError.badRequest('applet id is missing');
    }

    const operateOptions = {
      accountId: ctx.params.accountId,
      appletId,
      body: ctx.request.body,
    };

    try {
      ctx.body = await app.appletManager.operateAccount(operateOptions);
    } catch (e) {
      if (e.name === 'StatusCodeError') {
        ctx.status = e.statusCode;
        ctx.body   = e.error;
      } else {
        throw e;
      }
    }
  })
;

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
;

const routerPathRegex = pathToRegexp(
  '/applets/:appletId/:naType/:naVersion/:packageName/:version/:path*',
);
const callback = app.callback();
const httpServerCallback = async function(
  req: http.IncomingMessage, res: http.ServerResponse,
) {
  LOG.info('Receiving request', {
    url:      req.url,
    method:   req.method,
    headers:  req.headers,
  });

  const path = url.parse(req.url);
  const result = routerPathRegex.exec(path.pathname);
  if (result != null) {
    const appletId:     string = result[1];
    const naType:       string = result[2];
    const naVersion:    string = result[3];
    const packageName:  string = result[4];
    const version:      string = result[5];
    const newPath:      string = result[6] || '';

    const route = await app.appletManager.route({
      appletId, naType, naVersion, packageName, version,
    });
    LOG.debug('Got routes', route);

    if (newPath === 'sstruct') {
      const origin = req.headers.origin;
      if (origin != null) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }

    if (route != null) {
      req.url                     = newPath;
      req.headers[sbase.constants.headers.request.NODESWORK_FORWARDED_TO] = (
        route.route
      );
      proxy.web(req, res, {
        target:       route.target,
        xfwd:         true,
        toProxy:      true,
      }, (e) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        const message = 'Routing Error in nam.'
        res.end(message);
        console.error(message, e);
      });
      return;
    } else {
      LOG.warn('Route not found', { path: result[0] });
    }
  }
  callback(req, res);
};

export const server = http.createServer(httpServerCallback);

async function sstats(ctx: Router.IRouterContext) {
  ctx.body = {
    app: {
      name: 'nam',
      version,
    },
    applets: {
      status: await app.appletManager.ps(),
    },
  };
}
