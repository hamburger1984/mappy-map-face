const std = @import("std");

// Canvas dimensions (max size)
const MAX_WIDTH: u32 = 1200;
const MAX_HEIGHT: u32 = 800;
const MAX_BUFFER_SIZE: usize = MAX_WIDTH * MAX_HEIGHT * 4;

// Static buffer in WASM linear memory
var pixel_buffer: [MAX_BUFFER_SIZE]u8 align(16) = undefined;
var buffer_initialized: bool = false;

// Current canvas dimensions
var canvas_width: u32 = 800;
var canvas_height: u32 = 600;

// Map bounds (Hamburg city center area - updated by JavaScript)
// Default: ~10km radius from Hamburg center (53.55°N, 9.99°E)
var min_lon: f64 = 9.85;
var max_lon: f64 = 10.13;
var min_lat: f64 = 53.46;
var max_lat: f64 = 53.64;

// Temporary coordinate buffer (after the pixel buffer in memory)
const MAX_COORDS: usize = 10000;
var coord_buffer: [MAX_COORDS]f64 align(8) = undefined;

// Point structure
const Point = struct {
    x: f64,
    y: f64,
};

// Coordinate conversion from lat/lon to pixel coordinates
fn latLonToPixel(lat: f64, lon: f64) Point {
    const x = (lon - min_lon) / (max_lon - min_lon) * @as(f64, @floatFromInt(canvas_width));
    const y = @as(f64, @floatFromInt(canvas_height)) - ((lat - min_lat) / (max_lat - min_lat) * @as(f64, @floatFromInt(canvas_height)));
    return Point{ .x = x, .y = y };
}

// Draw a pixel at specific coordinates
fn setPixel(x: i32, y: i32, r: u8, g: u8, b: u8, a: u8) void {
    if (x < 0 or y < 0 or x >= canvas_width or y >= canvas_height) return;

    const idx = (@as(usize, @intCast(y)) * canvas_width + @as(usize, @intCast(x))) * 4;
    const buffer_size = canvas_width * canvas_height * 4;
    if (idx + 3 < buffer_size) {
        pixel_buffer[idx] = r;
        pixel_buffer[idx + 1] = g;
        pixel_buffer[idx + 2] = b;
        pixel_buffer[idx + 3] = a;
    }
}

// Bresenham's line algorithm
fn drawLine(x0: i32, y0: i32, x1: i32, y1: i32, r: u8, g: u8, b: u8, a: u8) void {
    var x = x0;
    var y = y0;

    const dx: i32 = @intCast(@abs(x1 - x0));
    const dy: i32 = @intCast(@abs(y1 - y0));

    const sx: i32 = if (x0 < x1) 1 else -1;
    const sy: i32 = if (y0 < y1) 1 else -1;

    var err: i32 = dx - dy;

    while (true) {
        setPixel(x, y, r, g, b, a);

        if (x == x1 and y == y1) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
}

// Exported functions for JavaScript

export fn initCanvas(width: u32, height: u32) bool {
    if (width > MAX_WIDTH or height > MAX_HEIGHT) return false;

    canvas_width = width;
    canvas_height = height;

    // Clear to white
    const buffer_size = width * height * 4;
    var i: usize = 0;
    while (i < buffer_size) : (i += 4) {
        pixel_buffer[i] = 255;
        pixel_buffer[i + 1] = 255;
        pixel_buffer[i + 2] = 255;
        pixel_buffer[i + 3] = 255;
    }

    buffer_initialized = true;
    return true;
}

export fn getBufferPtr() [*]u8 {
    return &pixel_buffer;
}

export fn getBufferSize() usize {
    return canvas_width * canvas_height * 4;
}

export fn getCoordBufferPtr() [*]f64 {
    return &coord_buffer;
}

export fn getCoordBufferSize() usize {
    return MAX_COORDS;
}

export fn clearCanvas(r: u8, g: u8, b: u8) void {
    if (!buffer_initialized) return;

    const buffer_size = canvas_width * canvas_height * 4;
    var i: usize = 0;
    while (i < buffer_size) : (i += 4) {
        pixel_buffer[i] = r;
        pixel_buffer[i + 1] = g;
        pixel_buffer[i + 2] = b;
        pixel_buffer[i + 3] = 255;
    }
}

export fn setMapBounds(min_longitude: f64, max_longitude: f64, min_latitude: f64, max_latitude: f64) void {
    min_lon = min_longitude;
    max_lon = max_longitude;
    min_lat = min_latitude;
    max_lat = max_latitude;
}

export fn drawWay(coords_ptr: [*]const f64, coords_len: usize, r: u8, g: u8, b: u8, a: u8) void {
    if (!buffer_initialized or coords_len < 4) return;

    // coords are [lon0, lat0, lon1, lat1, ...]
    var i: usize = 0;
    while (i + 3 < coords_len) : (i += 2) {
        const lon0 = coords_ptr[i];
        const lat0 = coords_ptr[i + 1];
        const lon1 = coords_ptr[i + 2];
        const lat1 = coords_ptr[i + 3];

        const p0 = latLonToPixel(lat0, lon0);
        const p1 = latLonToPixel(lat1, lon1);

        drawLine(@intFromFloat(p0.x), @intFromFloat(p0.y), @intFromFloat(p1.x), @intFromFloat(p1.y), r, g, b, a);
    }
}

export fn drawPoint(lon: f64, lat: f64, radius: u32, r: u8, g: u8, b: u8, a: u8) void {
    if (!buffer_initialized) return;

    const p = latLonToPixel(lat, lon);
    const cx: i32 = @intFromFloat(p.x);
    const cy: i32 = @intFromFloat(p.y);

    // Draw a filled circle
    const rad: i32 = @intCast(radius);
    var y: i32 = -rad;
    while (y <= rad) : (y += 1) {
        var x: i32 = -rad;
        while (x <= rad) : (x += 1) {
            if (x * x + y * y <= rad * rad) {
                setPixel(cx + x, cy + y, r, g, b, a);
            }
        }
    }
}

export fn fillPolygon(coords_ptr: [*]const f64, coords_len: usize, r: u8, g: u8, b: u8, a: u8) void {
    if (!buffer_initialized or coords_len < 6) return;

    // Simple polygon fill using scanline algorithm
    // First, draw the outline
    var i: usize = 0;
    while (i + 3 < coords_len) : (i += 2) {
        const lon0 = coords_ptr[i];
        const lat0 = coords_ptr[i + 1];
        const lon1 = coords_ptr[i + 2];
        const lat1 = coords_ptr[i + 3];

        const p0 = latLonToPixel(lat0, lon0);
        const p1 = latLonToPixel(lat1, lon1);

        drawLine(@intFromFloat(p0.x), @intFromFloat(p0.y), @intFromFloat(p1.x), @intFromFloat(p1.y), r, g, b, a);
    }

    // Close the polygon
    if (coords_len >= 4) {
        const lon0 = coords_ptr[coords_len - 2];
        const lat0 = coords_ptr[coords_len - 1];
        const lon1 = coords_ptr[0];
        const lat1 = coords_ptr[1];

        const p0 = latLonToPixel(lat0, lon0);
        const p1 = latLonToPixel(lat1, lon1);

        drawLine(@intFromFloat(p0.x), @intFromFloat(p0.y), @intFromFloat(p1.x), @intFromFloat(p1.y), r, g, b, a);
    }
}
