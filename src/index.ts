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

  // try {
    // await appletManager.install({
      // naType: 'npm',
      // naVersion: '8.3.0',
      // appletPackage: 'nodeswork-helloworld',
      // version: '0.0.7',
    // });
  // } catch (e) {
    // console.error(e);
  // }

  // try {
    // console.log(await appletManager.images());
  // } catch (e) {
    // console.error(e);
  // }

  // try {
    // await appletManager.run({
      // naType: 'npm',
      // naVersion: '8.3.0',
      // appletPackage: 'nodeswork-helloworld',
      // version: '0.0.7',
    // });
  // } catch (e) {
    // console.error(e);
  // }

  try {
    console.log(await appletManager.ps());
  } catch (e) {
    console.error(e);
  }

}

test();
