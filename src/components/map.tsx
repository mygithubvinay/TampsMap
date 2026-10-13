import { memo } from "react";
import "@arcgis/map-components/components/arcgis-map";
import { config } from "../config";

/** Loads the configured webmap (layers + initial extent from the item). */
function Map() {
  return (
    <arcgis-map
      id="main-map"
      item-id={config.webMapId}
      style={{
        height: "100%",
        width: "100%",
      }}
    ></arcgis-map>
  );
}

export default memo(Map);
