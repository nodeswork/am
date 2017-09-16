export namespace nam {

  export const socketRpcEventNamePrefix = 'socket-rpc.device';

  export interface AppletImage {
    naType:         string;
    naVersion:      string;
    packageName:    string;
    version:        string;
  }

  export interface AppletStatus extends AppletImage {
    port:           number;
    status:         string;
  }

  export interface RequestOptions {
    packageName:               string;
    version:                   string;
    uri:                       string;
    method:                    string;
    body?:                     object;
    headers?:                  { [key: string]: string };
    resolveWithFullResponse?:  boolean;
  }

  export interface RequestResponse {
    statusCode:                number;
    headers?:                  { [key: string]: string };
    body:                      object;
  }

  export interface INAM {

    install(options: AppletImage): Promise<void>;

    images(): Promise<AppletImage[]>;

    run(options: AppletImage): Promise<void>;

    ps(): Promise<AppletStatus[]>;

    request<T>(options: RequestOptions): Promise<RequestResponse | T>;
  }
}
