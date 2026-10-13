/**
 * Must be imported before any @arcgis/map-components modules.
 * portalUrl + proxy rules must be set before the Map component loads.
 */
import esriConfig from "@arcgis/core/config";
import * as urlUtils from "@arcgis/core/core/urlUtils";
import { config } from "../config";

esriConfig.portalUrl = config.portalUrl;

// Dev: same-origin Vite proxy (avoids CORS). Prod: Azure proxy URL.
//const proxyUrl = import.meta.env.DEV ? "/api/proxy" : config.proxy.proxyUrl;
const proxyUrl =  config.proxy.proxyUrl;

for (const urlPrefix of config.proxy.urlPrefixes) {
  urlUtils.addProxyRule({
    urlPrefix,
    proxyUrl,
  });
}
