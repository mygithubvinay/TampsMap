import { useEffect, useRef, useState } from "react";

import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import type MapView from "@arcgis/core/views/MapView";
import type Geometry from "@arcgis/core/geometry/Geometry";
import type Graphic from "@arcgis/core/Graphic";

import { findLayerByTitles, getMainMapView } from "../utils/mapView";
import "../css/SelectionWidget.scss";

interface Props {
  onClose: () => void;
  onSelectionChange: (ids: number[]) => void;
  onLayerReady: (layer: FeatureLayer) => void;
}

type RemovableHandle = { remove: () => void };

const SELECTION_SYMBOL = new SimpleFillSymbol({
  color: [0, 120, 255, 0.15],
  outline: {
    color: "#0079c1",
    width: 2,
  },
});

function SelectionWidget({ onClose, onSelectionChange, onLayerReady }: Props) {
  const sketchVM = useRef<SketchViewModel | null>(null);
  const graphicsLayer = useRef<GraphicsLayer | null>(null);
  const selectionLayer = useRef<FeatureLayer | null>(null);
  const selectionModeRef = useRef("new");
  const highlightHandle = useRef<RemovableHandle | null>(null);
  const createHandle = useRef<RemovableHandle | null>(null);
  const selectedFeaturesRef = useRef<Graphic[]>([]);
  const viewRef = useRef<MapView | null>(null);

  const [selectionMode, setSelectionMode] = useState("new");
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadMap = async () => {
      const mapView = await getMainMapView();
      if (cancelled || !mapView?.map) return;

      viewRef.current = mapView;

      const layer =  await findLayerByTitles(mapView.map, "SupportStructures");

      if (cancelled || !layer) return;

      selectionLayer.current = layer;
      onLayerReady(layer);

      const sketchGraphics = new GraphicsLayer({
        title: "Selection Graphics",
        listMode: "hide",
      });

      mapView.map.add(sketchGraphics);
      graphicsLayer.current = sketchGraphics;

      sketchVM.current = new SketchViewModel({
        view: mapView,
        layer: sketchGraphics,
        polygonSymbol: SELECTION_SYMBOL,
      });

      createHandle.current = sketchVM.current.on("create", async (event) => {
        if (event.state !== "complete" || !event.graphic?.geometry) return;
        await performSelection(event.graphic.geometry);
      });
    };

    loadMap();

    return () => {
      cancelled = true;
      createHandle.current?.remove();
      createHandle.current = null;
      highlightHandle.current?.remove();
      highlightHandle.current = null;
      sketchVM.current?.destroy();
      sketchVM.current = null;

      const map = viewRef.current?.map;
      if (map && graphicsLayer.current) {
        map.remove(graphicsLayer.current);
      }
      graphicsLayer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  async function highlightFeatures(features: Graphic[]) {
    if (!viewRef.current || !selectionLayer.current) return;

    const layerView = await viewRef.current.whenLayerView(selectionLayer.current);
    highlightHandle.current?.remove();
    highlightHandle.current = layerView.highlight(features);
  }

  function commitSelection(features: Graphic[]) {
    selectedFeaturesRef.current = features;
    setSelectedCount(features.length);
    highlightFeatures(features);
    onSelectionChange(
      features.map((f) => f.attributes.OBJECTID as number),
    );
  }

  async function performSelection(geometry: Geometry) {
    if (!selectionLayer.current) return;

    const result = await selectionLayer.current.queryFeatures({
      geometry,
      spatialRelationship: "intersects",
      returnGeometry: true,
      outFields: ["OBJECTID"],
    });

    const features = result.features;
    const mode = selectionModeRef.current;

    if (mode === "new") {
      commitSelection(features);
      return;
    }

    if (mode === "add") {
      const ids = new Set(
        selectedFeaturesRef.current.map((f) => f.attributes.OBJECTID),
      );
      const updated = [...selectedFeaturesRef.current];

      for (const feature of features) {
        if (!ids.has(feature.attributes.OBJECTID)) {
          updated.push(feature);
        }
      }

      commitSelection(updated);
      return;
    }

    if (mode === "remove") {
      const removeIds = new Set(
        features.map((f) => f.attributes.OBJECTID as number),
      );
      const updated = selectedFeaturesRef.current.filter(
        (item) => !removeIds.has(item.attributes.OBJECTID as number),
      );
      commitSelection(updated);
    }
  }

  function drawRectangle() {
    graphicsLayer.current?.removeAll();
    sketchVM.current?.cancel();
    sketchVM.current?.create("rectangle");
  }

  function drawPolygon() {
    graphicsLayer.current?.removeAll();
    sketchVM.current?.cancel();
    sketchVM.current?.create("polygon");
  }

  function clearGraphics() {
    graphicsLayer.current?.removeAll();
    highlightHandle.current?.remove();
    highlightHandle.current = null;
    viewRef.current?.graphics?.removeAll();
    selectedFeaturesRef.current = [];
    setSelectedCount(0);
    onSelectionChange([]);
  }

  const handlePushToTeams = () => {
    if (selectedFeaturesRef.current.length === 0) {
      alert("No Rows Selected");
      return;
    }
    
    const selectedFeatures: any[] = [];
    selectedFeaturesRef.current.map((feature) => {
      const attributes = { ...feature.attributes };

      if (selectionMode === "new") {
        attributes.OP_TYPE = "NEW";
        attributes.OPERATION = "INSERT";
      } else if (selectionMode === "add") {
        attributes.OP_TYPE = "ADD";
        attributes.OPERATION = "INSERT";
      } else {
        attributes.OP_TYPE = "REM";
        attributes.OPERATION = "DELETE";
      }

      selectedFeatures.push(attributes) ;
    });
    //implemenation is in pending 
    console.log(selectedFeatures)
  };

  return (
    <div className="selection-widget">
      <div className="selection-header">
        <span>Select Map Structures</span>

        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="selection-controls">
        <div className="selection-toolbar">
          <button className="tool-button" onClick={drawRectangle}>
            <calcite-icon icon="cursor" scale="s" />
          </button>

          <button className="tool-button" onClick={drawPolygon}>
            <calcite-icon icon="polygon" scale="s" />
          </button>

          <button className="tool-button" onClick={clearGraphics}>
            <calcite-icon icon="erase" scale="s" />
          </button>
        </div>

        <select
          className="selection-select"
          value={selectionMode}
          onChange={(e) => setSelectionMode(e.target.value)}
        >
          <option value="new">New Selection</option>
          <option value="add">Add To Selection</option>
          <option value="remove">Remove From Selection</option>
        </select>

        <button className="push-button" onClick={handlePushToTeams}>
          PUSH TO TEAMS
        </button>
      </div>

      <div className="selection-count">
        <b>Selected Features :</b> {selectedCount}
      </div>
    </div>
  );
}

export default SelectionWidget;
