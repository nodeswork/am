import * as request      from 'request-promise';
import * as Router       from 'koa-router';
import * as Koa          from 'Koa';
import * as url          from 'url';
import * as httpProxy    from 'http-proxy';
import * as http         from 'http';
import * as pathToRegexp from 'path-to-regexp';

import * as logger       from '@nodeswork/logger';

import { AppletManager } from './applet-manager';

const LOG = logger.getLogger();

export class Application extends Koa {
  appletManager: AppletManager;
}

export const app: Application = new Application();

const router     = new Router();
const version    = require('../package.json').version;
const proxy      = httpProxy.createProxyServer({
});

const appletRouter = new Router();

appletRouter
  .all(/(.*)/, async (ctx: Router.IRouterContext) => {

    // console.log('uri', uri.toString());
    // await new Promise((resolve, reject) => {
    // });

    // try {
      // const resp = await proxy({
        // headers:                  {
          // 'X-ROUTE-TO':           'INTERNAL',
        // },
        // method:                   ctx.request.method,
        // uri:                      uri.toString(),
        // resolveWithFullResponse:  true,
      // });
      // transformResponse(resp, ctx);
    // } catch (e) {
      // transformResponse(e.response, ctx);
    // }
  })
;

router
  .get('/sstats', sstats)
  .use('/applets/:packageName/v/:version', appletRouter.routes(), appletRouter.allowedMethods())
;

app
  .use(router.routes())
  .use(router.allowedMethods())
;

const routerPathRegex = pathToRegexp('/applets/:packageName/v/:version/:path*');
const callback = app.callback();
const httpServerCallback = async function(
  req: http.IncomingMessage, res: http.ServerResponse,
) {
  const path = url.parse(req.url);
  const result = routerPathRegex.exec(path.pathname);
  if (result != null) {
    const route = await app.appletManager.route({
      packageName:  result[1],
      version:      result[2],
    });

    if (route != null) {
      req.url = result[3] || '';
      req.headers['X-TO-APPLET'] = route;
      proxy.web(req, res, {
        target:      'http://localhost:28320',
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

  console.log('path', path, result);
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

function transformResponse(resp: any, ctx: Router.IRouterContext) {
  ctx.status = resp.statusCode || 500;
  if (resp.body) {
    console.log(resp);
    ctx.body = resp.body;
  }
}
