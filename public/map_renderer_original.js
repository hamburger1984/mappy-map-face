// Hamburg Map Renderer - WebAssembly Integration

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

      console.log("WASM module loaded successfully");
      console.log("Buffer pointer:", this.bufferPtr);
      console.log("Buffer size:", this.wasm.getBufferSize());
      console.log("Coord buffer pointer:", this.coordBufferPtr);
      return true;
    } catch (error) {
      console.error("Failed to initialize WASM:", error);
      return false;
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
    if (!this.mapData || !this.mapData.features.length) {
      return { minLon: 9.95, maxLon: 10.05, minLat: 53.53, maxLat: 53.58 };
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

  renderMap() {
    const startTime = performance.now();

    if (!this.wasm || !this.mapData) {
      console.error("WASM or map data not loaded");
      return;
    }

    // Calculate and set map bounds
    const bounds = this.calculateBounds();
    this.wasm.setMapBounds(
      bounds.minLon,
      bounds.maxLon,
      bounds.minLat,
      bounds.maxLat,
    );

    // Clear canvas
    this.wasm.clearCanvas(240, 248, 255); // Light blue background

    let featureCount = 0;

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
          featureCount++;
        } else if (type === "LineString") {
          this.renderLineString(feature.geometry.coordinates, color);
          featureCount++;
        } else if (type === "Polygon") {
          this.renderPolygon(feature.geometry.coordinates[0], color);
          featureCount++;
        } else if (type === "MultiLineString") {
          feature.geometry.coordinates.forEach((line) => {
            this.renderLineString(line, color);
          });
          featureCount++;
        } else if (type === "MultiPolygon") {
          feature.geometry.coordinates.forEach((polygon) => {
            this.renderPolygon(polygon[0], color);
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

  renderLineString(coordinates, color) {
    if (coordinates.length < 2) return;
    if (coordinates.length * 2 > this.coordBufferSize) return; // Too many coords

    // Write coordinates directly to WASM coord buffer
    const memory = new Float64Array(this.memory.buffer);
    for (let i = 0; i < coordinates.length; i++) {
      memory[this.coordBufferPtr / 8 + i * 2] = coordinates[i][0]; // lon
      memory[this.coordBufferPtr / 8 + i * 2 + 1] = coordinates[i][1]; // lat
    }

    this.wasm.drawWay(
      this.coordBufferPtr,
      coordinates.length * 2,
      color.r,
      color.g,
      color.b,
      color.a,
    );
  }

  renderPolygon(coordinates, color) {
    if (coordinates.length < 3) return;
    if (coordinates.length * 2 > this.coordBufferSize) return; // Too many coords

    // Write coordinates directly to WASM coord buffer
    const memory = new Float64Array(this.memory.buffer);
    for (let i = 0; i < coordinates.length; i++) {
      memory[this.coordBufferPtr / 8 + i * 2] = coordinates[i][0]; // lon
      memory[this.coordBufferPtr / 8 + i * 2 + 1] = coordinates[i][1]; // lat
    }

    this.wasm.fillPolygon(
      this.coordBufferPtr,
      coordinates.length * 2,
      color.r,
      color.g,
      color.b,
      color.a,
    );
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

  document.getElementById("exportBtn").addEventListener("click", () => {
    renderer.exportAsPNG();
  });

  // Auto-render on load
  renderer.renderMap();
}

// Start the app when page loads
window.addEventListener("DOMContentLoaded", initApp);
