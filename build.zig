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
}
