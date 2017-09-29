import * as Router           from 'koa-router';
import * as Koa              from 'Koa';
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

export const app: Application = new Application();

const router     = new Router();
const version    = require('../package.json').version;
const proxy      = httpProxy.createProxyServer({
});

router
  .get('/sstats', sstats)
  .post('/accounts/:accountId/operate', async (ctx) => {
    const appletId = ctx.request.get(applet.constants.headers.request.APPLET_ID);
    if (appletId == null) {
      throw NodesworkError.badRequest('applet id is missing');
    }

    const operateOptions = {
      accountId: ctx.params.accountId,
      appletId,
      body: ctx.body,
    };

    ctx.body = await app.appletManager.operateAccount(operateOptions);
  })
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
  LOG.info('Receiving request', {
    url: req.url,
    method: req.method,
    headers: req.headers,
  });

  const path = url.parse(req.url);
  const result = routerPathRegex.exec(path.pathname);
  if (result != null) {
    const route = await app.appletManager.route({
      packageName:  result[1],
      version:      result[2],
    });

    const newPath = result[3] || '';

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
