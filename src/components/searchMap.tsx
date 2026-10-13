import { memo, useEffect, useRef } from "react";
import "@arcgis/map-components/components/arcgis-search";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import { config } from "../config";
import { getMainMapView } from "../utils/mapView";

const SearchWidget = () => {
  const searchRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    const initializeSearch = async () => {
      const view = await getMainMapView();
      const searchWidget = searchRef.current;

      if (cancelled || !view || !searchWidget) return;

      const mapEl = document.getElementById("main-map");
      if (mapEl) {
        searchWidget.referenceElement = mapEl;
      }

      searchWidget.includeDefaultSources = true;

      const featureLayer = new FeatureLayer({
        url: config.search.searchURL,
        outFields: [config.search.searchField, config.search.displayField],
      });

      await featureLayer.load();
      if (cancelled) return;

      searchWidget.sources = [
        {
          layer: featureLayer,
          searchFields: [config.search.searchField],
          displayField: config.search.displayField,
          exactMatch: true,
          outFields: [config.search.searchField, config.search.displayField],
          name: "Search Poles",
          placeholder: config.search.placeholder,
          maxResults: 6,
          maxSuggestions: 6,
          suggestionsEnabled: true,
          minSuggestCharacters: 2,
          zoomScale: 50000,
        },
      ];
    };

    initializeSearch();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <arcgis-search
      ref={searchRef}
      reference-element="main-map"
      min-suggest-characters={2}
      max-suggestions={6}
    ></arcgis-search>
  );
};

export default memo(SearchWidget);
