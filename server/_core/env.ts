import { env } from "./config";

export const ENV = {
  appId: env.VITE_APP_ID ?? "",
  cookieSecret: env.JWT_SECRET,
  databaseUrl: env.DATABASE_URL,
  oAuthServerUrl: env.OAUTH_SERVER_URL,
  ownerOpenId: env.OWNER_OPEN_ID,
  isProduction: env.NODE_ENV === "production",
  forgeApiUrl: env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: env.BUILT_IN_FORGE_API_KEY ?? "",
  // Catalog semantic matching uses DeepSeek directly. Keep the legacy key
  // fallback temporarily so existing deployments do not need to duplicate secrets.
  deepSeekApiUrl: env.DEEPSEEK_API_URL?.trim() || "https://api.deepseek.com",
  deepSeekApiKey:
    env.DEEPSEEK_API_KEY?.trim() || env.BUILT_IN_FORGE_API_KEY?.trim() || "",
  anthropicApiKey: env.ANTHROPIC_API_KEY ?? "",
};
