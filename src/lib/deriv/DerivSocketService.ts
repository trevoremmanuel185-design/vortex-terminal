import type { z } from "zod";
import { DERIV_CONFIG } from "./config";
import { baseMessageSchema, safeParseMessage } from "./schemas";
import type { ConnectionStatus, LatencyListener, StatusListener } from "./types";

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  schema: z.ZodType<unknown>;
  label: string;
}

interface StreamEntry {
  key: number;
  payload: Record<string, unknown>;
  schema: z.ZodType<unknown>;
  handler: (data: unknown) => void;
  onError?: (message: string) => void;
  remoteReqId?: number;
}

type Listener<T> = (value: T) => void;

/**
 * Typed singleton around the Deriv WebSocket API.
 *
 * Guarantees:
 *  - monotonic `req_id` correlation with per-request timeouts
 *  - Zod validation of every inbound frame
 *  - ordered authorize → subscribe restoration after a reconnect
 *  - subscription bookkeeping with `forget` cleanup (no orphan streams)
 *  - tokens held in memory only; never logged, never sent to our backend
 */
export class DerivSocketService {
  private static instance: DerivSocketService | null = null;

  static getInstance(): DerivSocketService {
    if (!DerivSocketService.instance) DerivSocketService.instance = new DerivSocketService();
    return DerivSocketService.instance;
  }

  private socket: WebSocket | null = null;
  private statusValue: ConnectionStatus = "offline";
  private reqCounter = 1;
  private streamCounter = 1;
  private pending = new Map<number, PendingRequest>();
  private streams = new Map<number, StreamEntry>();
  private registry = new Map<number, StreamEntry>();
  private token: string | null = null;
  private openPromise: Promise<void> | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private manualClose = false;
  private latencyMs = 0;
  private statusListeners = new Set<StatusListener>();
  private latencyListeners = new Set<Listener<number>>();
  private protocolListeners = new Set<Listener<string>>();

  get status(): ConnectionStatus {
    return this.statusValue;
  }

  get latency(): number {
    return this.latencyMs;
  }

  get url(): string {
    return DERIV_CONFIG.wsUrl;
  }

