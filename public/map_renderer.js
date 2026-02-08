// Hamburg Map Renderer - WebAssembly Integration with Zoom/Pan/Tooltips

class MapRenderer {
  constructor() {
    this.wasm = null;
    this.canvas = null;
    this.ctx = null;
    this.mapData = null;
    this.memory = null;
    this.bufferPtr = null;
    this.canvasWidth = 1200;
    this.canvasHeight = 800;

    // Viewport state
    // Default zoom shows ~10km radius (20km across)
    // Max zoom shows ~500m across
    this.zoom = 1.5; // Initial zoom: show city center clearly
    this.offsetX = 0;
    this.offsetY = 0;
    this.minZoom = 0.5; // Shows full ~30km dataset
    this.maxZoom = 40.0; // Max zoom: ~500m across screen

    // Hamburg city center coordinates
    this.centerLat = 53.55;
    this.centerLon = 9.99;

    // Pan state
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;

    // Feature detection for tooltips
    this.renderedFeatures = [];
    this.hoveredFeature = null;

    // Performance optimizations
    this.renderTimeout = null;
    this.renderDelay = 50; // ms delay for debouncing
    this.isRendering = false;
  }

  async init() {
    try {
      // Load WASM module
      const response = await fetch("map_renderer.wasm");
      const wasmBytes = await response.arrayBuffer();

      // Instantiate WASM - it will create its own memory
      const wasmModule = await WebAssembly.instantiate(wasmBytes, {});
      this.wasm = wasmModule.instance.exports;

      // Get the WASM module's memory
      this.memory = this.wasm.memory;

      // Initialize canvas in WASM
      const success = this.wasm.initCanvas(this.canvasWidth, this.canvasHeight);
      if (!success) {
        throw new Error("Failed to initialize canvas in WASM");
      }

      // Get buffer pointers
      this.bufferPtr = this.wasm.getBufferPtr();
      this.coordBufferPtr = this.wasm.getCoordBufferPtr();
      this.coordBufferSize = this.wasm.getCoordBufferSize();

      // Set up HTML canvas
      this.canvas = document.getElementById("mapCanvas");
      this.ctx = this.canvas.getContext("2d");

      // Set up event listeners for zoom and pan
      this.setupInteractions();

      console.log("WASM module loaded successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize WASM:", error);
      return false;
    }
  }

