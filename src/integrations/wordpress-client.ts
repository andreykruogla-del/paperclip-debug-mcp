import { redactSensitiveText } from "../core/redaction.js";

type WordPressClientOptions = {
  baseUrl?: string;
  username?: string;
  appPassword?: string;
};

export type WordPressHealth = {
  baseUrl: string;
  reachable: boolean;
  restApiAvailable: boolean;
  xmlrpcEnabled?: boolean;
  authChecked: boolean;
  authOk?: boolean;
  restError?: string;
  authError?: string;
  xmlrpcError?: string;
};

function trimBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "");
}

function basicAuthHeader(username: string, appPassword: string): string {
  const raw = `${username}:${appPassword}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

export class WordPressClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly appPassword: string;

  public constructor(options?: WordPressClientOptions) {
    this.baseUrl = trimBaseUrl(options?.baseUrl ?? process.env.WORDPRESS_BASE_URL);
    this.username = (options?.username ?? process.env.WORDPRESS_USERNAME ?? "").trim();
    this.appPassword = (options?.appPassword ?? process.env.WORDPRESS_APP_PASSWORD ?? "").trim();
  }

  public isEnabled(): boolean {
    return this.baseUrl.length > 0;
  }

  public hasAuth(): boolean {
    return this.username.length > 0 && this.appPassword.length > 0;
  }

  public async checkHealth(): Promise<WordPressHealth> {
    const result: WordPressHealth = {
      baseUrl: this.baseUrl,
      reachable: false,
      restApiAvailable: false,
      authChecked: this.hasAuth()
    };

    if (!this.isEnabled()) {
      return result;
    }

    try {
      const restResponse = await fetch(`${this.baseUrl}/wp-json/`, { method: "GET" });
      result.reachable = restResponse.ok;
      result.restApiAvailable = restResponse.ok;
      if (!restResponse.ok) {
        const body = await restResponse.text();
        result.restError = redactSensitiveText(`REST ${restResponse.status}: ${body.slice(0, 180)}`);
      }
    } catch (error: unknown) {
      result.restError = redactSensitiveText(error instanceof Error ? error.message : String(error));
      return result;
    }

    try {
      const xmlrpcResponse = await fetch(`${this.baseUrl}/xmlrpc.php`, { method: "GET" });
      result.xmlrpcEnabled = xmlrpcResponse.status === 200 || xmlrpcResponse.status === 405;
      if (!xmlrpcResponse.ok && xmlrpcResponse.status !== 405) {
        const body = await xmlrpcResponse.text();
        result.xmlrpcError = redactSensitiveText(`XMLRPC ${xmlrpcResponse.status}: ${body.slice(0, 180)}`);
      }
    } catch (error: unknown) {
      result.xmlrpcError = redactSensitiveText(error instanceof Error ? error.message : String(error));
    }

    if (this.hasAuth()) {
      try {
        const authResponse = await fetch(`${this.baseUrl}/wp-json/wp/v2/users/me`, {
          method: "GET",
          headers: {
            Authorization: basicAuthHeader(this.username, this.appPassword)
          }
        });
        result.authOk = authResponse.ok;
        if (!authResponse.ok) {
          const body = await authResponse.text();
          result.authError = redactSensitiveText(`AUTH ${authResponse.status}: ${body.slice(0, 180)}`);
        }
      } catch (error: unknown) {
        result.authOk = false;
        result.authError = redactSensitiveText(error instanceof Error ? error.message : String(error));
      }
    }

    return result;
  }
}
