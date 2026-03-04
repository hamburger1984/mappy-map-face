{
  description = "OSM tile renderer — NixOS module for self-hosted map serving";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: {
    # Primary entry point: add to your flake.nix inputs and then
    #   imports = [ inputs.osm-renderer.nixosModules.default ];
    nixosModules.default    = import ./nix/module.nix self;
    nixosModules.osm-renderer = import ./nix/module.nix self;
  };
}
