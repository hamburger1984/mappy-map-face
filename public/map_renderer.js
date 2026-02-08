// Hamburg Map Renderer - Canvas2D with Zoom/Pan/Tooltips
// VERSION: 2024-RAILWAY-PATTERN-v2

class MapRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.mapData = null;
    this.canvasWidth = 1200;
    this.canvasHeight = 800;

    // Viewport state
    // Default zoom shows ~10km radius (20km across)
    // Max zoom shows ~500m across
    this.zoom = 1.5; // Initial zoom: show city center clearly
    this.offsetX = 0;
    this.offsetY = 0;
    this.minZoom = 0.5; // Shows full ~30km dataset
    this.maxZoom = 120.0; // Max zoom: ~100m across screen

    // Hamburg city center coordinates
    this.centerLat = 53.55;
    this.centerLon = 9.99;

    // Pan state
    this.isPanning = false;
    this.lastPanX = 0;
    this.lastPanY = 0;

    // Feature detection for tooltips and selection
    this.renderedFeatures = [];
    this.hoveredFeature = null;
    this.selectedFeature = null;

    // Performance optimizations
    this.renderTimeout = null;
    this.renderDelay = 50; // ms delay for debouncing
    this.isRendering = false;

    // Tile system
    this.tileCache = new Map(); // Cache for loaded tiles
    this.tileIndex = null; // Tile index metadata
    this.loadingTiles = new Set(); // Track in-flight tile requests
    this.tileBounds = {
      minLon: 9.77,
      maxLon: 10.21,
      minLat: 53.415,
      maxLat: 53.685,
    };
  }

  async init() {
    try {
      // Set up HTML canvas
      this.canvas = document.getElementById("mapCanvas");
      this.ctx = this.canvas.getContext("2d");

      // Set up event listeners for zoom and pan
      this.setupInteractions();

      return true;
    } catch (error) {
      console.error("Failed to initialize canvas:", error);
      return false;
    }
  }

  setupInteractions() {
    // Mouse drag for pan
    let mouseDownPos = null;

    this.canvas.addEventListener("mousedown", (e) => {
      this.isPanning = true;
      this.lastPanX = e.clientX;
      this.lastPanY = e.clientY;
      mouseDownPos = { x: e.clientX, y: e.clientY };
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
        // Check for feature hover (only if nothing is selected)
        if (!this.selectedFeature) {
          this.checkFeatureHover(e);
        }
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      // Check if this was a click (not a drag)
      if (
        mouseDownPos &&
        Math.abs(e.clientX - mouseDownPos.x) < 5 &&
        Math.abs(e.clientY - mouseDownPos.y) < 5
      ) {
        // It's a click, not a drag
        if (this.hoveredFeature) {
          this.selectedFeature = this.hoveredFeature;
          this.renderMap(); // Re-render to show selection highlight
        }
      }

      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
      mouseDownPos = null;
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
      if (!this.selectedFeature) {
        this.hideTooltip();
      }
    });

    // ESC key to deselect
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.selectedFeature) {
        this.selectedFeature = null;
        this.hideTooltip();
        this.renderMap(); // Re-render to remove selection highlight
      }
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

  zoomIn() {
    // Zoom toward center of viewport
    // Simply increase zoom without changing offset
    const zoomFactor = 1.3;
    const oldZoom = this.zoom;
    const newZoom = Math.min(this.maxZoom, this.zoom * zoomFactor);

    if (newZoom !== this.zoom) {
      this.zoom = newZoom;
      console.log(
        `[ZOOM] In: ${oldZoom.toFixed(2)} → ${newZoom.toFixed(2)} (factor: ${zoomFactor})`,
      );
      this.renderMap();
      this.updateStats();
    }
  }

  zoomOut() {
    // Zoom away from center of viewport
    // Simply decrease zoom without changing offset
    const zoomFactor = 1 / 1.3;
    const oldZoom = this.zoom;
    const newZoom = Math.max(this.minZoom, this.zoom * zoomFactor);

    if (newZoom !== this.zoom) {
      this.zoom = newZoom;
      console.log(
        `[ZOOM] Out: ${oldZoom.toFixed(2)} → ${newZoom.toFixed(2)} (factor: ${zoomFactor.toFixed(2)})`,
      );
      this.renderMap();
      this.updateStats();
    }
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
      const previousHover = this.hoveredFeature;
      this.hoveredFeature = found;

      if (found) {
        this.showTooltip(e.clientX, e.clientY, found);
        this.updateInfoPanel(found);
      } else {
        this.hideTooltip();
        this.clearInfoPanel();
      }

      // Re-render to show/hide highlight (only if hover changed)
      if (previousHover || found) {
        this.renderMap();
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

  highlightFeature(feature, bounds, mode) {
    // mode: "hovered" or "selected"
    const isSelected = mode === "selected";

    // Highlight color: yellow for hover, orange for selected
    const highlightColor = isSelected
      ? "rgba(255, 140, 0, 0.8)" // Orange for selected
      : "rgba(255, 255, 0, 0.6)"; // Yellow for hover

    const highlightWidth = isSelected ? 6 : 4;

    if (feature.type === "Point") {
      // Highlight point with a circle
      this.ctx.strokeStyle = highlightColor;
      this.ctx.lineWidth = highlightWidth;
      this.ctx.fillStyle = isSelected
        ? "rgba(255, 140, 0, 0.3)"
        : "rgba(255, 255, 0, 0.2)";
      this.ctx.beginPath();
      this.ctx.arc(feature.screenX, feature.screenY, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else if (feature.type === "LineString" && feature.screenCoords) {
      // Highlight line with thicker stroke
      this.ctx.strokeStyle = highlightColor;
      this.ctx.lineWidth = highlightWidth;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();

      for (let i = 0; i < feature.screenCoords.length; i++) {
        const coord = feature.screenCoords[i];
        if (i === 0) {
          this.ctx.moveTo(coord.x, coord.y);
        } else {
          this.ctx.lineTo(coord.x, coord.y);
        }
      }
      this.ctx.stroke();
    } else if (feature.type === "Polygon" && feature.screenCoords) {
      // Highlight polygon with thicker outline
      this.ctx.strokeStyle = highlightColor;
      this.ctx.lineWidth = highlightWidth;
      this.ctx.fillStyle = isSelected
        ? "rgba(255, 140, 0, 0.15)"
        : "rgba(255, 255, 0, 0.1)";
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();

      for (let i = 0; i < feature.screenCoords.length; i++) {
        const coord = feature.screenCoords[i];
        if (i === 0) {
          this.ctx.moveTo(coord.x, coord.y);
        } else {
          this.ctx.lineTo(coord.x, coord.y);
        }
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
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

  // Web Mercator projection helpers
  lon2tile(lon, zoom) {
    return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  }

  lat2tile(lat, zoom) {
    return Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
        ) /
          Math.PI) /
        2) *
        Math.pow(2, zoom),
    );
  }

  tile2lon(x, zoom) {
    return (x / Math.pow(2, zoom)) * 360 - 180;
  }

  tile2lat(y, zoom) {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  getZoomLevelForScale() {
    // Determine which tile zoom level to use based on current zoom
    // At low zoom, use Z8 (far view)
    // At medium zoom, use Z11 (medium view)
    // At high zoom, use Z14 (close view)
    if (this.zoom < 3) return 8;
    if (this.zoom < 20) return 11;
    return 14;
  }

  getVisibleTiles(bounds) {
    // Calculate which tiles are visible in the current viewport
    const tileZoom = this.getZoomLevelForScale();

    const minX = this.lon2tile(bounds.minLon, tileZoom);
    const maxX = this.lon2tile(bounds.maxLon, tileZoom);
    const minY = this.lat2tile(bounds.maxLat, tileZoom); // Note: lat reversed
    const maxY = this.lat2tile(bounds.minLat, tileZoom);

    const tiles = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        tiles.push({ z: tileZoom, x, y });
      }
    }
    return tiles;
  }

  getTileKey(z, x, y) {
    return `${z}/${x}/${y}`;
  }

  async loadTile(z, x, y) {
    const key = this.getTileKey(z, x, y);

    // Check cache first
    if (this.tileCache.has(key)) {
      return this.tileCache.get(key);
    }

    // Check if already loading
    if (this.loadingTiles.has(key)) {
      // Wait for existing load to complete
      while (this.loadingTiles.has(key)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return this.tileCache.get(key);
    }

    // Start loading
    this.loadingTiles.add(key);

    try {
      const response = await fetch(`tiles/${z}/${x}/${y}.json.gz`);

      if (!response.ok) {
        // Tile doesn't exist (no data in this area)
        this.loadingTiles.delete(key);
        this.tileCache.set(key, { type: "FeatureCollection", features: [] });
        return this.tileCache.get(key);
      }

      // Decompress tile
      const compressedData = await response.arrayBuffer();
      const decompressedStream = new Response(
        new Response(compressedData).body.pipeThrough(
          new DecompressionStream("gzip"),
        ),
      );
      const tileData = await decompressedStream.json();

      this.tileCache.set(key, tileData);
      this.loadingTiles.delete(key);

      return tileData;
    } catch (error) {
      console.warn(`Failed to load tile ${key}:`, error);
      this.loadingTiles.delete(key);
      this.tileCache.set(key, { type: "FeatureCollection", features: [] });
      return this.tileCache.get(key);
    }
  }

  async loadVisibleTiles(bounds) {
    const tiles = this.getVisibleTiles(bounds);

    // Load all visible tiles in parallel
    const tilePromises = tiles.map(({ z, x, y }) => this.loadTile(z, x, y));
    const tileData = await Promise.all(tilePromises);

    // Merge all tile features into a single GeoJSON
    const features = [];
    for (const tile of tileData) {
      if (tile && tile.features) {
        features.push(...tile.features);
      }
    }

    return {
      type: "FeatureCollection",
      features: features,
    };
  }

  async loadMapData() {
    try {
      // Load tile index

      // Load tile index
      const indexResponse = await fetch("tiles/index.json");
      if (indexResponse.ok) {
        this.tileIndex = await indexResponse.json();
        // Tile index loaded
      }

      // Initialize with empty data - tiles will be loaded progressively
      this.mapData = {
        type: "FeatureCollection",
        features: [],
      };

      // Tile system ready
      return true;
    } catch (error) {
      console.error("Failed to load tile index:", error);
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
    // Bounds are already adjusted for zoom and pan in renderMap
    // Just do a simple normalized transformation
    const x =
      ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) *
      this.canvasWidth;
    const y =
      this.canvasHeight -
      ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) *
        this.canvasHeight;

    return { x, y };
  }

  async renderMap() {
    const startTime = performance.now();

    // Calculate and set map bounds
    const bounds = this.calculateBounds();

    console.log(
      `[RENDER] Zoom: ${this.zoom.toFixed(2)}, LOD: ${this.getLOD()}`,
    );

    // Adjust bounds for zoom and pan
    // The key insight: we want to zoom/pan around the GEOGRAPHIC center, not the bounds center
    // Use fixed Hamburg center coordinates
    const centerLon = this.centerLon; // 9.99
    const centerLat = this.centerLat; // 53.55

    // Calculate aspect ratio correction for Mercator projection at this latitude
    // At Hamburg (53.55°N), we need to correct for the cos(latitude) factor
    const latRad = (centerLat * Math.PI) / 180;
    const aspectCorrection = 1 / Math.cos(latRad);

    // Canvas aspect ratio (width/height)
    const canvasAspect = this.canvasWidth / this.canvasHeight; // 1.5 for 1200x800

    // Use fixed base ranges for consistent zoom behavior
    // These match the Hamburg area constants
    const BASE_LAT_RANGE = 0.27; // Hamburg latitude range
    const BASE_LON_RANGE = 0.44; // Hamburg longitude range
    const baseLatRange = BASE_LAT_RANGE;
    const baseLonRange = BASE_LON_RANGE;

    // Calculate visible range accounting for zoom
    // We need to maintain aspect ratio: lonRange should be canvasAspect times latRange (in screen space)
    // But in geographic space, we need to account for Mercator distortion
    const latRange = baseLatRange / this.zoom;
    const lonRange = latRange * canvasAspect * aspectCorrection;

    // Calculate approximate scale (km across the view)
    const kmPerDegLat = 111; // Roughly 111km per degree latitude
    const viewHeightKm = latRange * kmPerDegLat;
    const viewWidthKm = lonRange * kmPerDegLat * Math.cos(latRad);
    console.log(
      `[SCALE] View: ${viewWidthKm.toFixed(1)}km × ${viewHeightKm.toFixed(1)}km`,
    );

    // Adjust for pan (convert screen offset to geo offset)
    // offsetX/Y represent how much we've shifted the view
    // Positive offsetX = dragged right = need to shift center west (negative lon)
    // Positive offsetY = dragged down = need to shift center south (negative lat) because screen Y is inverted
    const lonOffset = -(this.offsetX / this.canvasWidth) * lonRange;
    const latOffset = (this.offsetY / this.canvasHeight) * latRange;

    const adjustedBounds = {
      minLon: centerLon - lonRange / 2 + lonOffset,
      maxLon: centerLon + lonRange / 2 + lonOffset,
      minLat: centerLat - latRange / 2 + latOffset,
      maxLat: centerLat + latRange / 2 + latOffset,
    };

    // Load visible tiles
    const tileLoadStart = performance.now();
    const visibleTiles = this.getVisibleTiles(adjustedBounds);
    const cachedCount = visibleTiles.filter(({ z, x, y }) =>
      this.tileCache.has(this.getTileKey(z, x, y)),
    ).length;

    this.mapData = await this.loadVisibleTiles(adjustedBounds);
    const tileLoadTime = (performance.now() - tileLoadStart).toFixed(2);

    // Update tile stats
    document.getElementById("tileCount").textContent = visibleTiles.length;
    document.getElementById("cachedTiles").textContent = cachedCount;
    document.getElementById("tileLoadTime").textContent = tileLoadTime;

    // Tile loading stats available in UI

    let featureCount = 0;
    let culledCount = 0;
    let lodCulledCount = 0;
    this.renderedFeatures = [];

    // Determine LOD (Level of Detail) based on zoom
    // At low zoom: only major features
    // At high zoom: all details
    const lod = this.getLOD();

    // Layer structure following proper cartographic z-ordering
    // Render order: background to foreground (bottom to top)
    const layers = {
      // FILLED AREAS (background)
      natural_background: [], // Parks, forests, farmland, meadows
      water_areas: [], // Lakes, rivers, ponds (filled areas)
      landuse_areas: [], // Commercial, industrial, residential zones
      buildings: [], // Building footprints

      // LINEAR FEATURES (by vertical layer)
      tunnels: [], // Underground roads/railways (semi-transparent)
      waterways: [], // Rivers, streams (linear features)
      surface_roads: [], // Ground-level roads
      surface_railways: [], // Ground-level railways
      bridges: [], // Elevated roads/railways (on top of water)

      // POINTS (foreground)
      points: [], // POIs, always on top
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

    // Clear canvas background
    this.ctx.fillStyle = "rgb(240, 248, 255)"; // Light blue background
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Render all layers in correct z-order using Canvas2D
    // Background to foreground (bottom to top)

    // 1. Natural background (parks, forests, farmland)
    this.renderLayer(layers.natural_background, adjustedBounds, true);

    // 2. Water areas (lakes, rivers)
    this.renderLayer(layers.water_areas, adjustedBounds, true);

    // 3. Landuse areas (commercial, industrial, residential)
    this.renderLayer(layers.landuse_areas, adjustedBounds, true);

    // 4. Buildings
    this.renderLayer(layers.buildings, adjustedBounds, true);

    // 5. Tunnels (underground, semi-transparent)
    this.renderLayer(layers.tunnels, adjustedBounds, false);

    // 6. Waterways (rivers, streams as lines)
    this.renderLayer(layers.waterways, adjustedBounds, false);

    // 7. Surface roads
    this.renderLayer(layers.surface_roads, adjustedBounds, false);

    // 8. Surface railways
    this.renderLayer(layers.surface_railways, adjustedBounds, false);

    // 9. Bridges (on top of water!)
    this.renderLayer(layers.bridges, adjustedBounds, false);

    // 10. Points (always on top)
    this.renderLayer(layers.points, adjustedBounds, false);

    // 11. Highlight hovered or selected feature on top of everything
    if (this.selectedFeature) {
      this.highlightFeature(this.selectedFeature, adjustedBounds, "selected");
    } else if (this.hoveredFeature) {
      this.highlightFeature(this.hoveredFeature, adjustedBounds, "hovered");
    }

    featureCount = Object.values(layers).reduce(
      (sum, layer) => sum + layer.length,
      0,
    );

    const endTime = performance.now();
    const renderTime = (endTime - startTime).toFixed(2);

    document.getElementById("featureCount").textContent = featureCount;
    document.getElementById("renderTime").textContent = renderTime;
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Rendered";

    // Render stats available in UI
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

    // Detect vertical position (tunnel/bridge/surface)
    const isTunnel =
      props.tunnel === "yes" ||
      props.tunnel === "true" ||
      (props.layer && parseInt(props.layer) < 0);
    const isBridge =
      props.bridge === "yes" ||
      props.bridge === "true" ||
      (props.layer && parseInt(props.layer) > 0 && !isTunnel);

    // === FILLED AREAS (polygons) ===

    // Natural background: parks, forests, farmland
    if (
      props.leisure === "park" ||
      props.landuse === "grass" ||
      props.landuse === "meadow" ||
      props.landuse === "farmland" ||
      props.landuse === "orchard" ||
      props.landuse === "vineyard" ||
      props.landuse === "forest" ||
      props.natural === "wood"
    ) {
      const isForest = props.landuse === "forest" || props.natural === "wood";
      const color = isForest
        ? { r: 173, g: 209, b: 158, a: 255 } // Dark green for forests
        : props.leisure === "park" ||
            props.landuse === "grass" ||
            props.landuse === "meadow"
          ? { r: 200, g: 230, b: 180, a: 255 } // Light green for parks
          : { r: 238, g: 240, b: 213, a: 255 }; // Beige for farmland

      return {
        layer: "natural_background",
        color: color,
        minLOD: isForest ? 0 : 1,
        fill: true,
      };
    }

    // Water areas (filled polygons)
    if (
      props.natural === "water" ||
      props.water ||
      props.waterway === "riverbank"
    ) {
      return {
        layer: "water_areas",
        color: { r: 170, g: 211, b: 223, a: 255 },
        minLOD: 0,
        fill: true,
      };
    }

    // Landuse areas (commercial, industrial, residential)
    if (
      props.landuse === "commercial" ||
      props.landuse === "industrial" ||
      props.landuse === "retail" ||
      props.landuse === "residential"
    ) {
      return {
        layer: "landuse_areas",
        color: { r: 240, g: 225, b: 225, a: 255 },
        minLOD: 2,
        fill: true,
      };
    }

    // Buildings
    if (props.building) {
      return {
        layer: "buildings",
        color: { r: 218, g: 208, b: 200, a: 255 },
        minLOD: 2,
        fill: true,
      };
    }

    // === LINEAR FEATURES (lines) ===

    // Waterways (rivers, streams as lines)
    if (props.waterway && props.waterway !== "riverbank") {
      const importance = ["river", "canal"].includes(props.waterway) ? 0 : 1; // Rivers at all zoom levels
      return {
        layer: "waterways",
        color: { r: 170, g: 211, b: 223, a: 255 },
        minLOD: importance,
        fill: false,
      };
    }

    // Roads - determine layer based on tunnel/bridge/surface
    if (props.highway) {
      // Skip point-like highway features (street lamps, traffic signals, crossings, etc.)
      const skipTypes = [
        "street_lamp",
        "traffic_signals",
        "crossing",
        "stop",
        "give_way",
        "speed_camera",
        "turning_circle",
        "mini_roundabout",
        "motorway_junction",
        "bus_stop",
      ];
      if (skipTypes.includes(props.highway)) {
        return { layer: null, minLOD: 999, fill: false };
      }

      // Also skip if it's a Point geometry - highways should be LineStrings
      if (type === "Point") {
        return { layer: null, minLOD: 999, fill: false };
      }

      // Determine color and width based on road type
      let color;
      let minLOD;
      let width; // Line width in pixels

      if (props.highway === "motorway" || props.highway === "trunk") {
        color = { r: 233, g: 115, b: 103, a: 255 };
        width = 5; // Motorways are widest (~30m wide)
        minLOD = 0;
      } else if (props.highway === "primary" || props.highway === "secondary") {
        color = { r: 252, g: 214, b: 164, a: 255 };
        width = 4; // Major roads (~15-20m wide)
        minLOD = 1;
      } else if (
        props.highway === "tertiary" ||
        props.highway === "residential" ||
        props.highway === "unclassified"
      ) {
        color = { r: 255, g: 255, b: 255, a: 255 };
        width = 2; // Minor roads (~6-10m wide)
        minLOD = 2;
      } else if (
        props.highway === "footway" ||
        props.highway === "path" ||
        props.highway === "pedestrian" ||
        props.highway === "steps"
      ) {
        color = { r: 200, g: 200, b: 200, a: 255 };
        width = 1; // Footpaths
        minLOD = 1; // Show 2 zoom levels earlier (was 3)
      } else if (props.highway === "cycleway") {
        color = { r: 180, g: 200, b: 255, a: 255 }; // Light blue for cycle paths
        width = 1;
        minLOD = 3; // Only at very high zoom
      } else if (props.highway === "service" || props.highway === "track") {
        color = { r: 230, g: 230, b: 230, a: 255 };
        width = 1; // Service roads and tracks
        minLOD = 3;
      } else {
        // Unknown highway type - skip it to avoid rendering unexpected features
        return { layer: null, minLOD: 999, fill: false };
      }

      // Use actual width from OSM if available (in meters)
      if (props.width) {
        const widthMeters = parseFloat(props.width);
        if (!isNaN(widthMeters)) {
          // Scale width: ~10m road = 3px at standard zoom
          width = Math.max(1, Math.min(8, widthMeters / 3));
        }
      }

      // Assign to appropriate layer based on vertical position
      if (isTunnel) {
        color.a = 80; // 30% opacity for tunnels
        return { layer: "tunnels", color, minLOD, width, fill: false };
      } else if (isBridge) {
        return { layer: "bridges", color, minLOD, width, fill: false };
      } else {
        return { layer: "surface_roads", color, minLOD, width, fill: false };
      }
    }

    // Railways - determine layer based on tunnel/bridge/surface
    if (props.railway && type !== "Point") {
      const trackTypes = [
        "rail",
        "light_rail",
        "subway",
        "tram",
        "monorail",
        "narrow_gauge",
        "preserved",
      ];
      if (trackTypes.includes(props.railway) || !props.railway) {
        let color = { r: 153, g: 153, b: 153, a: 255 };
        const minLOD = 1;

        // Railway width based on type (controls spacing between rails and tie length)
        let width = 8; // Standard railway (~5-6m wide including tracks and bed)
        if (props.railway === "tram" || props.railway === "light_rail") {
          width = 6; // Trams are narrower
        } else if (props.railway === "narrow_gauge") {
          width = 6; // Narrow gauge railways
        }

        if (isTunnel) {
          color.a = 80; // 30% opacity for tunnels
          return {
            layer: "tunnels",
            color,
            minLOD,
            width,
            fill: false,
            isRailway: true,
          };
        } else if (isBridge) {
          return {
            layer: "bridges",
            color,
            minLOD,
            width,
            fill: false,
            isRailway: true,
          };
        } else {
          return {
            layer: "surface_railways",
            color,
            minLOD,
            width,
            fill: false,
            isRailway: true,
          };
        }
      }
    }

    // === POINTS ===

    if (type === "Point") {
      // Skip all highway-related points (street lamps, traffic signals, etc.)
      if (props.highway) {
        return { layer: null, minLOD: 999, fill: false };
      }

      // Only show meaningful POIs with names at very high zoom
      if (
        props.name &&
        (props.amenity || props.shop || props.tourism || props.historic)
      ) {
        return {
          layer: "points",
          color: { r: 100, g: 100, b: 100, a: 255 },
          minLOD: 3,
          fill: false,
        };
      }
      return { layer: null, minLOD: 999, fill: false }; // Skip other points
    }

    // Default: skip
    return { layer: null, minLOD: 999, fill: false };
  }

  renderLayer(layerFeatures, bounds, useFill) {
    for (const item of layerFeatures) {
      const { feature, props, type, color, fill, width, isRailway } = item;

      try {
        if (type === "Point") {
          const [lon, lat] = feature.geometry.coordinates;
          const screen = this.latLonToScreen(lat, lon, bounds);

          // Draw point using Canvas2D
          this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
          this.ctx.beginPath();
          this.ctx.arc(screen.x, screen.y, 3, 0, Math.PI * 2);
          this.ctx.fill();

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
            width || 1,
            isRailway || false,
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
            const screenCoords = this.renderLineString(
              line,
              color,
              bounds,
              width || 1,
              isRailway || false,
            );
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

  renderLineString(coordinates, color, bounds, width = 1, isRailway = false) {
    if (coordinates.length < 2) return [];

    // Use Canvas2D for line rendering
    const screenCoords = [];

    // Convert coordinates to screen space first
    for (let i = 0; i < coordinates.length; i++) {
      const screen = this.latLonToScreen(
        coordinates[i][1],
        coordinates[i][0],
        bounds,
      );
      screenCoords.push(screen);
    }

    if (isRailway) {
      // Draw railway pattern: two parallel rails with ties (sleepers)
      this.drawRailwayPattern(screenCoords, color, width);
    } else {
      // Regular line rendering
      this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
      this.ctx.lineWidth = width;
      this.ctx.lineCap = "round"; // Smooth line ends
      this.ctx.lineJoin = "round"; // Smooth corners
      this.ctx.beginPath();

      for (let i = 0; i < screenCoords.length; i++) {
        if (i === 0) {
          this.ctx.moveTo(screenCoords[i].x, screenCoords[i].y);
        } else {
          this.ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
        }
      }

      this.ctx.stroke();
    }

    return screenCoords;
  }

  drawRailwayPattern(screenCoords, color, width) {
    // Railway pattern: two parallel rails with perpendicular ties
    const railWidth = 1.5; // Width of each rail line
    const tieSpacing = 10; // Distance between ties in pixels
    const tieWidth = 2.5; // Width of tie line
    const railOffset = Math.max(width, 4); // Distance from center to each rail (minimum 4px apart)

    // Debug: verify this function is being called
    if (Math.random() < 0.01) {
      // Log 1% of the time to avoid spam
      console.log(
        `Drawing railway pattern: width=${width}, railOffset=${railOffset}`,
      );
    }

    this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    this.ctx.lineCap = "butt";
    this.ctx.lineJoin = "miter";

    // Draw two parallel rails
    for (let railSide = -1; railSide <= 1; railSide += 2) {
      this.ctx.lineWidth = railWidth;
      this.ctx.beginPath();

      for (let i = 0; i < screenCoords.length; i++) {
        const coord = screenCoords[i];

        // Calculate perpendicular offset for rails
        let perpX = 0,
          perpY = 0;
        if (i < screenCoords.length - 1) {
          const next = screenCoords[i + 1];
          const dx = next.x - coord.x;
          const dy = next.y - coord.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            perpX = (-dy / len) * railOffset * railSide;
            perpY = (dx / len) * railOffset * railSide;
          }
        } else if (i > 0) {
          const prev = screenCoords[i - 1];
          const dx = coord.x - prev.x;
          const dy = coord.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            perpX = (-dy / len) * railOffset * railSide;
            perpY = (dx / len) * railOffset * railSide;
          }
        }

        const railX = coord.x + perpX;
        const railY = coord.y + perpY;

        if (i === 0) {
          this.ctx.moveTo(railX, railY);
        } else {
          this.ctx.lineTo(railX, railY);
        }
      }

      this.ctx.stroke();
    }

    // Draw perpendicular ties (sleepers) along the track
    this.ctx.lineWidth = tieWidth;
    let distanceAlong = 0;

    for (let i = 0; i < screenCoords.length - 1; i++) {
      const start = screenCoords[i];
      const end = screenCoords[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      if (segmentLength === 0) continue;

      const dirX = dx / segmentLength;
      const dirY = dy / segmentLength;
      const perpX = -dirY;
      const perpY = dirX;

      let segmentDist = 0;
      while (segmentDist < segmentLength) {
        const t = segmentDist / segmentLength;
        const centerX = start.x + dx * t;
        const centerY = start.y + dy * t;

        // Draw tie perpendicular to the track
        const tieHalfLength = width * 0.8; // Ties extend beyond rails
        this.ctx.beginPath();
        this.ctx.moveTo(
          centerX - perpX * tieHalfLength,
          centerY - perpY * tieHalfLength,
        );
        this.ctx.lineTo(
          centerX + perpX * tieHalfLength,
          centerY + perpY * tieHalfLength,
        );
        this.ctx.stroke();

        segmentDist += tieSpacing;
        distanceAlong += tieSpacing;
      }
    }
  }

  renderPolygonOutline(coordinates, color, bounds) {
    // Render polygon as outline only (not filled)
    return this.renderLineString(coordinates, color, bounds);
  }

  renderPolygon(coordinates, color, bounds) {
    if (coordinates.length < 3) return [];

    // Use Canvas2D native fill - much faster than pixel-by-pixel in WASM
    const screenCoords = [];

    this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    this.ctx.beginPath();

    for (let i = 0; i < coordinates.length; i++) {
      const screen = this.latLonToScreen(
        coordinates[i][1],
        coordinates[i][0],
        bounds,
      );
      screenCoords.push(screen);

      if (i === 0) {
        this.ctx.moveTo(screen.x, screen.y);
      } else {
        this.ctx.lineTo(screen.x, screen.y);
      }
    }

    this.ctx.closePath();
    this.ctx.fill();

    return screenCoords;
  }

  clearCanvas() {
    // Clear canvas using Canvas2D
    this.ctx.fillStyle = "rgb(240, 248, 255)"; // Light blue background
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Cleared";
  }

  resetView() {
    this.zoom = 1.5; // Match initial zoom
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

  const canvasReady = await renderer.init();
  if (!canvasReady) {
    document.getElementById("loading").innerHTML =
      '<div style="color: red;">Failed to initialize canvas</div>';
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

  document.getElementById("zoomInBtn").addEventListener("click", () => {
    renderer.zoomIn();
  });

  document.getElementById("zoomOutBtn").addEventListener("click", () => {
    renderer.zoomOut();
  });

  // Auto-render on load
  renderer.renderMap();
  renderer.updateStats();
}

// Start the app when page loads
window.addEventListener("DOMContentLoaded", initApp);
