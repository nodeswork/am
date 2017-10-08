import * as sbase from '@nodeswork/sbase';

import { nam }    from '../def';

@sbase.socket.socketRpcClient({
  eventNamePrefix: nam.socketRpcEventNamePrefix,
  timeoutMillis: 5000,
})
export class NAMSocketRpcClient extends sbase.socket.SocketRpcClient
implements nam.INAM {

  @sbase.socket.remote({
    timeoutMillis: 60000,
  })
  async install(options: nam.AppletImage): Promise<void> {}

  @sbase.socket.remote({})
  async images(): Promise<nam.AppletImage[]> { return null; }

  @sbase.socket.remote({})
  async run(options: nam.AppletRunOptions): Promise<void> {}

  @sbase.socket.remote({})
  async ps(): Promise<nam.AppletStatus[]> { return null; }

  @sbase.socket.remote({
    timeoutMillis: 30000,
  })
  async kill(options: nam.RouteOptions): Promise<void> {}

  @sbase.socket.remote({
    timeoutMillis: 30000,
  })
  async work(options: nam.WorkOptions): Promise<any> {}

  @sbase.socket.remote({
    timeoutMillis: 5000,
  })
  async request<T>(options: nam.RequestOptions):
    Promise<nam.RequestResponse | T> { return null; }
}
