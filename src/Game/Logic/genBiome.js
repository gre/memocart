//@flow
import memoize from "lodash/memoize";
import seedrandom from "seedrandom";
import * as Constants from "../Constants";
import { DEV } from "../Constants";
import genBiomeType from "./genBiomeType";
import type { Biome } from "./types";
import {
  default as genLevelStepBiomeIndex,
  reverseBiomeIndex
} from "./genLevelStepBiomeIndex";

const firstLevelSize = genLevelStepBiomeIndex(1);

const { B_INTERS, B_FINISH } = Constants;

function genBiome(biomeIndex: number, seed: string): Biome {
  const biomeRandom = seedrandom("biome_" + biomeIndex + "_" + seed);
  const isSafe = reverseBiomeIndex(biomeIndex).isLevelStart;
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
    } else if (biomeIndex > firstLevelSize && !isSafe) {
      const intersectionMinReference = Math.floor(
        biomeIndex / intersectionRoulette
      );
      const intersectionMinReferenceRandom = seedrandom(
        "biome_min_" + seed + "_" + intersectionMinReference
      );
      const winner = Math.floor(
        intersectionMinReferenceRandom() * (intersectionRoulette - 1) // we need one safe track to avoid 2 following intersection
      );
      if (biomeIndex % intersectionRoulette === winner) {
        type = B_INTERS;
      }
    }
  }

  return { biomeIndex, biomeSeed, type, isSafe };
}

function genBiomeNeighborPass(biomeIndex: number, seed: string): Biome {
  let biome = genBiome(biomeIndex, seed);
  if (biomeIndex <= 1) return biome;
  const biomeRandom = seedrandom("biome_neighbor_" + biomeIndex + "_" + seed);
  const prev = genBiome(biomeIndex + 1, seed);
  const next = genBiome(biomeIndex - 1, seed);
  if (
    prev.type === Constants.B_INTERS &&
    biome.type !== Constants.B_INTERS &&
    next.type === Constants.B_INTERS &&
    !biome.isSafe &&
    biomeRandom() < 0.8 // very likely but not always
  ) {
    // void junctions between 2 intersections
    biome = { ...biome, type: Constants.B_VOID };
  }
  return biome;
}

let f = DEV
  ? genBiomeNeighborPass
  : memoize(
      genBiomeNeighborPass,
      (biomeIndex: number, seed: string) => biomeIndex + "_" + seed
    );

export default f;
