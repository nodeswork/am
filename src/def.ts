export namespace nam {

  export const socketRpcEventNamePrefix = 'socket-rpc.device';

  export interface AppletImage {
    naType:         string;
    naVersion:      string;
    packageName:    string;
    version:        string;
  }

  export interface AppletRunOptions extends AppletImage {
    appletId:       string;
    appletToken:    string;
  }

  export interface AppletStatus extends AppletImage {
    appletId:       string;
    ip:             string;
    port:           number;
    status:         string;
  }

  export interface RouteOptions extends AppletImage {
    appletId:  string;
  }

  export interface Route {
    route:   string;
    target:  string;
  }

  export interface RequestOptions extends RouteOptions {
    uri:                       string;
    method:                    string;
    body?:                     object;
    headers?:                  { [key: string]: string };
    resolveWithFullResponse?:  boolean;
  }

  export interface WorkOptions {
    userApplet:  string;
    route:       RouteOptions;
    worker:      Worker;
    payload:     object;
  }

  export interface RequestResponse {
    statusCode:                number;
    headers?:                  { [key: string]: string };
    body:                      object;
  }

  export interface Worker {
    handler: string;
    name:    string;
  }

  export interface AccountOperateOptions {
    accountId: string;
    appletId:  string;
    body:      string;
  }

  export interface INAM {

    install(options: AppletImage): Promise<void>;

    images(): Promise<AppletImage[]>;

    run(options: AppletRunOptions): Promise<void>;

    ps(): Promise<AppletStatus[]>;

    kill(options: RouteOptions): Promise<void>;

    work(options: WorkOptions): Promise<any>;

    request<T>(options: RequestOptions): Promise<RequestResponse | T>;
  }
}
