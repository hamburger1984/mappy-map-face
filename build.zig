const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });

    const optimize = b.standardOptimizeOption(.{});

    const wasm = b.addExecutable(.{
        .name = "map_renderer",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/map_renderer.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    wasm.entry = .disabled;
    wasm.rdynamic = true;

    b.installArtifact(wasm);

    // Copy WASM to public directory
    const copy_wasm = b.addInstallFile(
        wasm.getEmittedBin(),
        "../public/map_renderer.wasm",
    );
    b.getInstallStep().dependOn(&copy_wasm.step);

    // Add a step to fetch OSM data
    const fetch_data = b.step("data", "Download and process OSM data");
    const fetch_cmd = b.addSystemCommand(&.{"./fetch-data.sh"});
    fetch_data.dependOn(&fetch_cmd.step);
}
