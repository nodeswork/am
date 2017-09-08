import * as Router from 'koa-router';
import * as Koa from 'Koa';

import { AppletManager } from './applet-manager';

export class Application extends Koa {
  appletManager: AppletManager;
}

export const app: Application = new Application();

app
  .use((ctx) => {
    ctx.body = { hello: 'world' };
  });
