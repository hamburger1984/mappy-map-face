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

      this.renderMap();
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
        this.renderMap();
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

  async loadMapData() {
    try {
      const response = await fetch("hamburg.geojson");
      this.mapData = await response.json();
      console.log(
        `Loaded ${this.mapData.features.length} features from GeoJSON`,
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
    this.renderedFeatures = [];

    // Render features by type
    for (const feature of this.mapData.features) {
      if (!feature.geometry || !feature.geometry.coordinates) continue;

      const props = feature.properties || {};
      const type = feature.geometry.type;

      // Determine color based on feature type
      let color = { r: 100, g: 100, b: 100, a: 255 }; // Default gray

      if (props.highway) {
        if (["motorway", "trunk"].includes(props.highway)) {
          color = { r: 233, g: 115, b: 103, a: 255 }; // Orange-red
        } else if (["primary", "secondary"].includes(props.highway)) {
          color = { r: 252, g: 214, b: 164, a: 255 }; // Light orange
        } else {
          color = { r: 255, g: 255, b: 255, a: 255 }; // White
        }
      } else if (props.building) {
        color = { r: 218, g: 208, b: 200, a: 255 }; // Beige
      } else if (props.natural === "water" || props.water || props.waterway) {
        color = { r: 170, g: 211, b: 223, a: 255 }; // Blue
      } else if (props.landuse === "forest" || props.natural === "wood") {
        color = { r: 173, g: 209, b: 158, a: 255 }; // Green
      } else if (props.railway) {
        color = { r: 153, g: 153, b: 153, a: 255 }; // Dark gray
      }

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
          featureCount++;
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
          featureCount++;
        } else if (type === "Polygon") {
          const screenCoords = this.renderPolygon(
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
          featureCount++;
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
          featureCount++;
        } else if (type === "MultiPolygon") {
          feature.geometry.coordinates.forEach((polygon) => {
            const screenCoords = this.renderPolygon(polygon[0], color, bounds);
            this.renderedFeatures.push({
              type: "Polygon",
              screenCoords: screenCoords,
              properties: props,
              geometry: feature.geometry,
            });
          });
          featureCount++;
        }
      } catch (error) {
        console.warn("Error rendering feature:", error);
      }
    }

    // Copy WASM buffer to canvas
    this.updateCanvas();

    const endTime = performance.now();
    const renderTime = (endTime - startTime).toFixed(2);

    document.getElementById("featureCount").textContent = featureCount;
    document.getElementById("renderTime").textContent = renderTime;
    document.getElementById("stats").querySelector("div").textContent =
      "Status: Rendered";

    console.log(`Rendered ${featureCount} features in ${renderTime}ms`);
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
