//@flow
import mix from "./mix";
import type { TrackBiome } from "./types";

export default (
  biome1: TrackBiome,
  biome2: TrackBiome,
  biomeMix: number,
  uniqueBiome: ?TrackBiome
) => (f: (b: TrackBiome, uniqueBiome: ?TrackBiome) => number) =>
  mix(
    f(biome1, uniqueBiome && uniqueBiome === biome1 ? uniqueBiome : null),
    f(biome2, uniqueBiome && uniqueBiome === biome2 ? uniqueBiome : null),
    biomeMix
  );
