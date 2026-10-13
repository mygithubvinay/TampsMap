import { useState, useRef, useEffect, lazy, Suspense } from "react";
import "../css/style.scss";

import "@esri/calcite-components/components/calcite-icon";
import "@esri/calcite-components/components/calcite-switch";
import "@arcgis/map-components/components/arcgis-feature-table";

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Extent from "@arcgis/core/geometry/Extent";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

import GeoSync from "../icons/GeoSync.png";
import Map from "./map";
import SearchWidget from "./searchMap";
import { findLayerByTitles, getMainMapView } from "../utils/mapView";

// Lazy-load selection widget so SketchViewModel is not available in initial loading
const SelectionWidget = lazy(() => import("./selectMapStructures"));

type RemovableHandle = { remove: () => void };

const DEFAULT_SELECTION_SYMBOL = new SimpleFillSymbol({
  color: [0, 120, 255, 0.2],
  outline: {
    color: [255, 255, 255],
    width: 2,
  },
});

const WIDGET_LOADERS: Record<string, () => Promise<unknown>> = {
  coordinates: () =>
    import("@arcgis/map-components/components/arcgis-coordinate-conversion"),
  bookmarks: () =>
    import("@arcgis/map-components/components/arcgis-bookmarks"),
  basemap: () =>
    import("@arcgis/map-components/components/arcgis-basemap-gallery"),
  legend: () => import("@arcgis/map-components/components/arcgis-legend"),
  distance: () =>
    import("@arcgis/map-components/components/arcgis-distance-measurement-2d"),
  area: () =>
    import("@arcgis/map-components/components/arcgis-area-measurement-2d"),
};

