type PaperclipClientOptions = {
  baseUrl?: string;
  token?: string;
};

export type PaperclipErrorCategory =
  | "auth_failure"
  | "endpoint_mismatch"
  | "http_error"
  | "connectivity_failure"
  | "unknown";

export type PaperclipConnection = {
  baseUrl: string;
  token: string;
  enabled: boolean;
};

type PaperclipApiErrorParams = {
  category: PaperclipErrorCategory;
  status?: number;
  path?: string;
  responseSnippet?: string;
  attemptedPaths?: string[];
  cause?: unknown;
};

export class PaperclipApiError extends Error {
  public readonly category: PaperclipErrorCategory;
  public readonly status?: number;
  public readonly path?: string;
  public readonly responseSnippet?: string;
  public readonly attemptedPaths?: string[];

  public constructor(message: string, params: PaperclipApiErrorParams) {
    super(message);
    this.name = "PaperclipApiError";
    this.category = params.category;
    this.status = params.status;
    this.path = params.path;
    this.responseSnippet = params.responseSnippet;
    this.attemptedPaths = params.attemptedPaths;
  }
}

export function classifyPaperclipError(error: unknown): {
  category: PaperclipErrorCategory;
  message: string;
  status?: number;
  path?: string;
  attemptedPaths?: string[];
} {
  if (error instanceof PaperclipApiError) {
    return {
      category: error.category,
      message: error.message,
      status: error.status,
      path: error.path,
      attemptedPaths: error.attemptedPaths
    };
  }
  if (error instanceof Error) {
    return {
      category: "unknown",
      message: error.message
    };
  }
  return {
    category: "unknown",
    message: String(error)
  };
}

export function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function toTimestamp(value: string | number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function getPaperclipConnection(options?: PaperclipClientOptions): PaperclipConnection {
  const baseUrl = (options?.baseUrl ?? process.env.PAPERCLIP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const token = (options?.token ?? process.env.PAPERCLIP_TOKEN ?? "").trim();
  return {
    baseUrl,
    token,
    enabled: baseUrl.length > 0 && token.length > 0
  };
}

export class PaperclipApiClient {
  private readonly baseUrl: string;
  private readonly token: string;

  public constructor(options?: PaperclipClientOptions) {
    const connection = getPaperclipConnection(options);
    this.baseUrl = connection.baseUrl;
    this.token = connection.token;
  }

  public isEnabled(): boolean {
    return this.baseUrl.length > 0 && this.token.length > 0;
  }

  public async get(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json"
        }
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new PaperclipApiError(`Paperclip API connectivity failure for ${path}: ${message}`, {
        category: "connectivity_failure",
        path,
        cause: error
      });
    }

    if (!response.ok) {
      const body = await response.text();
      const category: PaperclipErrorCategory =
        response.status === 401 || response.status === 403
          ? "auth_failure"
          : response.status === 404
            ? "endpoint_mismatch"
            : "http_error";
      throw new PaperclipApiError(`Paperclip API ${response.status} for ${path}: ${body.slice(0, 240)}`, {
        category,
        status: response.status,
        path,
        responseSnippet: body.slice(0, 240)
      });
    }

    return response.json();
  }

  public async getFirst(paths: string[]): Promise<{ payload: unknown; path: string }> {
    const errors: PaperclipApiError[] = [];
    for (const path of paths) {
      try {
        const payload = await this.get(path);
        return { payload, path };
      } catch (error: unknown) {
        if (error instanceof PaperclipApiError) {
          errors.push(error);
        } else {
          errors.push(
            new PaperclipApiError(error instanceof Error ? error.message : String(error), {
              category: "unknown",
              path
            })
          );
        }
      }
    }

    const nonEndpointError = errors.find((error) => error.category !== "endpoint_mismatch");
    if (nonEndpointError) {
      throw nonEndpointError;
    }

    throw new PaperclipApiError("No working Paperclip endpoint variant found.", {
      category: "endpoint_mismatch",
      attemptedPaths: paths
    });
  }

  public extractArray<T>(payload: unknown, preferredKeys?: string[]): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (!payload || typeof payload !== "object") return [];

    const record = payload as Record<string, unknown>;
    const keys = preferredKeys ?? ["items", "data", "results", "issues", "comments", "runs", "events"];
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as T[];
    }

    for (const value of Object.values(record)) {
      if (Array.isArray(value)) return value as T[];
    }
    return [];
  }
}
