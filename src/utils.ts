import * as _           from 'underscore';
import * as NodePersist from 'node-persist';

const childProcess  = require('child-process-promise');
const portFinder    = require('portfinder');

export const sleep: (time: number) => Promise<void> = require('sleep-promise');

export type LocalStorage = typeof NodePersist;

export let localStorage: (path: string) => LocalStorage = _.memoize(
  (path: string): LocalStorage => {
    const ls: LocalStorage = (NodePersist as any).create({
      dir: path,
    });
    ls.initSync();
    return ls;
  }
) as any;

export const exec: (cmd: string) => Promise<ChildProcessResult> =
  childProcess.exec;

export interface ChildProcessResult {
  stdout: string;
  stderr: string;
}

export const findPort: () => Promise<number> = portFinder.getPortPromise;

// TODO: Move to utils.

import {
  NodesworkError,
  HTTP_RESPONSE_CASTER,
}                       from '@nodeswork/utils';

NodesworkError.addErrorCaster(HTTP_RESPONSE_CASTER);
