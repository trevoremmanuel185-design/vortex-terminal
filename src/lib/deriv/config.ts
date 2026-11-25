/**
 * All Deriv endpoints live here so auth/API changes only need one edit.
 * Verified against api.deriv.com (WebSocket v3, OAuth2 authorize flow).
 */
const APP_ID = (process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089").trim();
const RAW_WS_URL = (process.env.NEXT_PUBLIC_DERIV_WS_URL || "wss://ws.derivws.com/websockets/v3").trim();

/** Deriv rejects a socket that has no app_id, so always make sure it is on the URL. */
function withAppId(url: string, id: string): string {
  if (/[?&]app_id=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}app_id=${encodeURIComponent(id)}`;
}

export const DERIV_CONFIG = {
  /** Public WebSocket endpoint (includes ?app_id=). Tokens travel browser → Deriv only. */
  wsUrl: withAppId(RAW_WS_URL, APP_ID),
  /** Registered application id; falls back to Deriv's public playground id. */
  appId: APP_ID,
  oauthAuthorizeUrl: "https://oauth.deriv.com/oauth2/authorize",
  oauthRedirectPath: "/terminal",
  requestTimeoutMs: 12_000,
  proposalTimeoutMs: 8_000,
  heartbeatMs: 30_000,
  proposalStaleMs: 5_000,
  reconnect: {
    baseMs: 1_000,
    maxMs: 30_000,
    jitterMs: 400,
  },
  /** Scopes the terminal needs. Anything beyond this is a warning. */
  requiredScopes: [
    { id: "read", label: "Read" },
    { id: "trade", label: "Trade" },
    { id: "trading_information", label: "Trading Information" },
  ],
  highRiskScopes: ["payments", "admin"],
  pingIntervalMs: 30_000,
} as const;

export const DERIV_URLS = {
  ws: DERIV_CONFIG.wsUrl,
  oauth: `${DERIV_CONFIG.oauthAuthorizeUrl}?app_id=${encodeURIComponent(DERIV_CONFIG.appId)}`,
  appId: DERIV_CONFIG.appId,
} as const;
