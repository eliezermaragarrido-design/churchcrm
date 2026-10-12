export function localDevelopmentAccess(environment = process.env.NODE_ENV, enabled = process.env.ALLOW_LOCAL_DEMO) {
  return environment === "development" && enabled !== "false" && !process.env.VERCEL;
}
export function staffIdentityAllowed(user: { email?: string; app_metadata?: Record<string, unknown> } | null, churchId: string) {
  return !!user?.email && user.app_metadata?.crm_staff === true && user.app_metadata?.crm_church_id === churchId;
}
export function publicRoute(path: string) {
  return ["/login", "/privacy", "/terms", "/sms-consent", "/verification", "/public-verification", "/api/auth/login", "/api/auth/logout", "/api/health", "/api/twilio/inbound", "/api/twilio/status", "/api/automation/publish"].includes(path);
}