  setupInteractions() {
    // Mouse wheel for zoom
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.zoom * zoomFactor),
      );

      // Zoom towards mouse position
      const zoomRatio = newZoom / this.zoom;
      this.offsetX = mouseX - (mouseX - this.offsetX) * zoomRatio;
      this.offsetY = mouseY - (mouseY - this.offsetY) * zoomRatio;
      this.zoom = newZoom;

      this.debouncedRender();
      this.updateStats();
    });

    // Mouse drag for pan
    this.canvas.addEventListener("mousedown", (e) => {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      this.canvas.style.cursor = "grabbing";
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastPanX;
        const dy = e.clientY - this.lastPanY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastPanX = e.clientX;
        this.lastPanY = e.clientY;
        this.debouncedRender();
      } else {
        // Check for feature hover
        this.checkFeatureHover(e);
      }
    });

    this.canvas.addEventListener("mouseup", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
      this.hideTooltip();
    });

    // Touch support for mobile
    let touchStartDist = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouchX;
        const dy = e.touches[0].clientY - lastTouchY;
        this.offsetX += dx;
        this.offsetY += dy;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
        this.renderMap();
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const zoomFactor = dist / touchStartDist;
        this.zoom = Math.max(
          this.minZoom,
          Math.min(this.maxZoom, this.zoom * zoomFactor),
        );
        touchStartDist = dist;
        this.renderMap();
      }
    });
  }

  checkFeatureHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find feature at this position
    let found = null;
    for (const feature of this.renderedFeatures) {
      if (this.isPointNearFeature(x, y, feature)) {
        found = feature;
        break;
      }
    }

    if (found !== this.hoveredFeature) {
      this.hoveredFeature = found;
      if (found) {
        this.showTooltip(e.clientX, e.clientY, found);
        this.updateInfoPanel(found);
      } else {
        this.hideTooltip();
        this.clearInfoPanel();
      }
    }
  }

  isPointNearFeature(x, y, feature) {
    const threshold = 10; // pixels

    if (feature.type === "Point") {
      const dx = x - feature.screenX;
      const dy = y - feature.screenY;
      return Math.sqrt(dx * dx + dy * dy) < threshold;
    } else if (feature.type === "LineString" || feature.type === "Polygon") {
      // Check if point is near any line segment
      for (let i = 0; i < feature.screenCoords.length - 1; i++) {
        const p1 = feature.screenCoords[i];
        const p2 = feature.screenCoords[i + 1];
        const dist = this.pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist < threshold) return true;
      }
    }
    return false;
  }

  pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0)
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }

  showTooltip(x, y, feature) {
    let tooltip = document.getElementById("mapTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "mapTooltip";
      tooltip.style.cssText = `
        position: fixed;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        max-width: 200px;
      `;
      document.body.appendChild(tooltip);
    }

    const props = feature.properties;
    let text = "";

    if (props.name) text += `<strong>${props.name}</strong><br>`;
    if (props.highway) text += `Highway: ${props.highway}<br>`;
    if (props.building) text += `Building: ${props.building}<br>`;
    if (props.natural) text += `Natural: ${props.natural}<br>`;
    if (props.water || props.waterway)
      text += `Water: ${props.water || props.waterway}<br>`;
    if (props.amenity) text += `Amenity: ${props.amenity}<br>`;

    if (!text) text = `Feature type: ${feature.type}`;

    tooltip.innerHTML = text;
    tooltip.style.left = x + 15 + "px";
    tooltip.style.top = y + 15 + "px";
    tooltip.style.display = "block";
  }

  hideTooltip() {
    const tooltip = document.getElementById("mapTooltip");
    if (tooltip) tooltip.style.display = "none";
  }

  updateInfoPanel(feature) {
    const panel = document.getElementById("infoPanel");
    if (!panel) return;

    const props = feature.properties;
    let html = "<h3>Feature Information</h3>";

    html += `<div class="info-item"><span class="label">Type:</span> ${feature.type}</div>`;

    Object.keys(props).forEach((key) => {
      if (props[key]) {
        html += `<div class="info-item"><span class="label">${key}:</span> ${props[key]}</div>`;
      }
    });

    panel.innerHTML = html;
    panel.style.display = "block";
  }

  clearInfoPanel() {
    const panel = document.getElementById("infoPanel");
    if (panel) {
      panel.innerHTML =
        "<h3>Feature Information</h3><p>Hover over map features to see details</p>";
    }
  }

  debouncedRender() {
    // Clear any pending render
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }

    // Schedule new render
    this.renderTimeout = setTimeout(() => {
      this.renderMap();
    }, this.renderDelay);
  }

  isFeatureInViewport(feature, bounds) {
    // Quick viewport culling - check if feature overlaps visible area
    if (!feature.geometry || !feature.geometry.coordinates) return false;

    const checkCoord = (coord) => {
      const [lon, lat] = coord;
      return (
        lon >= bounds.minLon &&
        lon <= bounds.maxLon &&
        lat >= bounds.minLat &&
        lat <= bounds.maxLat
      );
    };

    const type = feature.geometry.type;
    if (type === "Point") {
      return checkCoord(feature.geometry.coordinates);
    } else if (type === "LineString") {
      return feature.geometry.coordinates.some(checkCoord);
    } else if (type === "Polygon") {
      return feature.geometry.coordinates[0].some(checkCoord);
    } else if (type === "MultiLineString") {
      return feature.geometry.coordinates.some((line) => line.some(checkCoord));
    } else if (type === "MultiPolygon") {
      return feature.geometry.coordinates.some((polygon) =>
        polygon[0].some(checkCoord),
      );
    }
    return false;
  }

  async loadMapData() {
    try {
      console.log("Fetching map data...");
      const response = await fetch("hamburg.geojson");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        console.log(
          `Downloading ${(contentLength / 1024 / 1024).toFixed(1)} MB...`,
        );
      }

      console.log(
        "Parsing GeoJSON (this may take a moment for large files)...",
      );
      this.mapData = await response.json();
      console.log(
        `✓ Loaded ${this.mapData.features.length} features from GeoJSON`,
      );
      return true;
    } catch (error) {
      console.error("Failed to load map data:", error);
      return false;
    }
  }

  calculateBounds() {
    // Hamburg city center: 53.55°N, 9.99°E
    // Initial view: ~10km radius (suitable for city exploration)
    if (!this.mapData || !this.mapData.features.length) {
      return {
        minLon: 9.85,
        maxLon: 10.13,
        minLat: 53.46,
        maxLat: 53.64,
      };
    }

    let minLon = Infinity,
      maxLon = -Infinity;
    let minLat = Infinity,
      maxLat = -Infinity;

    for (const feature of this.mapData.features) {
      if (!feature.geometry || !feature.geometry.coordinates) continue;

      const processCoord = (coord) => {
        const [lon, lat] = coord;
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      };

      if (feature.geometry.type === "Point") {
        processCoord(feature.geometry.coordinates);
      } else if (feature.geometry.type === "LineString") {
        feature.geometry.coordinates.forEach(processCoord);
      } else if (feature.geometry.type === "Polygon") {
        feature.geometry.coordinates[0].forEach(processCoord);
      } else if (feature.geometry.type === "MultiLineString") {
        feature.geometry.coordinates.forEach((line) => {
          line.forEach(processCoord);
        });
      } else if (feature.geometry.type === "MultiPolygon") {
        feature.geometry.coordinates.forEach((polygon) => {
          polygon[0].forEach(processCoord);
        });
      }
    }

    // Add 5% padding
    const lonPadding = (maxLon - minLon) * 0.05;
    const latPadding = (maxLat - minLat) * 0.05;

    return {
      minLon: minLon - lonPadding,
      maxLon: maxLon + lonPadding,
      minLat: minLat - latPadding,
      maxLat: maxLat + latPadding,
    };
  }

  latLonToScreen(lat, lon, bounds) {
    // Apply zoom and pan
    const baseX =
      ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) *
      this.canvasWidth;
    const baseY =
      this.canvasHeight -
      ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) *
        this.canvasHeight;

    return {
      x: baseX * this.zoom + this.offsetX,
      y: baseY * this.zoom + this.offsetY,
    };
  }

  renderMap() {
    const startTime = performance.now();

    if (!this.wasm || !this.mapData) {
      console.error("WASM or map data not loaded");
      return;
    }

    // Calculate and set map bounds
    const bounds = this.calculateBounds();

    // Adjust bounds for zoom
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const lonRange = (bounds.maxLon - bounds.minLon) / this.zoom;
    const latRange = (bounds.maxLat - bounds.minLat) / this.zoom;

    // Adjust for pan (convert screen offset to geo offset)
    const lonOffset = -(this.offsetX / this.canvasWidth) * lonRange;
    const latOffset = (this.offsetY / this.canvasHeight) * latRange;

    const adjustedBounds = {
      minLon: centerLon - lonRange / 2 + lonOffset,
      maxLon: centerLon + lonRange / 2 + lonOffset,
      minLat: centerLat - latRange / 2 + latOffset,
      maxLat: centerLat + latRange / 2 + latOffset,
    };

    this.wasm.setMapBounds(
      adjustedBounds.minLon,
      adjustedBounds.maxLon,
      adjustedBounds.minLat,
      adjustedBounds.maxLat,
    );

    // Clear canvas
    this.wasm.clearCanvas(240, 248, 255); // Light blue background

    let featureCount = 0;
    let culledCount = 0;
    let lodCulledCount = 0;
    this.renderedFeatures = [];

    // Determine LOD (Level of Detail) based on zoom
    // At low zoom: only major features
    // At high zoom: all details
    const lod = this.getLOD();

    // Render in layers: background fills first, then lines, then points
    const layers = {
      background: [], // Water bodies, forests, parks (filled)
      areas: [], // Buildings, landuse (filled)
      major_roads: [], // Motorways, trunks
      roads: [], // Other roads
      railways: [], // Rail lines
      waterways: [], // Rivers, streams
      points: [], // POIs
    };

    // Classify and filter features by LOD
    for (const feature of this.mapData.features) {
      if (!feature.geometry || !feature.geometry.coordinates) continue;

      // Viewport culling - skip features not in view
      if (!this.isFeatureInViewport(feature, adjustedBounds)) {
        culledCount++;
        continue;
      }

      const props = feature.properties || {};
      const type = feature.geometry.type;

      // LOD filtering - classify feature importance and filter by zoom
      const featureInfo = this.classifyFeature(props, type);
      if (featureInfo.minLOD > lod) {
        lodCulledCount++;
        continue;
      }

      // Add to appropriate layer
      if (featureInfo.layer) {
        layers[featureInfo.layer].push({
          feature,
          props,
          type,
          color: featureInfo.color,
          fill: featureInfo.fill,
        });
      }
    }

    // Render layers in order (back to front)
    this.renderLayer(layers.background, bounds, true);
    this.renderLayer(layers.areas, bounds, true);
    this.renderLayer(layers.waterways, bounds, false);
    this.renderLayer(layers.railways, bounds, false);
    this.renderLayer(layers.major_roads, bounds, false);
    this.renderLayer(layers.roads, bounds, false);
    this.renderLayer(layers.points, bounds, false);

    featureCount = Object.values(layers).reduce(
      (sum, layer) => sum + layer.length,
      0,
    );

    // Copy WASM buffer to canvas
    this.updateCanvas();

    const endTime = performance.now();
    const renderTime = (endTime - startTime).toFixed(2);

    document.getElementById("featureCount").textContent = featureCount;
    document.getElementById("renderTime").textContent = renderTime;
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Rendered";

    console.log(
      `Rendered ${featureCount} features (viewport culled: ${culledCount}, LOD culled: ${lodCulledCount}) in ${renderTime}ms`,
    );
  }

  getLOD() {
    // Return LOD level based on zoom
    // 0: Very zoomed out (show only major features)
    // 1: Medium zoom (show major + secondary features)
    // 2: Zoomed in (show most features)
    // 3: Very zoomed in (show all details)
    if (this.zoom < 1.5) return 0;
    if (this.zoom < 4) return 1;
    if (this.zoom < 10) return 2;
    return 3;
  }

  classifyFeature(props, type) {
    // Classify feature and determine: color, layer, minLOD (minimum zoom to show), fill
    // minLOD: 0=always show, 1=medium zoom, 2=high zoom, 3=very high zoom

    // Water bodies (always visible, filled)
    if (
      props.natural === "water" ||
      props.water === "lake" ||
      props.water === "reservoir"
    ) {
      return {
        layer: "background",
        color: { r: 170, g: 211, b: 223, a: 255 },
        minLOD: 0,
        fill: true,
      };
    }

    // Rivers and streams (visible from medium zoom)
    if (props.waterway) {
      const importance = ["river", "canal"].includes(props.waterway) ? 1 : 2;
      return {
        layer: "waterways",
        color: { r: 170, g: 211, b: 223, a: 255 },
        minLOD: importance,
        fill: false,
      };
    }

    // Forests and woods (always visible when zoomed out, filled)
    if (props.landuse === "forest" || props.natural === "wood") {
      return {
        layer: "background",
        color: { r: 173, g: 209, b: 158, a: 255 },
        minLOD: 0,
        fill: true,
      };
    }

    // Parks and green spaces
    if (
      props.leisure === "park" ||
      props.landuse === "grass" ||
      props.landuse === "meadow"
    ) {
      return {
        layer: "background",
        color: { r: 200, g: 230, b: 180, a: 255 },
        minLOD: 1,
        fill: true,
      };
    }

    // Agricultural land
    if (
      props.landuse === "farmland" ||
      props.landuse === "orchard" ||
      props.landuse === "vineyard"
    ) {
      return {
        layer: "background",
        color: { r: 238, g: 240, b: 213, a: 255 },
        minLOD: 1,
        fill: true,
      };
    }

    // Commercial/industrial areas
    if (
      props.landuse === "commercial" ||
      props.landuse === "industrial" ||
      props.landuse === "retail"
    ) {
      return {
        layer: "areas",
        color: { r: 240, g: 225, b: 225, a: 255 },
        minLOD: 2,
        fill: true,
      };
    }

    // Buildings (only show when zoomed in enough)
    if (props.building) {
      return {
        layer: "areas",
        color: { r: 218, g: 208, b: 200, a: 255 },
        minLOD: 2,
        fill: true,
      };
    }

    // Major highways (always visible)
    if (props.highway === "motorway" || props.highway === "trunk") {
      return {
        layer: "major_roads",
        color: { r: 233, g: 115, b: 103, a: 255 },
        minLOD: 0,
        fill: false,
      };
    }

    // Primary and secondary roads
    if (props.highway === "primary" || props.highway === "secondary") {
      return {
        layer: "major_roads",
        color: { r: 252, g: 214, b: 164, a: 255 },
        minLOD: 1,
        fill: false,
      };
    }

    // Tertiary and residential roads
    if (
      props.highway === "tertiary" ||
      props.highway === "residential" ||
      props.highway === "unclassified"
    ) {
      return {
        layer: "roads",
        color: { r: 255, g: 255, b: 255, a: 255 },
        minLOD: 2,
        fill: false,
      };
    }

    // Small roads and paths
    if (props.highway) {
      return {
        layer: "roads",
        color: { r: 220, g: 220, b: 220, a: 255 },
        minLOD: 3,
        fill: false,
      };
    }

    // Railways (visible from medium zoom)
    if (props.railway) {
      return {
        layer: "railways",
        color: { r: 153, g: 153, b: 153, a: 255 },
        minLOD: 1,
        fill: false,
      };
    }

    // Points of interest
    if (props.amenity || props.shop || props.tourism) {
      return {
        layer: "points",
        color: { r: 100, g: 100, b: 100, a: 255 },
        minLOD: 3,
        fill: false,
      };
    }

    // Default: skip unless very zoomed in
    return {
      layer: null,
      color: { r: 180, g: 180, b: 180, a: 255 },
      minLOD: 3,
      fill: false,
    };
  }

  renderLayer(layerFeatures, bounds, useFill) {
    for (const item of layerFeatures) {
      const { feature, props, type, color, fill } = item;

      try {
        if (type === "Point") {
          const [lon, lat] = feature.geometry.coordinates;
          this.wasm.drawPoint(lon, lat, 3, color.r, color.g, color.b, color.a);
          const screen = this.latLonToScreen(lat, lon, bounds);
          this.renderedFeatures.push({
            type: "Point",
            screenX: screen.x,
            screenY: screen.y,
            properties: props,
            geometry: feature.geometry,
          });
        } else if (type === "LineString") {
          const screenCoords = this.renderLineString(
            feature.geometry.coordinates,
            color,
            bounds,
          );
          this.renderedFeatures.push({
            type: "LineString",
            screenCoords: screenCoords,
            properties: props,
            geometry: feature.geometry,
          });
        } else if (type === "Polygon") {
          const renderFunc =
            fill && useFill
              ? this.renderPolygon.bind(this)
              : this.renderPolygonOutline.bind(this);
          const screenCoords = renderFunc(
            feature.geometry.coordinates[0],
            color,
            bounds,
          );
          this.renderedFeatures.push({
            type: "Polygon",
            screenCoords: screenCoords,
            properties: props,
            geometry: feature.geometry,
          });
        } else if (type === "MultiLineString") {
          feature.geometry.coordinates.forEach((line) => {
            const screenCoords = this.renderLineString(line, color, bounds);
            this.renderedFeatures.push({
              type: "LineString",
              screenCoords: screenCoords,
              properties: props,
              geometry: feature.geometry,
            });
          });
        } else if (type === "MultiPolygon") {
          feature.geometry.coordinates.forEach((polygon) => {
            const renderFunc =
              fill && useFill
                ? this.renderPolygon.bind(this)
                : this.renderPolygonOutline.bind(this);
            const screenCoords = renderFunc(polygon[0], color, bounds);
            this.renderedFeatures.push({
              type: "Polygon",
              screenCoords: screenCoords,
              properties: props,
              geometry: feature.geometry,
            });
          });
        }
      } catch (error) {
        console.warn("Error rendering feature:", error);
      }
    }
  }

  renderLineString(coordinates, color, bounds) {
    if (coordinates.length < 2) return [];
    if (coordinates.length * 2 > this.coordBufferSize) return []; // Too many coords

    // Write coordinates directly to WASM coord buffer
    const memory = new Float64Array(this.memory.buffer);
    const screenCoords = [];

    for (let i = 0; i < coordinates.length; i++) {
      memory[this.coordBufferPtr / 8 + i * 2] = coordinates[i][0]; // lon
      memory[this.coordBufferPtr / 8 + i * 2 + 1] = coordinates[i][1]; // lat

      // Also compute screen coordinates for hit detection
      const screen = this.latLonToScreen(
        coordinates[i][1],
        coordinates[i][0],
        bounds,
      );
      screenCoords.push(screen);
    }

    this.wasm.drawWay(
      this.coordBufferPtr,
      coordinates.length * 2,
      color.r,
      color.g,
      color.b,
      color.a,
    );

    return screenCoords;
  }

  renderPolygonOutline(coordinates, color, bounds) {
    // Render polygon as outline only (not filled)
    return this.renderLineString(coordinates, color, bounds);
  }

  renderPolygon(coordinates, color, bounds) {
    if (coordinates.length < 3) return [];
    if (coordinates.length * 2 > this.coordBufferSize) return []; // Too many coords

    // Write coordinates directly to WASM coord buffer
    const memory = new Float64Array(this.memory.buffer);
    const screenCoords = [];

    for (let i = 0; i < coordinates.length; i++) {
      memory[this.coordBufferPtr / 8 + i * 2] = coordinates[i][0]; // lon
      memory[this.coordBufferPtr / 8 + i * 2 + 1] = coordinates[i][1]; // lat

      // Also compute screen coordinates for hit detection
      const screen = this.latLonToScreen(
        coordinates[i][1],
        coordinates[i][0],
        bounds,
      );
      screenCoords.push(screen);
    }

    this.wasm.fillPolygon(
      this.coordBufferPtr,
      coordinates.length * 2,
      color.r,
      color.g,
      color.b,
      color.a,
    );

    return screenCoords;
  }

  updateCanvas() {
    const bufferSize = this.wasm.getBufferSize();
    const buffer = new Uint8ClampedArray(
      this.memory.buffer,
      this.bufferPtr,
      bufferSize,
    );

    const imageData = new ImageData(
      buffer,
      this.canvasWidth,
      this.canvasHeight,
    );
    this.ctx.putImageData(imageData, 0, 0);
  }

  clearCanvas() {
    this.wasm.clearCanvas(255, 255, 255);
    this.updateCanvas();
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Cleared";
  }

  resetView() {
    this.zoom = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.renderMap();
    this.updateStats();
  }

  updateStats() {
    document.getElementById("zoomLevel").textContent =
      this.zoom.toFixed(2) + "x";
  }

  exportAsPNG() {
    const dataURL = this.canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "hamburg-map.png";
    link.href = dataURL;
    link.click();
  }
}

// Initialize the application
let renderer;

async function initApp() {
  renderer = new MapRenderer();

  const wasmLoaded = await renderer.init();
  if (!wasmLoaded) {
    document.getElementById("loading").innerHTML =
      '<div style="color: red;">Failed to load WebAssembly module</div>';
    return;
  }

  const dataLoaded = await renderer.loadMapData();
  if (!dataLoaded) {
    document.getElementById("loading").innerHTML =
      '<div style="color: red;">Failed to load map data</div>';
    return;
  }

  // Hide loading, show map
  document.getElementById("loading").style.display = "none";
  document.getElementById("mapContainer").style.display = "block";

  // Set up event listeners
  document.getElementById("renderBtn").addEventListener("click", () => {
    renderer.renderMap();
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    renderer.clearCanvas();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    renderer.resetView();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    renderer.exportAsPNG();
  });

  // Auto-render on load
  renderer.renderMap();
  renderer.updateStats();
}

// Start the app when page loads
window.addEventListener("DOMContentLoaded", initApp);
