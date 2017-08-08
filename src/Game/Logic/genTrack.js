//@flow
import seedrandom from "seedrandom";
import smoothstep from "smoothstep";
import mix from "./mix";
import { TRACK_SIZE, B_EMPTY, B_DARK, B_INTERS, B_FINISH } from "../Constants";
import type { Biome, UniqueBiome, Track } from "./types";
const BIOME_FREQ = 20;
const BIOME_WINDOW_TRANSITION = 8;
const BIOME_PAD = Math.floor((BIOME_FREQ - BIOME_WINDOW_TRANSITION) / 2);
const BIOME_DUR = 2 * BIOME_PAD + 1;
const BIOME_SAFE_EACH = 10;
export const LEVEL_SAFE_MULT = BIOME_SAFE_EACH * BIOME_FREQ;

function genBiome(biomeIndex: number, seed: number): Biome {
  const biomeRandom = seedrandom("biome_" + biomeIndex + "_" + seed);
  let type = B_EMPTY;
  const biomeSeed = biomeRandom();
  if (biomeIndex <= 0) {
    type = B_FINISH;
  } else {
    const r = biomeRandom();
    if (r < 0.5) type = B_DARK;

    // FIXME maybe can vary that based on levels (aka the index value)?
    const intersectionRoulette = 5;
    if (biomeIndex === 2) {
      type = B_INTERS;
    } else if (biomeIndex > 6 && biomeIndex % BIOME_SAFE_EACH > 1) {
      const intersectionMinReference = Math.floor(
        biomeIndex / intersectionRoulette
      );
      const winner = Math.floor(biomeRandom() * intersectionRoulette);
      if (biomeIndex % intersectionRoulette === winner) {
        type = B_INTERS;
      }
    }
  }
  return { biomeSeed, type };
}

const makeBiomesMixer = (
  biome1: Biome,
  biome2: Biome,
  biomeMix: number,
  uniqueBiome: ?UniqueBiome
) => (f: (b: Biome, uniqueBiome: ?UniqueBiome) => number) =>
  mix(
    f(biome1, uniqueBiome && uniqueBiome.biome === biome1 ? uniqueBiome : null),
    f(biome2, uniqueBiome && uniqueBiome.biome === biome2 ? uniqueBiome : null),
    biomeMix
  );

export default function genTrack(trackIndex: number, seed: number): Track {
  const globalRandom = seedrandom("track_" + seed);
  const trackRandom = seedrandom("track_" + trackIndex + "_" + seed);
  const trackSeed = trackRandom();
  const biomeIndex = Math.ceil(trackIndex / BIOME_FREQ);
  const biomePrevTrackIndex = biomeIndex * BIOME_FREQ;
  //const biomeNextTrackIndex = (biomeIndex - 1) * BIOME_FREQ;
  const biomeTrackIndexDelta = biomePrevTrackIndex - trackIndex;
  const biome1 = genBiome(biomeIndex, seed);
  const biome2 = genBiome(biomeIndex - 1, seed);
  const biomeMix = smoothstep(
    BIOME_PAD,
    BIOME_FREQ - BIOME_PAD,
    biomeTrackIndexDelta
  );
  let uniqueBiome: ?UniqueBiome = null;
  if (biomeMix === 0) {
    uniqueBiome = {
      biome: biome1,
      index: BIOME_PAD + biomeTrackIndexDelta,
      duration: BIOME_DUR
    };
  } else if (biomeMix === 1) {
    uniqueBiome = {
      biome: biome2,
      index: biomeTrackIndexDelta - (BIOME_FREQ - BIOME_PAD),
      duration: BIOME_DUR
    };
  }
  const mixBiomes = makeBiomesMixer(biome1, biome2, biomeMix, uniqueBiome);

  let turn = // ] -0.5, 0.5 [
    0.4999 *
    (Math.cos(8 * globalRandom() + trackIndex * 0.2) +
      Math.sin(20 * globalRandom() + trackIndex * 0.33));
  let descent = 0.49999 + 0.5 * Math.cos(8 * globalRandom() + trackIndex * 0.5);

  if (uniqueBiome && uniqueBiome.biome.type === B_INTERS) {
    // specific turn for the whole session
  }

  turn = mixBiomes((b, unique) => {
    if (b.type === B_FINISH) {
      return 0;
    }
    if (b.type === B_INTERS) {
      if (unique) {
        return mix(
          0,
          b.biomeSeed > 0.5 ? -0.8 : 0.8,
          // FIXME kinda a hack to not start before TRACK_SIZE, to avoid a blink and you could actually see the alt track pops in
          smoothstep(4, 6, unique.index) *
            smoothstep(BIOME_DUR, BIOME_DUR - 4, unique.index)
        );
      }
      return 0;
    }
    return turn; // keep old value
  });

  descent = mixBiomes(b => {
    if (b.type === B_FINISH) {
      return 0.1;
    }
    return descent; // keep old value
  });

  return {
    turn,
    descent,
    biome1,
    biome2,
    biomeMix,
    trackSeed,
    trackIndex,
    uniqueBiome
  };
}
