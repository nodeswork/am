import { NodesworkError } from '@nodeswork/utils';

export const UNAUTHENTICATED_ERROR = new NodesworkError(
  'unauthenticated or token expired'
);
