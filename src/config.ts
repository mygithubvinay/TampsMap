// config.ts
import configData from "../config.json";

interface SearchConfig {
  searchURL: string;
  searchField: string;
  displayField: string;
  placeholder: string;
}

interface ProxyConfig {
  proxyUrl: string;
  urlPrefixes: string[];
}

interface AppConfig {
  webMapId: string;
  portalUrl: string;
  proxy: ProxyConfig;
  search: SearchConfig;
}

export const config: AppConfig = configData;
