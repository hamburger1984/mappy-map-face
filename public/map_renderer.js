// Hamburg Map Renderer - Canvas2D with Zoom/Pan/Tooltips
// VERSION: 2024-POI-CATEGORIES

// POI category definitions with tag mappings
const POI_CATEGORIES = {
  food_drink: {
    label: "Food & Drink",
    color: { r: 231, g: 76, b: 60 },
    amenity: new Set([
      "restaurant",
      "fast_food",
      "cafe",
      "ice_cream",
      "food_court",
      "bbq",
    ]),
    shop: new Set([
      "bakery",
      "pastry",
      "deli",
      "confectionery",
      "butcher",
      "cheese",
      "seafood",
      "coffee",
      "tea",
      "wine",
      "beverages",
      "alcohol",
    ]),
  },
  shopping: {
    label: "Shopping",
    color: { r: 155, g: 89, b: 182 },
    shop: new Set([
      "hairdresser",
      "clothes",
      "kiosk",
      "supermarket",
      "convenience",
      "beauty",
      "jewelry",
      "florist",
      "chemist",
      "mobile_phone",
      "optician",
      "shoes",
      "furniture",
      "books",
      "bicycle",
      "car_repair",
      "tailor",
      "tattoo",
      "massage",
      "interior_decoration",
      "electronics",
      "hardware",
      "sports",
      "toys",
      "gift",
      "stationery",
      "pet",
      "photo",
      "music",
      "art",
      "bag",
      "fabric",
      "garden_centre",
      "hearing_aids",
      "travel_agency",
      "dry_cleaning",
      "laundry",
      "car",
      "car_parts",
      "tyres",
      "motorcycle",
    ]),
    amenity: new Set(["marketplace", "vending_machine"]),
  },
  health: {
    label: "Health",
    color: { r: 46, g: 204, b: 113 },
    amenity: new Set([
      "doctors",
      "dentist",
      "pharmacy",
      "hospital",
      "clinic",
      "veterinary",
      "nursing_home",
    ]),
  },
  tourism: {
    label: "Tourism",
    color: { r: 230, g: 126, b: 34 },
    tourism: new Set([
      "artwork",
      "hotel",
      "museum",
      "viewpoint",
      "information",
      "attraction",
      "guest_house",
      "hostel",
      "gallery",
      "camp_site",
      "picnic_site",
      "zoo",
      "theme_park",
      "motel",
      "apartment",
    ]),
  },
  historic: {
    label: "Historic",
    color: { r: 139, g: 69, b: 19 },
    historic: new Set([
      "memorial",
      "boundary_stone",
      "monument",
      "castle",
      "ruins",
      "archaeological_site",
      "building",
      "church",
      "manor",
      "city_gate",
      "wayside_cross",
      "wayside_shrine",
      "heritage",
      "milestone",
      "tomb",
      "technical_monument",
      "highwater_mark",
    ]),
  },
  services: {
    label: "Services",
    color: { r: 52, g: 152, b: 219 },
    amenity: new Set([
      "bank",
      "post_office",
      "library",
      "police",
      "fire_station",
      "townhall",
      "courthouse",
      "embassy",
      "community_centre",
      "social_facility",
      "place_of_worship",
      "cinema",
      "theatre",
      "arts_centre",
      "driving_school",
      "recycling",
      "post_box",
      "atm",
      "bureau_de_change",
      "toilets",
      "events_venue",
      "childcare",
    ]),
  },
  transport: {
    label: "Transport",
    color: { r: 26, g: 188, b: 156 },
    amenity: new Set([
      "bicycle_rental",
      "parking",
      "parking_entrance",
      "fuel",
      "charging_station",
      "car_sharing",
      "taxi",
      "bus_station",
      "ferry_terminal",
      "car_rental",
      "boat_rental",
    ]),
  },
  education: {
    label: "Education",
    color: { r: 243, g: 156, b: 18 },
    amenity: new Set([
      "kindergarten",
      "school",
      "university",
      "college",
      "music_school",
      "language_school",
      "training",
    ]),
  },
  nightlife: {
    label: "Nightlife",
    color: { r: 233, g: 30, b: 144 },
    amenity: new Set([
      "bar",
      "pub",
      "nightclub",
      "biergarten",
      "casino",
      "gambling",
      "hookah_lounge",
    ]),
  },
};

// Classification priority order for amenity tags
const POI_AMENITY_PRIORITY = [
  "food_drink",
  "nightlife",
  "health",
  "education",
  "transport",
  "services",
];

class MapRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.mapData = null;
    this.canvasWidth = 1200;
    this.canvasHeight = 800;

    // Viewport state (in real-world meters)
    this.viewWidthMeters = 10000; // Initial view: 10km across
    this.offsetX = 0;
    this.offsetY = 0;
    this.minViewWidthMeters = 100; // Max zoom: 100m across
    this.maxViewWidthMeters = 200000; // Min zoom: 200km across (full dataset)

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
    this.hoverInfoEnabled = false; // Toggle for hover info mode

    // POI category state and glyph cache
    this.glyphCache = {}; // categoryId -> { canvas, size }
    this.poiCategoryState = {}; // categoryId -> boolean
    for (const catId of Object.keys(POI_CATEGORIES)) {
      this.poiCategoryState[catId] = true; // all enabled by default
    }
    this._poiRenderQueue = [];

    // Performance optimizations
    this.renderTimeout = null;
    this.renderDelay = 50; // ms delay for debouncing
    this.isRendering = false;

    // Tile system
    this.tileCache = new Map(); // Cache for loaded tiles
    this.tileIndex = null; // Tile index metadata
    this.loadingTiles = new Set(); // Track in-flight tile requests
    this.tileBounds = {
      minLon: 8.48,
      maxLon: 11.5,
      minLat: 52.65,
      maxLat: 54.45,
    };

    // Object pools to reduce GC pressure
    this._pointPool = []; // Reusable {x, y} objects
    this._pointPoolIndex = 0;
    this._coordArrayPool = []; // Reusable coordinate arrays
    this._rgbaCache = new Map(); // Cache rgba() strings to avoid recreating

    // Canvas panning optimization
    this._offscreenCanvas = null; // Store last rendered frame
    this._lastRenderOffset = { x: 0, y: 0 }; // Track offset when last rendered

    // Pre-allocate point objects for pooling
    for (let i = 0; i < 10000; i++) {
      this._pointPool.push({ x: 0, y: 0 });
    }
  }

  async init() {
    try {
      // Set up HTML canvas
      this.canvas = document.getElementById("mapCanvas");
      this.ctx = this.canvas.getContext("2d");

      // Set up event listeners for zoom and pan
      this.setupInteractions();

      // Pre-render POI glyph sprites and create toggle buttons
      this.initGlyphCache();
      this.initPOIToggles();

      return true;
    } catch (error) {
      console.error("Failed to initialize canvas:", error);
      return false;
    }
  }

  initGlyphCache() {
    const glyphSize = 16;
    for (const [catId, catDef] of Object.entries(POI_CATEGORIES)) {
      const offscreen = document.createElement("canvas");
      offscreen.width = glyphSize;
      offscreen.height = glyphSize;
      const ctx = offscreen.getContext("2d");
      this.drawGlyph(ctx, catId, catDef.color, glyphSize);
      this.glyphCache[catId] = { canvas: offscreen, size: glyphSize };
    }
  }

  drawGlyph(ctx, categoryId, color, size) {
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;
    const colorStr = `rgb(${color.r},${color.g},${color.b})`;

    // Helper: stroke white halo then colored fill for a path
    const haloStroke = (lineWidth) => {
      ctx.lineWidth = lineWidth + 2;
      ctx.strokeStyle = "white";
      ctx.stroke();
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = colorStr;
      ctx.stroke();
    };
    const haloFill = () => {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "white";
      ctx.stroke();
      ctx.fillStyle = colorStr;
      ctx.fill();
    };

    switch (categoryId) {
      case "food_drink": {
        // Fork and knife
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.4, cy + r);
        ctx.lineTo(cx - r * 0.1, cy - r);
        ctx.moveTo(cx + r * 0.4, cy + r);
        ctx.lineTo(cx + r * 0.1, cy - r);
        haloStroke(1.5);
        break;
      }
      case "shopping": {
        // Shopping bag
        const bw = r * 1.3,
          bh = r * 1.2;
        ctx.beginPath();
        ctx.rect(cx - bw / 2, cy - bh / 2 + 1, bw, bh);
        haloFill();
        // Handle
        ctx.beginPath();
        ctx.arc(cx, cy - bh / 2 + 1, bw * 0.28, Math.PI, 0);
        haloStroke(1.5);
        break;
      }
      case "health": {
        // Medical cross
        const cw = r * 0.5,
          ch = r * 1.3;
        ctx.beginPath();
        ctx.rect(cx - cw / 2, cy - ch / 2, cw, ch);
        ctx.rect(cx - ch / 2, cy - cw / 2, ch, cw);
        haloFill();
        break;
      }
      case "tourism": {
        // Info "i" in circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
        haloFill();
        // White "i"
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(cx, cy - r * 0.35, r * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(cx - r * 0.12, cy - r * 0.1, r * 0.24, r * 0.7);
        break;
      }
      case "historic": {
        // Monument/obelisk
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.35, cy + r);
        ctx.lineTo(cx + r * 0.35, cy + r);
        ctx.lineTo(cx + r * 0.2, cy - r * 0.4);
        ctx.lineTo(cx, cy - r);
        ctx.lineTo(cx - r * 0.2, cy - r * 0.4);
        ctx.closePath();
        haloFill();
        break;
      }
      case "services": {
        // Gear circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
        haloFill();
        // White inner circle
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        break;
      }
      case "transport": {
        // Bus front view
        const bw2 = r * 1.2,
          bh2 = r * 1.3;
        ctx.beginPath();
        ctx.roundRect(cx - bw2 / 2, cy - bh2 / 2, bw2, bh2, 2);
        haloFill();
        // Windshield (white rect)
        ctx.fillStyle = "white";
        ctx.fillRect(cx - bw2 * 0.35, cy - bh2 * 0.3, bw2 * 0.7, bh2 * 0.35);
        break;
      }
      case "education": {
        // Book shape
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r * 0.3);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        haloFill();
        break;
      }
      case "nightlife": {
        // Cocktail glass
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.75, cy - r * 0.6);
        ctx.lineTo(cx + r * 0.75, cy - r * 0.6);
        ctx.lineTo(cx, cy + r * 0.2);
        ctx.closePath();
        haloFill();
        // Stem
        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.2);
        ctx.lineTo(cx, cy + r * 0.8);
        ctx.moveTo(cx - r * 0.35, cy + r * 0.8);
        ctx.lineTo(cx + r * 0.35, cy + r * 0.8);
        haloStroke(1.2);
        break;
      }
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

        // Instant canvas translation while dragging
        this.translateCanvas(dx, dy);

        // Schedule full redraw after user stops moving
        this.debouncedRender();
      } else {
        // Check for feature hover (only if hover info is enabled and nothing is selected)
        if (this.hoverInfoEnabled && !this.selectedFeature) {
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
          // Store the feature reference for persistent selection
          this.selectedFeature = this.hoveredFeature;
          this.updateInfoPanel(this.selectedFeature);
          this.renderMap(); // Re-render to show selection highlight
        } else if (this.selectedFeature) {
          // Clicked on empty space - deselect
          this.selectedFeature = null;
          this.clearInfoPanel();
          this.renderMap();
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
        this.setViewWidth(this.viewWidthMeters / zoomFactor); // inverted: larger distance = zoom in
        touchStartDist = dist;
      }
    });

    // Scroll wheel zoom (logarithmic)
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.002;
        const logViewWidth = Math.log2(this.viewWidthMeters) - delta; // inverted: scroll up = zoom in = smaller view
        this.setViewWidth(Math.pow(2, logViewWidth));
      },
      { passive: false },
    );
  }

  // Helper to convert viewWidthMeters to old zoom factor for calculations
  getZoomFactor() {
    // BASE_LAT_RANGE = 1.8 degrees ≈ 200km at zoom=1
    // viewWidthMeters = 200000 / zoom, so zoom = 200000 / viewWidthMeters
    return 200000 / this.viewWidthMeters;
  }

  setViewWidth(newWidthMeters) {
    newWidthMeters = Math.max(
      this.minViewWidthMeters,
      Math.min(this.maxViewWidthMeters, newWidthMeters),
    );
    if (newWidthMeters === this.viewWidthMeters) return;
    const scale = this.viewWidthMeters / newWidthMeters; // inverted because larger width = zoomed out
    this.offsetX *= scale;
    this.offsetY *= scale;
    this.viewWidthMeters = newWidthMeters;
    this.updateZoomSlider();
    this.updateStats();
    this.debouncedRender();
  }

  zoomIn() {
    // Decrease view width by 10% (zoom in = see less area)
    this.setViewWidth(this.viewWidthMeters * 0.9);
  }

  zoomOut() {
    // Increase view width by 11% (zoom out = see more area)
    this.setViewWidth(this.viewWidthMeters / 0.9);
  }

  updateZoomSlider() {
    const slider = document.getElementById("zoomSlider");
    if (slider) {
      // Map viewWidthMeters to slider (log scale, inverted)
      const logMin = Math.log2(this.minViewWidthMeters);
      const logMax = Math.log2(this.maxViewWidthMeters);
      const logCurrent = Math.log2(this.viewWidthMeters);
      // Invert: small viewWidth (zoomed in) = high slider value
      slider.value = logMax + logMin - logCurrent;
    }
  }

  checkFeatureHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find feature at this position (iterate reverse so topmost features match first)
    let found = null;
    for (let i = this.renderedFeatures.length - 1; i >= 0; i--) {
      if (this.isPointNearFeature(x, y, this.renderedFeatures[i])) {
        found = this.renderedFeatures[i];
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

  updateFeatureScreenCoords(feature, bounds) {
    // Recalculate screen coordinates for a feature based on current viewport
    // Uses the stored renderedFeature type (not geom.type, which may differ for Multi* types)
    if (!feature.feature || !feature.feature.geometry) return;

    const geom = feature.feature.geometry;

    if (feature.type === "Point") {
      const [lon, lat] = geom.coordinates;
      const screenPos = this.latLonToScreen(lat, lon, bounds);
      feature.screenX = screenPos.x;
      feature.screenY = screenPos.y;
    } else if (feature.type === "LineString") {
      // For MultiLineString, geom.coordinates is array of line arrays
      // The renderedFeature was created from one line, but we stored the full geometry
      // Use the screenCoords length to find the matching ring
      const coords =
        geom.type === "LineString"
          ? geom.coordinates
          : this.findMatchingCoords(
              feature.screenCoords.length,
              geom.coordinates,
            );
      if (coords) {
        feature.screenCoords = coords.map(([lon, lat]) =>
          this.latLonToScreen(lat, lon, bounds),
        );
      }
    } else if (feature.type === "Polygon") {
      // For MultiPolygon, each polygon's outer ring was stored separately
      const ring =
        geom.type === "Polygon"
          ? geom.coordinates[0]
          : this.findMatchingCoords(
              feature.screenCoords.length,
              geom.coordinates.map((p) => p[0]),
            );
      if (ring) {
        feature.screenCoords = ring.map(([lon, lat]) =>
          this.latLonToScreen(lat, lon, bounds),
        );
      }
    }
  }

  findMatchingCoords(targetLength, coordArrays) {
    // Find the coordinate array that matches the expected length
    for (const coords of coordArrays) {
      if (coords.length === targetLength) return coords;
    }
    return coordArrays[0]; // Fallback to first
  }

  highlightFeature(feature, bounds, mode) {
    // mode: "hovered" or "selected"
    const isSelected = mode === "selected";

    // Recalculate screen coordinates for current viewport
    if (feature.feature) {
      this.updateFeatureScreenCoords(feature, bounds);
    }

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
    // Determine which tile zoom level to use based on view width
    // Wide view (>10km): use Z8 tiles
    // Medium view (1-10km): use Z11 tiles
    // Close view (<1km): use Z14 tiles
    if (this.viewWidthMeters > 10000) return 8;
    if (this.viewWidthMeters > 1000) return 11;
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
      const response = await fetch(`tiles/${z}/${x}/${y}.json`);

      if (!response.ok) {
        // Tile doesn't exist (no data in this area)
        this.loadingTiles.delete(key);
        this.tileCache.set(key, { type: "FeatureCollection", features: [] });
        return this.tileCache.get(key);
      }

      // Parse JSON directly (no decompression needed)
      const tileData = await response.json();

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

    console.log(
      `[TILES] Loading ${tiles.length} tiles at zoom ${tiles[0]?.z || "unknown"}`,
    );

    // Load all visible tiles in parallel
    const loadStart = performance.now();
    const tilePromises = tiles.map(({ z, x, y }) => this.loadTile(z, x, y));
    const tileData = await Promise.all(tilePromises);
    const loadTime = performance.now() - loadStart;

    console.log(`[TILES] Loaded in ${loadTime.toFixed(0)}ms`);

    // Merge all tile features into a single GeoJSON
    const mergeStart = performance.now();
    const features = [];
    for (const tile of tileData) {
      if (tile && tile.features) {
        features.push(...tile.features);
      }
    }
    const mergeTime = performance.now() - mergeStart;

    console.log(
      `[TILES] Merged ${features.length} features in ${mergeTime.toFixed(0)}ms`,
    );

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

  // Get a pooled point object (reduces allocations)
  _getPooledPoint(x, y) {
    if (this._pointPoolIndex >= this._pointPool.length) {
      // Pool exhausted, allocate new (shouldn't happen often)
      return { x, y };
    }
    const point = this._pointPool[this._pointPoolIndex++];
    point.x = x;
    point.y = y;
    return point;
  }

  // Reset point pool for next frame
  _resetPointPool() {
    this._pointPoolIndex = 0;
  }

  // Get cached rgba string (reduces string allocations)
  _getRGBA(r, g, b, a) {
    const key = `${r},${g},${b},${a}`;
    let rgba = this._rgbaCache.get(key);
    if (!rgba) {
      rgba = `rgba(${r},${g},${b},${a})`;
      this._rgbaCache.set(key, rgba);
    }
    return rgba;
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

    return this._getPooledPoint(x, y);
  }

  async renderMap() {
    const startTime = performance.now();
    const perfTimings = {}; // Track performance of each step

    // Reset object pools for this frame
    this._resetPointPool();

    // Calculate and set map bounds
    const boundsStart = performance.now();
    const bounds = this.calculateBounds();
    perfTimings.bounds = performance.now() - boundsStart;

    const viewKm =
      this.viewWidthMeters >= 1000
        ? `${(this.viewWidthMeters / 1000).toFixed(1)}km`
        : `${this.viewWidthMeters.toFixed(0)}m`;
    console.log(`[RENDER] View: ${viewKm} across, LOD: ${this.getLOD()}`);

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
    // These match the Hamburg region bounds (~100km radius)
    const BASE_LAT_RANGE = 1.8; // Hamburg region latitude range
    const BASE_LON_RANGE = 3.02; // Hamburg region longitude range
    const baseLatRange = BASE_LAT_RANGE;
    const baseLonRange = BASE_LON_RANGE;

    // Calculate visible range accounting for zoom
    // We need to maintain aspect ratio: lonRange should be canvasAspect times latRange (in screen space)
    // But in geographic space, we need to account for Mercator distortion
    const latRange = baseLatRange / this.getZoomFactor();
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
    perfTimings.tileLoad = performance.now() - tileLoadStart;

    // Update tile stats
    document.getElementById("tileCount").textContent = visibleTiles.length;
    document.getElementById("cachedTiles").textContent = cachedCount;
    document.getElementById("tileLoadTime").textContent =
      perfTimings.tileLoad.toFixed(2);

    // Tile loading stats available in UI

    let featureCount = 0;
    let culledCount = 0;
    let lodCulledCount = 0;
    this.renderedFeatures.length = 0;

    // Determine LOD (Level of Detail) based on zoom
    // At low zoom: only major features
    // At high zoom: all details
    const lod = this.getLOD();

    // Start feature classification timing
    const classifyStart = performance.now();

    // Reuse layer arrays (avoid reallocating every frame)
    if (!this._layers) {
      this._layers = {
        natural_background: [],
        forests: [],
        water_areas: [],
        landuse_areas: [],
        buildings: [],
        tunnels: [],
        waterways: [],
        surface_roads: [],
        surface_railways: [],
        points: [],
      };
    }
    const layers = this._layers;
    for (const key in layers) layers[key].length = 0;

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

      // Use cached classification if available, otherwise classify and cache
      let featureInfo = feature._classCache;
      if (!featureInfo) {
        featureInfo = this.classifyFeature(props, type);
        // Pre-compute batch keys to avoid string allocations in render loop
        if (featureInfo.color) {
          const c = featureInfo.color;
          const w = featureInfo.width || 1;
          featureInfo._lineKey = `${c.r},${c.g},${c.b},${c.a}|${w}`;
          featureInfo._fillKey = this._getRGBA(c.r, c.g, c.b, c.a / 255);
        }
        feature._classCache = featureInfo;
      }

      // For POIs, check toggle state dynamically (it can change without re-classifying)
      if (
        featureInfo.poiCategory &&
        !this.poiCategoryState[featureInfo.poiCategory]
      ) {
        continue;
      }

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
          width: featureInfo.width,
          isRailway: featureInfo.isRailway,
          roadPriority: featureInfo.roadPriority,
          isConstruction: featureInfo.isConstruction,
          poiCategory: featureInfo.poiCategory,
          _lineKey: featureInfo._lineKey,
          _fillKey: featureInfo._fillKey,
        });
      }
    }

    perfTimings.classify = performance.now() - classifyStart;

    // Start rendering timing
    const renderStart = performance.now();

    // Use a neutral land-colored background
    // Water features (rivers, lakes, sea) will render as blue on top
    this.ctx.fillStyle = "rgb(242, 239, 233)"; // Light tan/beige for land
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    perfTimings.clearCanvas = performance.now() - renderStart;

    // Render all layers in correct z-order using Canvas2D
    // Background to foreground (bottom to top)
    const layerTimings = {};

    // 1. Natural background (parks, farmland, meadows)
    let layerStart = performance.now();
    this.renderLayer(layers.natural_background, adjustedBounds, true);
    layerTimings.natural = performance.now() - layerStart;

    // 1b. Forests (on top of parks so they're visible inside parks)
    layerStart = performance.now();
    this.renderLayer(layers.forests, adjustedBounds, true);
    layerTimings.forests = performance.now() - layerStart;

    // 2. Water areas (lakes, rivers)
    layerStart = performance.now();
    this.renderLayer(layers.water_areas, adjustedBounds, true);
    layerTimings.water = performance.now() - layerStart;

    // 3. Landuse areas (commercial, industrial, residential)
    layerStart = performance.now();
    this.renderLayer(layers.landuse_areas, adjustedBounds, true);
    layerTimings.landuse = performance.now() - layerStart;

    // 4. Buildings
    layerStart = performance.now();
    this.renderLayer(layers.buildings, adjustedBounds, true);
    layerTimings.buildings = performance.now() - layerStart;

    // 5. Tunnels (underground, semi-transparent)
    layerStart = performance.now();
    this.renderRoadLayer(layers.tunnels, adjustedBounds);
    layerTimings.tunnels = performance.now() - layerStart;

    // 6. Waterways (rivers, streams as lines)
    layerStart = performance.now();
    this.renderLayer(layers.waterways, adjustedBounds, false);
    layerTimings.waterways = performance.now() - layerStart;

    // 7. Surface roads (sorted by priority, with outlines)
    layerStart = performance.now();
    this.renderRoadLayer(layers.surface_roads, adjustedBounds);
    layerTimings.roads = performance.now() - layerStart;

    // 8. Surface railways
    layerStart = performance.now();
    this.renderLayer(layers.surface_railways, adjustedBounds, false);
    layerTimings.railways = performance.now() - layerStart;

    // 9. Points (always on top)
    layerStart = performance.now();
    this.renderLayer(layers.points, adjustedBounds, false);
    layerTimings.points = performance.now() - layerStart;

    // 11. Highlight hovered or selected feature on top of everything
    layerStart = performance.now();
    if (this.selectedFeature) {
      this.highlightFeature(this.selectedFeature, adjustedBounds, "selected");
    } else if (this.hoveredFeature) {
      this.highlightFeature(this.hoveredFeature, adjustedBounds, "hovered");
    }
    layerTimings.highlight = performance.now() - layerStart;

    perfTimings.totalRender = performance.now() - renderStart;

    featureCount = Object.values(layers).reduce(
      (sum, layer) => sum + layer.length,
      0,
    );

    const endTime = performance.now();
    const renderTime = (endTime - startTime).toFixed(2);

    // Log performance breakdown
    console.log("[PERF] Render breakdown:");
    console.log(`  Total: ${renderTime}ms`);
    console.log(`  ├─ Bounds calc: ${perfTimings.bounds.toFixed(2)}ms`);
    console.log(`  ├─ Tile load: ${perfTimings.tileLoad.toFixed(2)}ms`);
    console.log(
      `  ├─ Classify: ${perfTimings.classify.toFixed(2)}ms (${featureCount} features, ${culledCount} culled, ${lodCulledCount} LOD culled)`,
    );
    console.log(`  └─ Render: ${perfTimings.totalRender.toFixed(2)}ms`);

    // Find slowest layers (> 5ms)
    const slowLayers = Object.entries(layerTimings)
      .filter(([_, time]) => time > 5)
      .sort((a, b) => b[1] - a[1])
      .map(([name, time]) => `${name}: ${time.toFixed(2)}ms`)
      .join(", ");
    if (slowLayers) {
      console.log(`  └─ Slow layers: ${slowLayers}`);
    }

    document.getElementById("featureCount").textContent = featureCount;
    document.getElementById("renderTime").textContent = renderTime;
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Rendered";

    // Save rendered frame for canvas translation optimization
    this.saveOffscreenCanvas();
    this._lastRenderOffset = { x: this.offsetX, y: this.offsetY };

    // Render stats available in UI
  }

  // Save current canvas to offscreen buffer for panning optimization
  saveOffscreenCanvas() {
    if (!this._offscreenCanvas) {
      this._offscreenCanvas = document.createElement("canvas");
    }
    this._offscreenCanvas.width = this.canvas.width;
    this._offscreenCanvas.height = this.canvas.height;
    const offCtx = this._offscreenCanvas.getContext("2d");
    offCtx.drawImage(this.canvas, 0, 0);
  }

  // Instantly translate canvas during drag (smooth panning)
  translateCanvas(dx, dy) {
    if (!this._offscreenCanvas) return;

    // Calculate total offset since last full render
    const totalDx = this.offsetX - this._lastRenderOffset.x;
    const totalDy = this.offsetY - this._lastRenderOffset.y;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw saved frame translated by total accumulated offset
    this.ctx.drawImage(this._offscreenCanvas, totalDx, totalDy);
  }

  getLOD() {
    // Return LOD level based on view width
    // 0: Very zoomed out (show only major features) - >20km
    // 1: Medium zoom (show major + secondary features) - 7.5-20km
    // 2: Zoomed in (show most features) - 3-7.5km
    // 3: Very zoomed in (show all details) - <3km
    if (this.viewWidthMeters > 20000) return 0;
    if (this.viewWidthMeters > 7500) return 1;
    if (this.viewWidthMeters > 3000) return 2;
    return 3;
  }

  classifyPOI(props) {
    const amenity = props.amenity;
    const shop = props.shop;
    const tourism = props.tourism;
    const historic = props.historic;

    // Check amenity tags first (highest priority)
    if (amenity) {
      for (const catId of POI_AMENITY_PRIORITY) {
        const catDef = POI_CATEGORIES[catId];
        if (catDef.amenity && catDef.amenity.has(amenity)) return catId;
      }
      // Also check shopping's amenity set
      if (POI_CATEGORIES.shopping.amenity.has(amenity)) return "shopping";
    }
    // Check shop tags
    if (shop) {
      for (const [catId, catDef] of Object.entries(POI_CATEGORIES)) {
        if (catDef.shop && catDef.shop.has(shop)) return catId;
      }
      return "shopping"; // fallback for unrecognized shops
    }
    // Check tourism tags
    if (tourism) {
      if (POI_CATEGORIES.tourism.tourism.has(tourism)) return "tourism";
      return "tourism"; // fallback
    }
    // Check historic tags
    if (historic) {
      if (POI_CATEGORIES.historic.historic.has(historic)) return "historic";
      return "historic"; // fallback
    }
    // Unmatched amenity -> services
    if (amenity) return "services";
    return null;
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
      if (isForest) {
        return {
          layer: "forests",
          color: { r: 173, g: 209, b: 158, a: 255 }, // Dark green
          minLOD: 0,
          fill: true,
        };
      }
      const color =
        props.leisure === "park" ||
        props.landuse === "grass" ||
        props.landuse === "meadow"
          ? { r: 200, g: 230, b: 180, a: 255 } // Light green for parks
          : { r: 238, g: 240, b: 213, a: 255 }; // Beige for farmland
      return {
        layer: "natural_background",
        color: color,
        minLOD: 1,
        fill: true,
      };
    }

    // Water areas (filled polygons, including coastline)
    if (
      props.natural === "water" ||
      props.water ||
      props.waterway === "riverbank" ||
      props.natural === "coastline"
    ) {
      return {
        layer: "water_areas",
        color: { r: 170, g: 211, b: 223, a: 255 },
        minLOD: 0,
        fill: true,
      };
    }

    // Landuse areas
    if (props.landuse === "residential") {
      return {
        layer: "landuse_areas",
        color: { r: 224, g: 224, b: 224, a: 255 }, // Light gray
        minLOD: 1,
        fill: true,
      };
    }
    if (props.landuse === "commercial" || props.landuse === "retail") {
      return {
        layer: "landuse_areas",
        color: { r: 243, g: 233, b: 234, a: 255 }, // Very subtle pink/rose
        minLOD: 1,
        fill: true,
      };
    }
    if (props.landuse === "industrial") {
      return {
        layer: "landuse_areas",
        color: { r: 240, g: 233, b: 240, a: 255 }, // Very subtle purple
        minLOD: 1,
        fill: true,
      };
    }
    if (
      props.landuse === "cemetery" ||
      props.landuse === "allotments" ||
      props.landuse === "recreation_ground" ||
      props.leisure === "garden" ||
      props.leisure === "playground" ||
      props.leisure === "pitch" ||
      props.leisure === "sports_centre"
    ) {
      return {
        layer: "landuse_areas",
        color: { r: 218, g: 238, b: 205, a: 255 }, // Very subtle green
        minLOD: 1,
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

      // Remap construction roads to their target type
      let isConstruction = false;
      let effectiveHighway = props.highway;
      if (props.highway === "construction" && props.construction) {
        effectiveHighway = props.construction;
        isConstruction = true;
      }

      // Determine color and base width based on road type
      // Real lane widths: ~3.5m per lane
      // Motorway: 2-4 lanes = 7-14m
      // Primary: 2 lanes = 7m
      // Tertiary/residential: 1-2 lanes = 3.5-7m
      // Service: 1 lane = 3.5m

      let color;
      let minLOD;
      let realWidthMeters; // Real-world width in meters

      let roadPriority; // Lower = drawn first (underneath), higher = drawn on top

      if (effectiveHighway === "motorway" || effectiveHighway === "trunk") {
        color = { r: 233, g: 115, b: 103, a: 255 }; // OSM motorway orange
        realWidthMeters = 14; // ~4 lanes
        minLOD = 0;
        roadPriority = 7;
      } else if (effectiveHighway === "primary") {
        color = { r: 249, g: 207, b: 144, a: 255 }; // OSM primary yellow
        realWidthMeters = 7; // ~2 lanes
        minLOD = 0; // Show at all zoom levels (including 25km)
        roadPriority = 6;
      } else if (effectiveHighway === "secondary") {
        color = { r: 248, g: 234, b: 164, a: 255 }; // OSM secondary light yellow
        realWidthMeters = 7; // ~2 lanes
        minLOD = 1;
        roadPriority = 5;
      } else if (effectiveHighway === "tertiary") {
        color = { r: 255, g: 255, b: 255, a: 255 }; // OSM tertiary white
        realWidthMeters = 6; // ~1.5 lanes
        minLOD = 1;
        roadPriority = 4;
      } else if (
        effectiveHighway === "residential" ||
        effectiveHighway === "unclassified"
      ) {
        color = { r: 255, g: 255, b: 255, a: 255 }; // OSM residential white
        realWidthMeters = 5; // ~1-2 lanes
        minLOD = 1;
        roadPriority = 3;
      } else if (
        effectiveHighway === "service" ||
        effectiveHighway === "track"
      ) {
        color = { r: 255, g: 255, b: 255, a: 255 }; // OSM service white
        realWidthMeters = 3.5; // 1 lane
        minLOD = 3;
        roadPriority = 2;
      } else if (
        effectiveHighway === "footway" ||
        effectiveHighway === "path" ||
        effectiveHighway === "pedestrian" ||
        effectiveHighway === "steps"
      ) {
        color = { r: 250, g: 190, b: 165, a: 255 }; // OSM footway salmon/pink
        realWidthMeters = 2; // Footpaths
        minLOD = 1;
        roadPriority = 0;
      } else if (effectiveHighway === "cycleway") {
        color = { r: 120, g: 150, b: 255, a: 255 }; // OSM cycleway blue
        realWidthMeters = 2; // Cycle paths
        minLOD = 3;
        roadPriority = 1;
      } else {
        // Unknown highway type - skip it to avoid rendering unexpected features
        return { layer: null, minLOD: 999, fill: false };
      }

      // Calculate width based on view and real-world size
      // Width should scale: 1px minimum, real width when zoomed in enough
      const metersPerPixel = this.viewWidthMeters / this.canvasWidth;
      const calculatedWidth = realWidthMeters / metersPerPixel;
      let width = Math.max(1, Math.min(10, calculatedWidth)); // Clamp between 1-10px

      // Use actual width from OSM if available (in meters)
      if (props.width) {
        const widthMeters = parseFloat(props.width);
        if (!isNaN(widthMeters)) {
          // Scale width based on actual OSM width
          const osmCalculatedWidth = widthMeters / metersPerPixel;
          width = Math.max(1, Math.min(10, osmCalculatedWidth));
        }
      }

      // Assign to appropriate layer based on vertical position
      if (isTunnel) {
        color.a = 80; // 30% opacity for tunnels
        return {
          layer: "tunnels",
          color,
          minLOD,
          width,
          fill: false,
          roadPriority,
          isConstruction,
        };
      } else {
        return {
          layer: "surface_roads",
          color,
          minLOD,
          width,
          fill: false,
          roadPriority,
          isConstruction,
        };
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

        // Railway width based on type (controls spacing between rails and tie length)
        let width = 8; // Standard railway (~5-6m wide including tracks and bed)
        let minLOD = 0; // Standard rail: show at all zoom levels (including 25km)

        if (props.railway === "tram" || props.railway === "light_rail") {
          width = 6; // Trams are narrower
          minLOD = 1; // Trams/light rail: only show at closer zoom
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

      // Categorize named POIs
      if (
        props.name &&
        (props.amenity || props.shop || props.tourism || props.historic)
      ) {
        const poiCategory = this.classifyPOI(props);
        if (poiCategory) {
          const catDef = POI_CATEGORIES[poiCategory];
          return {
            layer: "points",
            color: {
              r: catDef.color.r,
              g: catDef.color.g,
              b: catDef.color.b,
              a: 255,
            },
            minLOD: 3,
            fill: false,
            poiCategory,
          };
        }
      }
      return { layer: null, minLOD: 999, fill: false }; // Skip other points
    }

    // Default: skip
    return { layer: null, minLOD: 999, fill: false };
  }

  renderRoadLayer(layerFeatures, bounds) {
    // Separate railways from roads (construction roads stay with normal roads)
    const roads = [];
    const railways = [];
    for (const item of layerFeatures) {
      if (item.isRailway) {
        railways.push(item);
      } else {
        roads.push(item);
      }
    }

    // Render railways via the standard layer renderer
    if (railways.length > 0) {
      this.renderLayer(railways, bounds, false);
    }

    // Sort roads by priority: lower priority drawn first (underneath)
    const sorted = roads.sort(
      (a, b) => (a.roadPriority || 0) - (b.roadPriority || 0),
    );

    // Group features by priority level
    const byPriority = new Map();
    for (const item of sorted) {
      const p = item.roadPriority || 0;
      if (!byPriority.has(p)) byPriority.set(p, []);
      byPriority.get(p).push(item);
    }

    // Pre-compute bounds scaling
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    // For each priority level (low to high): draw outlines, then fills
    // This ensures same-priority roads join cleanly at intersections
    for (const [priority, items] of byPriority) {
      // Collect flat screen coords for each feature in this priority group
      const featureCoords = [];
      for (const item of items) {
        const { feature, props, type, color, width } = item;
        const geom = feature.geometry;
        if (!geom || !geom.coordinates) continue;

        const coordArrays =
          type === "LineString"
            ? [geom.coordinates]
            : type === "MultiLineString"
              ? geom.coordinates
              : null;
        if (!coordArrays) continue;

        for (const coords of coordArrays) {
          if (coords.length < 2) continue;
          const flat = new Array(coords.length * 2);
          const screenCoords =
            this.hoverInfoEnabled || this.selectedFeature
              ? new Array(coords.length)
              : null;
          for (let i = 0; i < coords.length; i++) {
            const sx = toScreenX(coords[i][0]);
            const sy = toScreenY(coords[i][1]);
            flat[i * 2] = sx;
            flat[i * 2 + 1] = sy;
            if (screenCoords) screenCoords[i] = { x: sx, y: sy };
          }
          featureCoords.push({
            flat,
            color,
            width: width || 1,
            isConstruction: item.isConstruction,
          });
          if (screenCoords) {
            this.renderedFeatures.push({
              type: "LineString",
              screenCoords,
              properties: props,
              feature,
              geometry: geom,
            });
          }
        }
      }

      if (featureCoords.length === 0) continue;

      // Unified road rendering: border stroke + fill stroke for all roads.
      // Border color blends from darkened road color (thin) toward black (wide).
      const roadFeatures = [];
      const constructionFlats = [];
      for (const fc of featureCoords) {
        if (fc.isConstruction) {
          constructionFlats.push(fc);
        } else {
          roadFeatures.push(fc);
        }
      }

      if (roadFeatures.length > 0) {
        // Pass 1: border stroke
        // Blend factor: 0 at width=1 (pure darkened color), 1 at width>=6 (pure black)
        const borderBatches = new Map();
        for (const fc of roadFeatures) {
          const t = Math.min(1, Math.max(0, (fc.width - 1) / 5));
          const r = Math.round(Math.max(0, fc.color.r - 40) * (1 - t));
          const g = Math.round(Math.max(0, fc.color.g - 40) * (1 - t));
          const b = Math.round(Math.max(0, fc.color.b - 40) * (1 - t));
          const a = (0.6 + 0.4 * t) * (fc.color.a / 255);
          const outlineWidth = fc.width + 2;
          const key = `${r},${g},${b},${a.toFixed(2)}|${outlineWidth}`;
          if (!borderBatches.has(key))
            borderBatches.set(key, {
              style: `rgba(${r},${g},${b},${a})`,
              width: outlineWidth,
              flats: [],
            });
          borderBatches.get(key).flats.push(fc.flat);
        }
        for (const [key, batch] of borderBatches) {
          this.ctx.strokeStyle = batch.style;
          this.ctx.lineWidth = batch.width;
          this.ctx.lineCap = "round";
          this.ctx.lineJoin = "round";
          this.ctx.beginPath();
          for (const flat of batch.flats) {
            this.ctx.moveTo(flat[0], flat[1]);
            for (let i = 2; i < flat.length; i += 2) {
              this.ctx.lineTo(flat[i], flat[i + 1]);
            }
          }
          this.ctx.stroke();
        }

        // Pass 2: fill stroke
        const fillBatches = new Map();
        for (const fc of roadFeatures) {
          const key = `${fc.color.r},${fc.color.g},${fc.color.b},${fc.color.a}|${fc.width}`;
          if (!fillBatches.has(key))
            fillBatches.set(key, {
              color: fc.color,
              width: fc.width,
              flats: [],
            });
          fillBatches.get(key).flats.push(fc.flat);
        }
        for (const [key, batch] of fillBatches) {
          this.ctx.strokeStyle = this._getRGBA(
            batch.color.r,
            batch.color.g,
            batch.color.b,
            batch.color.a / 255,
          );
          this.ctx.lineWidth = batch.width;
          this.ctx.lineCap = "round";
          this.ctx.lineJoin = "round";
          this.ctx.beginPath();
          for (const flat of batch.flats) {
            this.ctx.moveTo(flat[0], flat[1]);
            for (let i = 2; i < flat.length; i += 2) {
              this.ctx.lineTo(flat[i], flat[i + 1]);
            }
          }
          this.ctx.stroke();
        }
      }

      // Construction roads: border + white base + red dashes
      if (constructionFlats.length > 0) {
        // Border pass (same blending as regular roads)
        for (const cf of constructionFlats) {
          const t = Math.min(1, Math.max(0, (cf.width - 1) / 5));
          const r = Math.round(Math.max(0, cf.color.r - 40) * (1 - t));
          const g = Math.round(Math.max(0, cf.color.g - 40) * (1 - t));
          const b = Math.round(Math.max(0, cf.color.b - 40) * (1 - t));
          const a = (0.6 + 0.4 * t) * (cf.color.a / 255);
          this.ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
          this.ctx.lineWidth = cf.width + 2;
          this.ctx.lineCap = "round";
          this.ctx.lineJoin = "round";
          this.ctx.beginPath();
          this.ctx.moveTo(cf.flat[0], cf.flat[1]);
          for (let i = 2; i < cf.flat.length; i += 2) {
            this.ctx.lineTo(cf.flat[i], cf.flat[i + 1]);
          }
          this.ctx.stroke();
        }

        const dashLen = Math.max(4, this.getZoomFactor() * 0.3);

        for (const cf of constructionFlats) {
          // White base
          this.ctx.strokeStyle = "rgba(255,255,255,1)";
          this.ctx.lineWidth = cf.width;
          this.ctx.lineCap = "butt";
          this.ctx.lineJoin = "round";
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.moveTo(cf.flat[0], cf.flat[1]);
          for (let i = 2; i < cf.flat.length; i += 2) {
            this.ctx.lineTo(cf.flat[i], cf.flat[i + 1]);
          }
          this.ctx.stroke();

          // Red dashes
          this.ctx.strokeStyle = "rgba(200,60,60,0.8)";
          this.ctx.lineWidth = cf.width;
          this.ctx.setLineDash([dashLen, dashLen]);
          this.ctx.beginPath();
          this.ctx.moveTo(cf.flat[0], cf.flat[1]);
          for (let i = 2; i < cf.flat.length; i += 2) {
            this.ctx.lineTo(cf.flat[i], cf.flat[i + 1]);
          }
          this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
      }
    }
  }

  renderLayer(layerFeatures, bounds, useFill) {
    // Batch features by style to minimize Canvas2D state changes.
    // Key = "r,g,b,a|width", value = array of coordinate arrays to draw.
    const lineBatches = new Map(); // key -> { coords: [...], features: [...] }
    const fillBatches = new Map(); // key -> { coords: [...], features: [...] }
    const railwayFeatures = []; // railways need special rendering

    // Pre-compute bounds scaling factors once
    const lonRange = bounds.maxLon - bounds.minLon;
    const latRange = bounds.maxLat - bounds.minLat;
    const scaleX = this.canvasWidth / lonRange;
    const scaleY = this.canvasHeight / latRange;
    const minLon = bounds.minLon;
    const minLat = bounds.minLat;
    const canvasHeight = this.canvasHeight;

    // Inline coordinate transform (avoids function call + object allocation per coord)
    const toScreenX = (lon) => (lon - minLon) * scaleX;
    const toScreenY = (lat) => canvasHeight - (lat - minLat) * scaleY;

    for (const item of layerFeatures) {
      const { feature, props, type, color, fill, width, isRailway } = item;
      const geom = feature.geometry;
      if (!geom || !geom.coordinates) continue;

      try {
        if (type === "Point") {
          const [lon, lat] = geom.coordinates;
          const sx = toScreenX(lon);
          const sy = toScreenY(lat);

          // Collect POIs for glyph rendering
          if (item.poiCategory) {
            this._poiRenderQueue.push({
              x: sx,
              y: sy,
              category: item.poiCategory,
            });
          } else {
            // Non-categorized points: batch as colored circles
            const colorStr = item._fillKey;
            if (!fillBatches.has(colorStr)) {
              fillBatches.set(colorStr, {
                points: [],
                polygons: [],
                features: [],
              });
            }
            fillBatches.get(colorStr).points.push(sx, sy);
          }
          if (this.hoverInfoEnabled || this.selectedFeature) {
            this.renderedFeatures.push({
              type: "Point",
              screenX: sx,
              screenY: sy,
              properties: props,
              feature: feature,
              geometry: geom,
            });
          }
        } else if (type === "LineString" || type === "MultiLineString") {
          const coordArrays =
            type === "LineString" ? [geom.coordinates] : geom.coordinates;

          if (isRailway) {
            for (const coords of coordArrays) {
              if (coords.length < 2) continue;
              const screenCoords = new Array(coords.length);
              for (let i = 0; i < coords.length; i++) {
                screenCoords[i] = {
                  x: toScreenX(coords[i][0]),
                  y: toScreenY(coords[i][1]),
                };
              }
              railwayFeatures.push({ screenCoords, color, width });
              if (this.hoverInfoEnabled || this.selectedFeature) {
                this.renderedFeatures.push({
                  type: "LineString",
                  screenCoords,
                  properties: props,
                  feature,
                  geometry: geom,
                });
              }
            }
          } else {
            const key = item._lineKey;
            if (!lineBatches.has(key)) {
              lineBatches.set(key, {
                color,
                width: width || 1,
                lines: [],
                features: [],
              });
            }
            const batch = lineBatches.get(key);

            for (const coords of coordArrays) {
              if (coords.length < 2) continue;
              // Store flat screen coordinates: [x0,y0, x1,y1, ...]
              const flat = new Array(coords.length * 2);
              const screenCoords =
                this.hoverInfoEnabled || this.selectedFeature
                  ? new Array(coords.length)
                  : null;
              for (let i = 0; i < coords.length; i++) {
                const sx = toScreenX(coords[i][0]);
                const sy = toScreenY(coords[i][1]);
                flat[i * 2] = sx;
                flat[i * 2 + 1] = sy;
                if (screenCoords) screenCoords[i] = { x: sx, y: sy };
              }
              batch.lines.push(flat);
              if (screenCoords) {
                this.renderedFeatures.push({
                  type: "LineString",
                  screenCoords,
                  properties: props,
                  feature,
                  geometry: geom,
                });
              }
            }
          }
        } else if (type === "Polygon" || type === "MultiPolygon") {
          const polygonArrays =
            type === "Polygon" ? [geom.coordinates] : geom.coordinates;
          const shouldFill = fill && useFill;

          for (const polygon of polygonArrays) {
            const ring = polygon[0];
            if (!ring || ring.length < 3) continue;

            const flat = new Array(ring.length * 2);
            const screenCoords =
              this.hoverInfoEnabled || this.selectedFeature
                ? new Array(ring.length)
                : null;
            for (let i = 0; i < ring.length; i++) {
              const sx = toScreenX(ring[i][0]);
              const sy = toScreenY(ring[i][1]);
              flat[i * 2] = sx;
              flat[i * 2 + 1] = sy;
              if (screenCoords) screenCoords[i] = { x: sx, y: sy };
            }

            if (shouldFill) {
              const colorStr = item._fillKey;
              if (!fillBatches.has(colorStr)) {
                fillBatches.set(colorStr, {
                  points: [],
                  polygons: [],
                  features: [],
                });
              }
              fillBatches.get(colorStr).polygons.push(flat);
            } else {
              // Outline only - batch as lines with width 1
              const key = item._lineKey;
              if (!lineBatches.has(key)) {
                lineBatches.set(key, {
                  color,
                  width: 1,
                  lines: [],
                  features: [],
                });
              }
              lineBatches.get(key).lines.push(flat);
            }

            if (screenCoords) {
              this.renderedFeatures.push({
                type: "Polygon",
                screenCoords,
                properties: props,
                feature,
                geometry: geom,
              });
            }
          }
        }
      } catch (error) {
        console.warn("Error rendering feature:", error);
      }
    }

    // Flush fill batches (polygons + points with same color in one path)
    for (const [colorStr, batch] of fillBatches) {
      this.ctx.fillStyle = colorStr;
      this.ctx.beginPath();

      // Filled polygons
      for (const flat of batch.polygons) {
        this.ctx.moveTo(flat[0], flat[1]);
        for (let i = 2; i < flat.length; i += 2) {
          this.ctx.lineTo(flat[i], flat[i + 1]);
        }
        this.ctx.closePath();
      }

      // Points
      for (let i = 0; i < batch.points.length; i += 2) {
        this.ctx.moveTo(batch.points[i] + 3, batch.points[i + 1]);
        this.ctx.arc(batch.points[i], batch.points[i + 1], 3, 0, Math.PI * 2);
      }

      this.ctx.fill();
    }

    // Flush line batches (one beginPath/stroke per color+width combo)
    for (const [key, batch] of lineBatches) {
      this.ctx.strokeStyle = `rgba(${batch.color.r},${batch.color.g},${batch.color.b},${batch.color.a / 255})`;
      this.ctx.lineWidth = batch.width;
      this.ctx.lineCap = "round";
      this.ctx.lineJoin = "round";
      this.ctx.beginPath();

      for (const flat of batch.lines) {
        this.ctx.moveTo(flat[0], flat[1]);
        for (let i = 2; i < flat.length; i += 2) {
          this.ctx.lineTo(flat[i], flat[i + 1]);
        }
      }

      this.ctx.stroke();
    }

    // Render railways individually (they need special pattern rendering)
    for (const rw of railwayFeatures) {
      if (this.viewWidthMeters <= 4000) {
        // <4km: show detailed railway pattern
        this.drawRailwayPattern(rw.screenCoords, rw.color, rw.width);
      } else {
        this.ctx.strokeStyle = `rgba(${rw.color.r},${rw.color.g},${rw.color.b},${rw.color.a / 255})`;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(rw.screenCoords[0].x, rw.screenCoords[0].y);
        for (let i = 1; i < rw.screenCoords.length; i++) {
          this.ctx.lineTo(rw.screenCoords[i].x, rw.screenCoords[i].y);
        }
        this.ctx.stroke();
      }
    }

    // Flush POI glyphs
    if (this._poiRenderQueue.length > 0) {
      const displaySize = 12;
      const halfSize = displaySize / 2;

      // Sort by category for GPU texture cache locality
      this._poiRenderQueue.sort((a, b) =>
        a.category < b.category ? -1 : a.category > b.category ? 1 : 0,
      );

      for (const poi of this._poiRenderQueue) {
        const glyph = this.glyphCache[poi.category];
        if (glyph) {
          this.ctx.drawImage(
            glyph.canvas,
            poi.x - halfSize,
            poi.y - halfSize,
            displaySize,
            displaySize,
          );
        }
      }
      this._poiRenderQueue.length = 0;
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
      // Only show detailed railway pattern when zoomed in
      // At lower zoom levels, show simple solid line
      if (this.viewWidthMeters <= 4000) {
        // <4km: show detailed railway pattern
        // Draw railway pattern: two parallel rails with ties (sleepers)
        this.drawRailwayPattern(screenCoords, color, width);
      } else {
        // Draw simple solid line for railways at low zoom
        this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
        this.ctx.lineWidth = 2; // Thinner at low zoom
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
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
    // Three-line railway pattern: two thin outline rails + dashed center line

    // Railway gauge calculations (hardcoded based on real measurements):
    // Standard gauge: 1.435m between rail centers
    // Narrow gauge (trams): ~1.0m between rail centers

    // Calculate rail separation based on view
    const metersPerPixel = this.viewWidthMeters / this.canvasWidth;
    const gaugeMeters = width === 6 ? 1.0 : 1.435; // Narrow gauge vs standard
    const railSeparationPx = Math.max(3, gaugeMeters / metersPerPixel);

    this.ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw two thin continuous outline rails (left and right)
    for (let railSide = -1; railSide <= 1; railSide += 2) {
      this.ctx.lineWidth = 1; // Thin rails
      this.ctx.setLineDash([]); // Solid lines
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
            perpX = (-dy / len) * (railSeparationPx / 2) * railSide;
            perpY = (dx / len) * (railSeparationPx / 2) * railSide;
          }
        } else if (i > 0) {
          const prev = screenCoords[i - 1];
          const dx = coord.x - prev.x;
          const dy = coord.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            perpX = (-dy / len) * (railSeparationPx / 2) * railSide;
            perpY = (dx / len) * (railSeparationPx / 2) * railSide;
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

    // Draw dashed center fill line between the rails (scales with zoom)
    const dashLength = Math.max(1, this.getZoomFactor() * 0.045); // Small dashes
    const gapLength = dashLength; // Exactly 50:50 pattern

    // Fill line width should touch the outer rails
    this.ctx.lineWidth = railSeparationPx; // Full width to touch both outer rails
    this.ctx.lineCap = "butt"; // Square caps for dashes
    this.ctx.setLineDash([dashLength, gapLength]);
    this.ctx.beginPath();

    for (let i = 0; i < screenCoords.length; i++) {
      if (i === 0) {
        this.ctx.moveTo(screenCoords[i].x, screenCoords[i].y);
      } else {
        this.ctx.lineTo(screenCoords[i].x, screenCoords[i].y);
      }
    }

    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset to solid
  }

  renderPolygonOutline(coordinates, color, bounds) {
    // Render polygon as outline only (not filled)
    return this.renderLineString(coordinates, color, bounds);
  }

  renderPolygon(coordinates, color, bounds) {
    if (coordinates.length < 3) return [];

    // Use Canvas2D native fill - hardware accelerated
    const screenCoords = [];

    this.ctx.fillStyle = this._getRGBA(
      color.r,
      color.g,
      color.b,
      color.a / 255,
    );
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
    this.ctx.fillStyle = "rgb(242, 239, 233)"; // Light tan/beige for land
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Cleared";
  }

  resetView() {
    this.viewWidthMeters = 10000; // Reset to initial 10km view
    this.offsetX = 0;
    this.offsetY = 0;
    this.updateZoomSlider();
    this.renderMap();
    this.updateStats();
  }

  toggleHoverInfo() {
    this.hoverInfoEnabled = !this.hoverInfoEnabled;
    this.updateHoverUI();
  }

  initPOIToggles() {
    const container = document.getElementById("poiToggles");
    if (!container) return;
    for (const [catId, catDef] of Object.entries(POI_CATEGORIES)) {
      const btn = document.createElement("button");
      btn.className = "button-toggle poi-toggle";
      btn.dataset.category = catId;
      btn.innerHTML = `<span class="poi-swatch" style="background:rgb(${catDef.color.r},${catDef.color.g},${catDef.color.b})"></span>${catDef.label}`;
      btn.addEventListener("click", () => this.togglePOICategory(catId));
      container.appendChild(btn);
    }
  }

  togglePOICategory(catId) {
    this.poiCategoryState[catId] = !this.poiCategoryState[catId];
    const btn = document.querySelector(`.poi-toggle[data-category="${catId}"]`);
    if (btn) {
      if (this.poiCategoryState[catId]) {
        btn.classList.remove("inactive");
      } else {
        btn.classList.add("inactive");
      }
    }
    this.renderMap();
  }

  updateHoverUI() {
    const btn = document.getElementById("toggleHoverBtn");
    const panel = document.getElementById("infoPanel");

    if (this.hoverInfoEnabled) {
      btn.textContent = "Hover Info: ON";
      btn.classList.remove("inactive");
      if (panel) panel.style.display = "";
    } else {
      btn.textContent = "Hover Info: OFF";
      btn.classList.add("inactive");
      if (panel) panel.style.display = "none";

      // Clear any current hover state
      if (this.hoveredFeature && !this.selectedFeature) {
        this.hoveredFeature = null;
        this.renderMap();
      }
    }
  }

  updateStats() {
    const viewStr =
      this.viewWidthMeters >= 1000
        ? `${(this.viewWidthMeters / 1000).toFixed(1)}km`
        : `${this.viewWidthMeters.toFixed(0)}m`;
    document.getElementById("zoomLevel").textContent = viewStr + " wide";
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

  document.getElementById("zoomSlider").addEventListener("input", (e) => {
    // Slider value is inverted log scale
    const logMin = Math.log2(renderer.minViewWidthMeters);
    const logMax = Math.log2(renderer.maxViewWidthMeters);
    const sliderValue = parseFloat(e.target.value);
    const logViewWidth = logMax + logMin - sliderValue;
    renderer.setViewWidth(Math.pow(2, logViewWidth));
  });

  document.getElementById("toggleHoverBtn").addEventListener("click", () => {
    renderer.toggleHoverInfo();
  });

  // Set initial UI state
  renderer.updateHoverUI();

  // Auto-render on load
  renderer.renderMap();
  renderer.updateStats();
}

// Start the app when page loads
window.addEventListener("DOMContentLoaded", initApp);
