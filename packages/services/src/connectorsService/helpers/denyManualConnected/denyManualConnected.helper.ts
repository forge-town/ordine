/**
 * create/update must never set status to connected by hand — only a real
 * handshake (connect) may mark a connector connected (prevents fake-online state).
 */
export const denyManualConnected = <T extends { status?: string | null }>(data: T): T =>
  data.status === "connected" ? { ...data, status: "needs_setup" } : data;
