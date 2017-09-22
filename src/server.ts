import * as request      from 'request-promise';
import * as Router       from 'koa-router';
import * as Koa          from 'Koa';
import * as url          from 'url';

import { AppletManager } from './applet-manager';

export class Application extends Koa {
  appletManager: AppletManager;
}

export const app: Application = new Application();

const router = new Router();
const version = require('../package.json').version;
const proxy = request.defaults({
  proxy: 'http://localhost:28320',
});

const appletRouter = new Router();

appletRouter
  .all(/(.*)/, async (ctx: Router.IRouterContext) => {
    const route = await app.appletManager.route({
      packageName:  ctx.params.packageName as string,
      version:      ctx.params.version as string,
    });

    if (route == null) {
      ctx.status = 404;
      return;
    }

    const uri = new url.URL('/' + ctx.params[0], route);

    try {
      const resp = await proxy({
        headers:                  {
          'X-ROUTE-TO':           'INTERNAL',
        },
        method:                   ctx.request.method,
        uri:                      uri.toString(),
        resolveWithFullResponse:  true,
      });
      transformResponse(resp, ctx);
    } catch (e) {
      transformResponse(e.response, ctx);
    }
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
    ctx.body = resp.body;
  }
}
