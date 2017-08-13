//@flow
import memoize from "lodash/memoize";
import seedrandom from "seedrandom";
import * as Constants from "../Constants";
import genBiomeType from "./genBiomeType";
import type { Biome } from "./types";

export const BIOME_SAFE_EACH = 6;
const { B_INTERS, B_FINISH } = Constants;

function genBiome(biomeIndex: number, seed: number): Biome {
  const biomeRandom = seedrandom("biome_" + biomeIndex + "_" + seed);
  const isSafe = biomeIndex % BIOME_SAFE_EACH <= 0;
  let type;
  let biomeSeed = biomeRandom();
  if (biomeIndex <= 0) {
    type = B_FINISH;
  } else {
    type = genBiomeType(biomeIndex, biomeRandom());

    // FIXME maybe can vary that based on levels (aka the index value)?
    const intersectionRoulette = 3;
    if (biomeIndex === 2) {
      type = B_INTERS;
      biomeSeed = 0.5 + 0.5 * biomeSeed; // this ensure the last turn is always a left turn for the tutorial.
    } else if (biomeIndex > 6 && !isSafe) {
      const intersectionMinReference = Math.floor(
        biomeIndex / intersectionRoulette
      );
      const intersectionMinReferenceRandom = seedrandom(
        "biome_min_" + intersectionMinReference
      );
      const winner = Math.floor(
        intersectionMinReferenceRandom() * (intersectionRoulette - 1) // we need one safe track to avoid 2 following intersection
      );
      if (biomeIndex % intersectionRoulette === winner) {
        type = B_INTERS;
      }
    }
  }

  return { biomeSeed, type, isSafe };
}

export default memoize(
  genBiome,
  (biomeIndex: number, seed: number) => biomeIndex + "_" + seed
);
