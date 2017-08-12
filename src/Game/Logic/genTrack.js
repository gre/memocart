//@flow
import seedrandom from "seedrandom";
import smoothstep from "smoothstep";
import memoize from "lodash/memoize";
import mix from "./mix";
import * as Constants from "../Constants";
import type { Biome, TrackBiome, Track } from "./types";
const BIOME_FREQ = 20;
const BIOME_WINDOW_TRANSITION = 8;
const BIOME_PAD = Math.floor((BIOME_FREQ - BIOME_WINDOW_TRANSITION) / 2);
const BIOME_DUR = 2 * BIOME_PAD + 1;
const BIOME_SAFE_EACH = 10;
export const LEVEL_SAFE_MULT = BIOME_SAFE_EACH * BIOME_FREQ;
const { B_INTERS, B_FINISH, B_FIRE, B_DANG } = Constants;

export function formatTrackIndex(trackIndex: number): string {
  const level = Math.max(0, Math.floor((trackIndex + 10) / LEVEL_SAFE_MULT));
  const biome = Math.max(
    0,
    Math.floor((trackIndex - LEVEL_SAFE_MULT * level) / BIOME_FREQ)
  );
  return "AREA  " + level + "-" + biome;
}

const biomeFrequency = {
  B_SAPPHIRE: 1,
  B_FIRE: 1,
  B_GOLD: 3,
  B_DARK: 5,
  B_WIRED: 5,
  B_DANG: 8,
  B_EMPTY: 10
};
const biomeFrequencyKeys = Object.keys(biomeFrequency);
const biomeFrequencySum = biomeFrequencyKeys.reduce(
  (sum, k) => sum + biomeFrequency[k],
  0
);
const biomeFrequencyProbability = biomeFrequencyKeys.map(
  k => biomeFrequency[k] / biomeFrequencySum
);
function getBiome(r) {
  let i = 0;
  while (
    (r -= biomeFrequencyProbability[i]) > 0 &&
    ++i < biomeFrequencyKeys.length
  );
  return Constants[biomeFrequencyKeys[i]];
}

function genBiome(biomeIndex: number, seed: number): Biome {
  const biomeRandom = seedrandom("biome_" + biomeIndex + "_" + seed);
  let type;
  let biomeSeed = biomeRandom();
  if (biomeIndex <= 0) {
    type = B_FINISH;
  } else {
    type = getBiome(biomeRandom());

    // FIXME maybe can vary that based on levels (aka the index value)?
    const intersectionRoulette = 3;
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
        intersectionMinReferenceRandom() * (intersectionRoulette - 1) // we need one safe track to avoid 2 following intersection
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

function genTrack(trackIndex: number, seed: number): Track {
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

  const slowTurnFactor = mixBiomes(b => {
    return b.biomeSeed < 0.2 ? 0.1 : 1;
  });
  const slowSlopeFactor = mixBiomes(b => {
    return 0.01 + Math.pow(b.biomeSeed * 9 % 1.5, 3);
  });

  const normalTurnFactor = mixBiomes(b => {
    return Math.pow(b.biomeSeed * 80 % 1, 2);
  });
  const normalSlopeFactor = mixBiomes(b => {
    return Math.pow(b.biomeSeed * 4 % 1, 2);
  });

  const crazyTurnFactor = mixBiomes(b => {
    return (b === B_DANG ? 0.5 : 0.1) * (b.biomeSeed * 66 % 1);
  });
  const crazySlopeFactor = mixBiomes(b => {
    return (b === B_DANG ? 1 : 0.01) * (b.biomeSeed * 3 % 1);
  });

  const slowTurn = Math.cos(7 * globalRandom() + 0.12 * trackIndex);
  const slowSlope = Math.cos(999 * globalRandom() + 0.2 * trackIndex);
  const normalTurn = Math.cos(9 * globalRandom() + 0.3 * trackIndex);
  const normalSlope = Math.sin(99 * globalRandom() + 0.35 * (trackIndex - 444));
  const crazyTurn = mix(
    Math.sin(10 * globalRandom() + 0.7 * trackIndex),
    Math.cos(20 * globalRandom() + 2 * trackIndex),
    0.3 - 0.4 * trackRandom()
  );
  const crazySlope = mix(
    mix(
      5 * (trackRandom() - 0.5),
      Math.cos(20 * globalRandom() + 3 * trackIndex),
      trackRandom()
    ),
    Math.sin(30 * globalRandom() + 0.8 * trackIndex),
    0.3
  );

  let turnFactorsSum = crazyTurnFactor + normalTurnFactor + slowTurnFactor;
  if (turnFactorsSum === 0)
    console.warn("flaw in map gen.. turnFactorsSum=0", trackIndex, seed);

  const slopeFactorSum = slowSlopeFactor + crazySlopeFactor + normalSlopeFactor;
  if (slopeFactorSum === 0) {
    console.warn("flaw in map gen.. slopeFactorSum=0", trackIndex, seed);
  }

  let turn = // ] -0.5, 0.5 [
    (crazyTurnFactor * crazyTurn +
      normalTurnFactor * normalTurn +
      slowTurnFactor * slowTurn) /
    (turnFactorsSum * 2);

  const averageSlope = mixBiomes(b => {
    let a: number;
    if (b.type === B_FINISH) {
      a = 0.1;
    } else if (b.type === B_FIRE) {
      a = 0.8;
    } else if (b.type === B_DANG) {
      a = 0.2;
    } else {
      a = 0.5;
    }
    a += b.biomeSeed * 9 % 0.05;
    return a;
  });

  const slopeAmp = 0.3;
  let descent =
    averageSlope +
    slopeAmp *
      (slowSlopeFactor * slowSlope +
        normalSlopeFactor * normalSlope +
        crazySlopeFactor * crazySlope) /
      slopeFactorSum;

  turn = Math.max(-0.4999, Math.min(turn, 0.4999));
  descent = Math.max(0.05, Math.min(descent, 0.9999));

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

export default memoize(genTrack);
