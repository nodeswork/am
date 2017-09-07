import * as _           from 'underscore';
import * as NodePersist from 'node-persist';

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
