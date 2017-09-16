import * as request      from 'request-promise';
import * as Router       from 'koa-router';
import * as Koa          from 'Koa';

import { AppletManager } from './applet-manager';

export class Application extends Koa {
  appletManager: AppletManager;
}

export const app: Application = new Application();

const router = new Router();
const version = require('../package.json').version;

const appletRouter = new Router();

appletRouter
  .all(/(.*)/, async (ctx: Router.IRouterContext) => {
    const route = await app.appletManager.route({
      packageName: ctx.params.packageName,
      version: ctx.params.version,
    });

    if (route == null) {
      ctx.status = 404;
      return;
    }

    try {
      const resp = await request({
        method: ctx.request.method,
        baseUrl: route,
        uri: ctx.params[0],
        resolveWithFullResponse: true,
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
