import type Map from "@arcgis/core/Map";
import type MapView from "@arcgis/core/views/MapView";
import type GroupLayer from "@arcgis/core/layers/GroupLayer";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type Layer from "@arcgis/core/layers/Layer";
import type Collection from "@arcgis/core/core/Collection";

/** Resolve the main map view after the webmap (layers + extent) has loaded. */
export async function getMainMapView(): Promise<MapView | null> {
  const mapEl = document.getElementById("main-map") as HTMLArcgisMapElement | null;
  if (!mapEl) return null;

  await mapEl.viewOnReady();
  const view = (mapEl.view as MapView | undefined) ?? null;
  if (!view?.map) return null;

  // Wait for webmap item so initial extent and operational layers are applied
  await (view.map as any).load();
  const portalItem = (
    view.map as Map & { portalItem?: { load(): Promise<unknown> } }
  ).portalItem;
  if (portalItem) {
    await portalItem.load();
  }
  await view.when();

  return view;
}

/** Recursively search layers and nested sublayers for a matching title. */
async function findLayerInCollection(
  layers: Collection<Layer>,
  layerTitle: string,
): Promise<FeatureLayer | null> {
  for (const layer of layers) {
    await layer.load();

    if (layer.title === layerTitle) {
      return layer as FeatureLayer;
    }

    if (layer.type === "group") {
      const groupLayer = layer as GroupLayer;
      const nested = await findLayerInCollection(groupLayer.layers, layerTitle);
      if (nested) return nested;
    }
  }

  return null;
}

/** Find a layer by title anywhere in the map (including nested group sublayers). */
export async function findLayerByTitles(
  map: Map,
  layerTitle: string,
): Promise<FeatureLayer | null> {
  await (map as any).load();
  return findLayerInCollection(map.layers, layerTitle);
}
