//@flow
import seedrandom from "seedrandom";
import smoothstep from "smoothstep";
import mix from "./mix";
import { B_EMPTY, B_DARK, B_INTERS, B_FINISH } from "../Constants";
import type { Biome, TrackBiome, Track } from "./types";
const BIOME_FREQ = 20;
const BIOME_WINDOW_TRANSITION = 8;
const BIOME_PAD = Math.floor((BIOME_FREQ - BIOME_WINDOW_TRANSITION) / 2);
const BIOME_DUR = 2 * BIOME_PAD + 1;
const BIOME_SAFE_EACH = 10;
export const LEVEL_SAFE_MULT = BIOME_SAFE_EACH * BIOME_FREQ;

export function formatTrackIndex(trackIndex: number): string {
  const level = Math.max(0, Math.floor((trackIndex + 10) / LEVEL_SAFE_MULT));
  const biome = Math.max(
    0,
    Math.floor((trackIndex - LEVEL_SAFE_MULT * level) / BIOME_FREQ)
  );
  return "AREA  " + level + "-" + biome;
}

function genBiome(biomeIndex: number, seed: number): Biome {
  const biomeRandom = seedrandom("biome_" + biomeIndex + "_" + seed);
  let type = B_EMPTY;
  let biomeSeed = biomeRandom();
  if (biomeIndex <= 0) {
    type = B_FINISH;
  } else {
    const r = biomeRandom();
    if (r < 0.5) type = B_DARK;

    // FIXME maybe can vary that based on levels (aka the index value)?
    const intersectionRoulette = 5;
    if (biomeIndex === 2) {
      type = B_INTERS;
      biomeSeed = 0.5 + 0.5 * biomeSeed; // this ensure the last turn is always a left turn for the tutorial.
    } else if (biomeIndex > 6 && biomeIndex % BIOME_SAFE_EACH > 1) {
      const intersectionMinReference = Math.floor(
        biomeIndex / intersectionRoulette
      );
      const intersectionMinReferenceRandom = seedrandom(
        "biome_min_" + intersectionMinReference
      );
      const winner = Math.floor(
        intersectionMinReferenceRandom() * intersectionRoulette
      );
      if (biomeIndex % intersectionRoulette === winner) {
        type = B_INTERS;
      }
    }
  }

  return { biomeSeed, type };
}

const makeBiomesMixer = (
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

const makeTrackBiome = (
  biome: Biome,
  index: number,
  duration: number
): TrackBiome => ({
  ...biome,
  index,
  duration
});

export default function genTrack(trackIndex: number, seed: number): Track {
  const globalRandom = seedrandom("track_" + seed);
  const trackRandom = seedrandom("track_" + trackIndex + "_" + seed);
  const trackSeed = trackRandom();
  const biomeIndex = Math.ceil(trackIndex / BIOME_FREQ);
  const biomePrevTrackIndex = biomeIndex * BIOME_FREQ;
  //const biomeNextTrackIndex = (biomeIndex - 1) * BIOME_FREQ;
  const biomeTrackIndexDelta = biomePrevTrackIndex - trackIndex;
  const biome1 = makeTrackBiome(
    genBiome(biomeIndex, seed),
    BIOME_PAD + biomeTrackIndexDelta,
    BIOME_DUR
  );
  const biome2 = makeTrackBiome(
    genBiome(biomeIndex - 1, seed),
    biomeTrackIndexDelta - (BIOME_FREQ - BIOME_PAD),
    BIOME_DUR
  );
  const biomeMix = smoothstep(
    BIOME_PAD,
    BIOME_FREQ - BIOME_PAD,
    biomeTrackIndexDelta
  );
  let intersectionBiome: ?TrackBiome =
    biome1.type === B_INTERS
      ? biome1
      : biome2.type === B_INTERS ? biome2 : null;
  let uniqueBiome: ?TrackBiome =
    biomeMix === 0 ? biome1 : biomeMix === 1 ? biome2 : null;

  const mixBiomes = makeBiomesMixer(biome1, biome2, biomeMix, uniqueBiome);

  let turn = // ] -0.5, 0.5 [
    0.3 *
      (Math.cos(8 * globalRandom() + trackIndex * 0.2) +
        Math.sin(20 * globalRandom() + trackIndex * 0.33)) +
    +0.2 * Math.cos(7 * globalRandom() + 0.09 * trackIndex);
  let descent =
    0.09 +
    0.4 * (1 - Math.exp(Math.min(0, -trackIndex / 500))) +
    +0.5 * (0.5 + 0.5 * Math.cos(8 * globalRandom() + trackIndex * 0.5));

  turn = mixBiomes((b, unique) => {
    if (b.type === B_FINISH) {
      return 0;
    }
    if (b.type === B_INTERS) {
      const turnSmoothing = 3;
      const startDiverging = Math.floor(
        b.biomeSeed * 987 % Math.ceil((BIOME_DUR - turnSmoothing) / 2)
      );
      const turnSpeed =
        0.7 +
        0.2 *
          Math.cos(
            7 * b.biomeSeed +
              0.6 * trackIndex +
              0.3 * Math.sin(9 + trackSeed + 1.2 * trackIndex)
          );
      return mix(
        0,
        (b.biomeSeed > 0.5 ? -1 : 1) * turnSpeed,
        // FIXME kinda a hack to not start before TRACK_SIZE, to avoid a blink and you could actually see the alt track pops in
        smoothstep(startDiverging, startDiverging + turnSmoothing, b.index) *
          smoothstep(BIOME_DUR, BIOME_DUR - turnSmoothing, b.index)
      );
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
    uniqueBiome,
    intersectionBiome
  };
}