  get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.statusValue);
    return () => this.statusListeners.delete(cb);
  }

  onLatency(cb: Listener<number>): () => void {
    this.latencyListeners.add(cb);
    cb(this.latencyMs);
    return () => this.latencyListeners.delete(cb);
  }

  onProtocolError(cb: Listener<string>): () => void {
    this.protocolListeners.add(cb);
    return () => this.protocolListeners.delete(cb);
  }

  private setStatus(status: ConnectionStatus) {
    this.statusValue = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private setLatency(ms: number) {
    this.latencyMs = Math.round(ms);
    for (const cb of this.latencyListeners) cb(this.latencyMs);
  }

  private nextReqId(): number {
    this.reqCounter += 1;
    return this.reqCounter;
  }

  private transmit(payload: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Socket is not open");
    }
    this.socket.send(JSON.stringify(payload));
  }

  /** Stores the token in memory only. Never persisted by this service. */
  setToken(token: string | null) {
    this.token = token?.trim() || null;
  }

  hasCredentials(): boolean {
    return Boolean(this.token);
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    if (this.openPromise) return this.openPromise;
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      throw new Error("WebSocket is unavailable in this environment");
    }
    this.manualClose = false;
    const promise = new Promise<void>((resolve, reject) => {
      this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");
      let settled = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(DERIV_CONFIG.wsUrl);
      } catch (err) {
        this.setStatus("error");
        reject(err instanceof Error ? err : new Error("Unable to open socket"));
        return;
      }
      this.socket = ws;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.openPromise = null;
        this.setStatus("error");
        try {
          ws.close();
        } catch {
          /* noop */
        }
        reject(new Error("Deriv connection timed out"));
      }, DERIV_CONFIG.requestTimeoutMs);

      ws.onopen = () => {
        clearTimeout(timer);
        this.reconnectAttempt = 0;
        settled = true;
        this.openPromise = null;
        this.setStatus(this.token ? "authorizing" : "connected");
        this.startHeartbeat();
        void this.restoreSession().finally(() => {
          this.setStatus("connected");
        });
        resolve();
      };

      ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          this.openPromise = null;
          this.setStatus("error");
          reject(new Error("Deriv WebSocket error"));
        }
      };

      ws.onclose = () => {
        clearTimeout(timer);
        this.stopHeartbeat();
        for (const [, pending] of this.pending) {
          clearTimeout(pending.timer);
          pending.reject(new Error("Connection closed before response"));
        }
        this.pending.clear();
        this.streams.clear();
        if (this.manualClose) {
          this.setStatus("offline");
          return;
        }
        this.setStatus("reconnecting");
        this.scheduleReconnect();
      };
    });
    this.openPromise = promise;
    try {
      await promise;
    } finally {
      this.openPromise = null;
    }
  }

  /** Authorize (if a token is held) then re-issue every registered stream. */
  private async restoreSession(): Promise<void> {
    if (this.token) {
      try {
        const reqId = this.nextReqId();
        this.transmit({ authorize: this.token, req_id: reqId });
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            this.pending.delete(reqId);
            resolve();
          }, DERIV_CONFIG.requestTimeoutMs);
          this.pending.set(reqId, {
            resolve: () => {
              clearTimeout(timer);
              resolve();
            },
            reject: () => {
              clearTimeout(timer);
              resolve();
            },
            timer,
            schema: baseMessageSchema,
            label: "reauthorize",
          });
        });
      } catch {
        this.setStatus("error");
      }
    }
    // Deliberate: only re-establish streams. No queued trade is ever replayed,
    // so a reconnect cannot duplicate a purchase.
    for (const entry of this.registry.values()) {
      try {
        this.openStream(entry);
      } catch {
        /* retried by caller on next status change */
      }
    }
  }

  private scheduleReconnect() {
    if (this.manualClose || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const { baseMs, maxMs, jitterMs } = DERIV_CONFIG.reconnect;
    const backoff = Math.min(maxMs, baseMs * 2 ** (this.reconnectAttempt - 1));
    const delay = backoff + Math.random() * jitterMs;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => this.scheduleReconnect());
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected) return;
      const started = performance.now();
      void this.request({ ping: 1 }, baseMessageSchema, 5_000)
        .then(() => this.setLatency(performance.now() - started))
        .catch(() => {
          try {
            this.socket?.close();
          } catch {
            /* noop */
          }
        });
    }, DERIV_CONFIG.heartbeatMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private handleMessage(raw: unknown) {
    let json: unknown;
    try {
      json = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      for (const cb of this.protocolListeners) cb("Received malformed JSON from Deriv");
      return;
    }
    const envelope = safeParseMessage(baseMessageSchema, json);
    if (!envelope.ok) {
      for (const cb of this.protocolListeners) cb(`Schema rejected frame: ${envelope.error}`);
      return;
    }
    const message = envelope.data;
    const reqId = message.req_id;

    if (message.error) {
      const label = `${message.error.code}: ${message.error.message}`;
      if (typeof reqId === "number") {
        const pending = this.pending.get(reqId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(reqId);
          pending.reject(new Error(label));
        }
        const stream = this.streams.get(reqId);
        stream?.onError?.(label);
      } else {
        this.setStatus("error");
      }
      return;
    }

    if (typeof reqId !== "number") return;

    const stream = this.streams.get(reqId);
    if (stream) {
      const parsed = safeParseMessage(stream.schema, json);
      if (parsed.ok) stream.handler(parsed.data);
      else stream.onError?.(parsed.error);
    }

    const pending = this.pending.get(reqId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pending.delete(reqId);
      const parsed = safeParseMessage(pending.schema, json);
      if (parsed.ok) pending.resolve(parsed.data);
      else pending.reject(new Error(`Invalid ${pending.label} response: ${parsed.error}`));
    }
  }

  private async ensureOpen(): Promise<void> {
    if (this.isConnected) return;
    await this.connect();
    if (!this.isConnected) throw new Error("Not connected to Deriv");
  }

  async request<T>(
    payload: Record<string, unknown>,
    schema: z.ZodType<T>,
    timeoutMs: number = DERIV_CONFIG.requestTimeoutMs,
  ): Promise<T> {
    await this.ensureOpen();
    const reqId = this.nextReqId();
    const label = String(payload.msg_type ?? Object.keys(payload)[0] ?? "request");
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(reqId);
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
      this.pending.set(reqId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
        schema: schema as z.ZodType<unknown>,
        label,
      });
      try {
        this.transmit({ ...payload, req_id: reqId });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(reqId);
        reject(err instanceof Error ? err : new Error("Unable to transmit request"));
      }
    });
  }

  private openStream(entry: StreamEntry) {
    const reqId = this.nextReqId();
    if (entry.remoteReqId) this.streams.delete(entry.remoteReqId);
    entry.remoteReqId = reqId;
    this.streams.set(reqId, entry);
    this.transmit({ ...entry.payload, req_id: reqId });
  }

  /** Observable-style subscription with automatic restore + forget cleanup. */
  subscribe<T>(
    payload: Record<string, unknown>,
    schema: z.ZodType<T>,
    handler: (data: T) => void,
    onError?: (message: string) => void,
  ): () => void {
    const key = this.streamCounter++;
    const entry: StreamEntry = {
      key,
      payload,
      schema: schema as z.ZodType<unknown>,
      handler: handler as (data: unknown) => void,
      onError,
    };
    this.registry.set(key, entry);
    if (this.isConnected) this.openStream(entry);
    else void this.connect().catch(() => undefined);

    return () => {
      this.registry.delete(key);
      if (entry.remoteReqId) {
        const id = entry.remoteReqId;
        this.streams.delete(id);
        if (this.isConnected) {
          try {
            this.transmit({ forget: id });
          } catch {
            /* noop */
          }
        }
      }
    };
  }

  forgetAll(): void {
    if (!this.isConnected) return;
    try {
      this.transmit({ forget_all: "ticks" });
      this.transmit({ forget_all: "proposal" });
      this.transmit({ forget_all: "proposal_open_contract" });
      this.transmit({ forget_all: "balance" });
    } catch {
      /* noop */
    }
    this.registry.clear();
    this.streams.clear();
  }

  disconnect(): void {
    this.manualClose = true;
    this.token = null;
    this.registry.clear();
    this.streams.clear();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Disconnected"));
    }
    this.pending.clear();
    try {
      this.socket?.close();
    } catch {
      /* noop */
    }
    this.socket = null;
    this.openPromise = null;
    this.setStatus("offline");
  }
}

export const derivSocket = DerivSocketService.getInstance();
