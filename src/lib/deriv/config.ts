/**
 * All Deriv endpoints live here so auth/API changes only need one edit.
 * Verified against api.deriv.com (WebSocket v3, OAuth2 authorize flow).
 */
export const DERIV_CONFIG = {
  /** Public WebSocket endpoint. Tokens travel browser → Deriv only. */
  wsUrl: process.env.NEXT_PUBLIC_DERIV_WS_URL ?? "wss://ws.derivws.com/websockets/v3",
  /** Registered application id; falls back to Deriv's public playground id. */
  appId: process.env.NEXT_PUBLIC_DERIV_APP_ID ?? "1089",
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
