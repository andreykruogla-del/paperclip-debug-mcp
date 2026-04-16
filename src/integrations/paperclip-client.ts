type PaperclipClientOptions = {
  baseUrl?: string;
  token?: string;
};

export type PaperclipConnection = {
  baseUrl: string;
  token: string;
  enabled: boolean;
};

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
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Paperclip API ${response.status} for ${path}: ${body.slice(0, 240)}`);
    }

    return response.json();
  }

  public async getFirst(paths: string[]): Promise<{ payload: unknown; path: string }> {
    let lastError: string | undefined;
    for (const path of paths) {
      try {
        const payload = await this.get(path);
        return { payload, path };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }
    throw new Error(lastError ?? "No working Paperclip endpoint variant found.");
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
