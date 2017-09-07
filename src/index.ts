import { AppletManager } from './applet-manager';

const appletManager = new AppletManager({
  appPath:          '/tmp',
  nodesworkServer:  'http://localhost:3000',
  port:             28130,
  debug:            true,
});

async function test() {
  try {
    if (!appletManager.authenticated()) {
      await appletManager.authenticate({
        email: 'andy@nodeswork.com',
        password: 'asdf1234',
        deviceName: 'MacBook Pro',
      });
    }
  } catch(e) {
    console.error(e);
  }
}

test();
