const std = @import("std");
const json = std.json;

// Simple test to understand Zig 0.15.2 JSON API
pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    // Try to parse from file reader
    const file = try std.fs.cwd().openFile("data/hamburg-region.geojson", .{});
    defer file.close();

    var read_buf: [8192]u8 = undefined;
    const reader = file.reader(&read_buf);
    
    var scanner = json.Scanner.initStreaming(allocator);
    defer scanner.deinit();
    
    std.debug.print("Scanner created\n", .{});
    
    // Try to feed some data
    var buf: [4096]u8 = undefined;
    const n = try reader.read(&buf);
    std.debug.print("Read {d} bytes\n", .{n});
    std.debug.print("First 100 chars: {s}\n", .{buf[0..@min(100, n)]});
}