function Page() {
  const [showResults, setShowResults] = useState(true);
  const [activeWidget, setActiveWidget] = useState("");
  const [widgetReady, setWidgetReady] = useState("");
  const [showSelectionWidget, setShowSelectionWidget] = useState(false);
  const [selectedObjectIds, setSelectedObjectIds] = useState<number[]>([]);
  const [featureLayer, setFeatureLayer] = useState<FeatureLayer | null>(null);
  const [defaultSelection, setDefaultSelection] = useState(true);

  const highlightHandle = useRef<RemovableHandle | null>(null);
  const featureTableRef = useRef<any>(null);

  // Lazy-register ArcGIS widget custom elements only when opened
  useEffect(() => {
    if (!activeWidget) {
      setWidgetReady("");
      return;
    }

    let cancelled = false;
    const loader = WIDGET_LOADERS[activeWidget];

    if (!loader) return;

    loader().then(() => {
      if (!cancelled) setWidgetReady(activeWidget);
    });

    return () => {
      cancelled = true;
    };
  }, [activeWidget]);

  useEffect(() => {
    const table = featureTableRef.current;
    if (!table) return;

    if (featureLayer) {
      table.layer = featureLayer;
    }

    table.objectIds = selectedObjectIds as any;
  }, [featureLayer, selectedObjectIds]);

  useEffect(() => {
    let cancelled = false;

    const clearDefaultSelection = async () => {
      const view = await getMainMapView();
      if (cancelled || !view?.map) return;

      highlightHandle.current?.remove();
      highlightHandle.current = null;

      const graphicsLayer = view.map.findLayerById(
        "default-selection",
      ) as GraphicsLayer | undefined;
      graphicsLayer?.removeAll();

      setSelectedObjectIds([]);
    };

    if (defaultSelection) {
      loadDefaultSelection(() => cancelled);
    } else {
      clearDefaultSelection();
    }

    return () => {
      cancelled = true;
    };
  }, [defaultSelection]);

  const loadDefaultSelection = async (isCancelled: () => boolean) => {
    const view = await getMainMapView();
    if (isCancelled() || !view?.map) return;

    const layer = await findLayerByTitles(view.map, "SupportStructures");

    if (isCancelled() || !layer) return;

    setFeatureLayer(layer);

    let graphicsLayer = view.map.findLayerById(
      "default-selection",
    ) as GraphicsLayer | undefined;

    if (!graphicsLayer) {
      graphicsLayer = new GraphicsLayer({
        id: "default-selection",
        listMode: "hide",
      });
      view.map.add(graphicsLayer);
    }

    graphicsLayer.removeAll();

    const result = await layer.queryFeatures({
      where: "OBJECTID < 50",
      outFields: ["OBJECTID"],
      returnGeometry: true
    });

    if (isCancelled() || result.features.length === 0) return;

    const layerView = await view.whenLayerView(layer);
    if (isCancelled()) return;

    highlightHandle.current?.remove();
    highlightHandle.current = layerView.highlight(result.features);

   /*  setSelectedObjectIds(
      result.features.map(
        (f: Graphic) => f.attributes.OBJECTID as number,
      ),
    ); */

    let xmin = Infinity;
    let ymin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;

    for (const feature of result.features) {
      const point = feature.geometry as Point | null;
      if (!point) continue;

      xmin = Math.min(xmin, point.x);
      ymin = Math.min(ymin, point.y);
      xmax = Math.max(xmax, point.x);
      ymax = Math.max(ymax, point.y);
    }

    if (!Number.isFinite(xmin)) return;

    if (xmin === xmax) {
      xmin -= 100;
      xmax += 100;
    }

    if (ymin === ymax) {
      ymin -= 100;
      ymax += 100;
    }

    const combinedExtent = new Extent({
      xmin,
      ymin,
      xmax,
      ymax,
      spatialReference: view.spatialReference,
    }).expand(1.3);

    // adding combined rectangle graphic on graphic layer 
    graphicsLayer.add(
      new Graphic({
        geometry: combinedExtent,
        symbol: DEFAULT_SELECTION_SYMBOL,
      }),
    );
  };

  const handleClear = () => {
    const mapEl = document.getElementById("main-map") as any;
    mapEl?.view?.graphics?.removeAll();

    (document.querySelector("arcgis-distance-measurement-2d") as any)?.clear?.();
    (document.querySelector("arcgis-area-measurement-2d") as any)?.clear?.();

    setShowSelectionWidget(false);
    setActiveWidget("");
  };

  const openSelectionWidget = () => {
    setActiveWidget("");
    setShowSelectionWidget((open) => !open);
  };

  const toggleWidget = (widget: string) => {
    setShowSelectionWidget(false);
    setActiveWidget((current) => (current === widget ? "" : widget));
  };

  return (
    <div className="page-container">
      <header className="header">
        <div className="logo-section">
          <img src={GeoSync} alt="Logo" className="logo-image" />
          <strong>TAMS MAP</strong>
        </div>

        <div className="search-toolbar">
          <SearchWidget />

          <button className="icon-btn" onClick={openSelectionWidget}>
            <calcite-icon icon="cursor" scale="s" />
          </button>

          <button className="icon-btn">
            <calcite-icon icon="reset" scale="s" />
          </button>

          <div className="toggle-container">
            <calcite-switch
              checked={defaultSelection}
              oncalciteSwitchChange={(e: any) =>
                setDefaultSelection(e.target.checked)
              }
            />
          </div>
        </div>

        <div className="user-section">
          <span>VinayGsi</span>
          <span>About</span>
          <calcite-icon icon="user" scale="m" />
        </div>
      </header>

      <div className="content-container">
        <div className="map-container">
          <Map />

          {showSelectionWidget && (
            <Suspense fallback={null}>
              <SelectionWidget
                onLayerReady={setFeatureLayer}
                onSelectionChange={setSelectedObjectIds}
                onClose={() => setShowSelectionWidget(false)}
              />
            </Suspense>
          )}

          <div className="map-toolbar">
            <button
              className="tool-btn"
              title="Google Maps"
              onClick={() => {
                setShowSelectionWidget(false);
                const mapEl = document.getElementById(
                  "main-map",
                ) as HTMLArcgisMapElement | null;
                const center = mapEl?.view?.center;
                if (!center) return;

                window.open(
                  `https://www.google.com/maps?q=${center.latitude},${center.longitude}`,
                  "_blank",
                );
              }}
            >
              <calcite-icon icon="map" />
            </button>

            <button
              className="tool-btn"
              title="Street View"
              onClick={() => {
                setShowSelectionWidget(false);
                window.open(
                  "https://www.google.com/maps/@?api=1&map_action=pano",
                  "_blank",
                );
              }}
            >
              <calcite-icon icon="person" />
            </button>

            <button
              className="tool-btn"
              title="Coordinates"
              onClick={() => toggleWidget("coordinates")}
            >
              <calcite-icon icon="gps-on" />
            </button>

            <button
              className="tool-btn"
              title="Bookmarks"
              onClick={() => toggleWidget("bookmarks")}
            >
              <calcite-icon icon="star" />
            </button>

            <button
              className="tool-btn"
              title="Basemap"
              onClick={() => toggleWidget("basemap")}
            >
              <calcite-icon icon="basemap" />
            </button>

            <button
              className="tool-btn"
              title="Legend"
              onClick={() => toggleWidget("legend")}
            >
              <calcite-icon icon="legend" />
            </button>

            <button
              className="tool-btn"
              title="Measure Polygon"
              onClick={() => toggleWidget("area")}
            >
              <calcite-icon
                icon="polygon-vertices"
                style={{ transform: "rotate(90deg)" }}
              />
            </button>

            <button
              className="tool-btn"
              title="Measure Line"
              onClick={() => toggleWidget("distance")}
            >
              <calcite-icon
                icon="line-straight"
                style={{ transform: "rotate(90deg)" }}
              />
            </button>

            <button className="tool-btn" title="Clear" onClick={handleClear}>
              <calcite-icon icon="erase" />
            </button>
          </div>

          {activeWidget && widgetReady === activeWidget && (
            <div className="widget-panel">
              {activeWidget === "coordinates" && (
                <arcgis-coordinate-conversion reference-element="main-map" />
              )}
              {activeWidget === "bookmarks" && (
                <arcgis-bookmarks reference-element="main-map" />
              )}
              {activeWidget === "basemap" && (
                <arcgis-basemap-gallery reference-element="main-map" />
              )}
              {activeWidget === "legend" && (
                <arcgis-legend reference-element="main-map" />
              )}
              {activeWidget === "distance" && (
                <arcgis-distance-measurement-2d reference-element="main-map" />
              )}
              {activeWidget === "area" && (
                <arcgis-area-measurement-2d reference-element="main-map" />
              )}
            </div>
          )}
        </div>

        <div
          className={`results-handle${!showResults ? " collapsed" : ""}`}
          onClick={() => setShowResults((show) => !show)}
        >
          <div className="handle-arrow">
            <span className="arrow-icon"></span>
          </div>
        </div>

        <div
          className={`results-container${!showResults ? " collapsed" : ""}`}
        >
          <div className="feature-count"></div>

          <div className="table-wrapper">
            <arcgis-feature-table ref={featureTableRef}></arcgis-feature-table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
