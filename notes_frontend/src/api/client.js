//
// Notes Frontend - API Client (Adapter Layer)
//
// This module is the single I/O boundary for HTTP calls.
// It provides consistent error handling, request logging, and cancellation via AbortController.
//

/**
 * @typedef {Object} ApiClientConfig
 * @property {string} baseUrl Base URL for backend API (no trailing slash)
 * @property {(event: {level:'debug'|'info'|'error', op: string, message: string, details?: any}) => void} [logger]
 */

class ApiError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, url?: string, method?: string, body?: any, requestId?: string}} ctx
   */
  constructor(message, ctx = {}) {
    super(message);
    this.name = "ApiError";
    this.status = ctx.status;
    this.url = ctx.url;
    this.method = ctx.method;
    this.body = ctx.body;
    this.requestId = ctx.requestId;
  }
}

const defaultLogger = (event) => {
  // Intentionally concise; detailed context is in `details`.
  // eslint-disable-next-line no-console
  console[event.level === "error" ? "error" : "log"](
    `[api] ${event.op}: ${event.message}`,
    event.details ?? ""
  );
};

/**
 * Best-effort JSON parsing that won't throw.
 * @param {Response} res
 */
async function safeReadJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * @param {ApiClientConfig} config
 */
function createApiClient(config) {
  const logger = config.logger ?? defaultLogger;

  /**
   * Core request helper.
   * Contract:
   * - Inputs: {method, path, jsonBody?, signal?}
   * - Output: parsed JSON (or null), throws ApiError on non-2xx
   * - Errors: ApiError (network/HTTP), DOMException AbortError is propagated
   * - Side effects: performs fetch()
   */
  async function request({ op, method, path, jsonBody, signal }) {
    const url = `${config.baseUrl}${path}`;
    const startedAt = Date.now();

    logger({ level: "debug", op, message: "start", details: { method, url } });

    let res;
    try {
      res = await fetch(url, {
        method,
        headers: jsonBody ? { "Content-Type": "application/json" } : undefined,
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        signal,
      });
    } catch (e) {
      // AbortError should propagate so callers can ignore cancelled requests.
      if (e?.name === "AbortError") throw e;
      logger({
        level: "error",
        op,
        message: "network error",
        details: { method, url, error: String(e) },
      });
      throw new ApiError("Network error while contacting backend.", {
        url,
        method,
      });
    }

    const responseBody = await safeReadJson(res);

    if (!res.ok) {
      logger({
        level: "error",
        op,
        message: "http error",
        details: {
          method,
          url,
          status: res.status,
          body: responseBody,
          ms: Date.now() - startedAt,
        },
      });
      throw new ApiError("Backend request failed.", {
        status: res.status,
        url,
        method,
        body: responseBody,
      });
    }

    logger({
      level: "info",
      op,
      message: "success",
      details: { method, url, status: res.status, ms: Date.now() - startedAt },
    });

    return responseBody;
  }

  return {
    ApiError,

    // PUBLIC_INTERFACE
    async listNotes({ signal } = {}) {
      /** List notes. Returns: Array<Note>. Throws ApiError on failure. */
      return request({ op: "notes.list", method: "GET", path: "/notes", signal });
    },

    // PUBLIC_INTERFACE
    async createNote({ title, content }, { signal } = {}) {
      /** Create note. Input: {title, content}. Returns: Note. Throws ApiError on failure. */
      return request({
        op: "notes.create",
        method: "POST",
        path: "/notes",
        jsonBody: { title, content },
        signal,
      });
    },

    // PUBLIC_INTERFACE
    async updateNote(id, { title, content }, { signal } = {}) {
      /** Update note by id. Returns: Note. Throws ApiError on failure. */
      return request({
        op: "notes.update",
        method: "PUT",
        path: `/notes/${encodeURIComponent(id)}`,
        jsonBody: { title, content },
        signal,
      });
    },

    // PUBLIC_INTERFACE
    async deleteNote(id, { signal } = {}) {
      /** Delete note by id. Returns: {success:boolean}|any. Throws ApiError on failure. */
      return request({
        op: "notes.delete",
        method: "DELETE",
        path: `/notes/${encodeURIComponent(id)}`,
        signal,
      });
    },
  };
}

export { createApiClient, ApiError };
