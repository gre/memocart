//@flow
import seedrandom from "seedrandom";
import smoothstep from "smoothstep";
import memoize from "lodash/memoize";
import mix from "./mix";
import * as Constants from "../Constants";
import genBiome, { BIOME_SAFE_EACH } from "./genBiome";
import mixBiomes from "./mixBiomes";
import type { Biome, TrackBiome, Track } from "./types";

const BIOME_FREQ = 20;
const BIOME_WINDOW_TRANSITION = 8;
const BIOME_PAD = Math.floor((BIOME_FREQ - BIOME_WINDOW_TRANSITION) / 2);
const BIOME_DUR = 2 * BIOME_PAD + 1;
export const LEVEL_SAFE_MULT = BIOME_SAFE_EACH * BIOME_FREQ;
const { B_INTERS, B_FINISH, B_FIRE, B_DANG } = Constants;

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

  const withBiome = mixBiomes(biome1, biome2, biomeMix, uniqueBiome);

  const slowTurnFactor = withBiome(b => {
    return b.biomeSeed < 0.2 ? 0.1 : 1;
  });
  const slowSlopeFactor = withBiome(b => {
    return 0.01 + Math.pow(b.biomeSeed * 9 % 1.5, 3);
  });

  const normalTurnFactor = withBiome(b => {
    return Math.pow(b.biomeSeed * 80 % 1, 2);
  });
  const normalSlopeFactor = withBiome(b => {
    return Math.pow(b.biomeSeed * 4 % 1, 2);
  });

  const crazyTurnFactor = withBiome(b => {
    return (b.type === B_DANG ? 0.5 : 0.1) * (b.biomeSeed * 11 % 1);
  });
  const crazySlopeFactor = withBiome(b => {
    const r = crazyTurnFactor + b.biomeSeed * 3 % 1;
    if (b.type === B_DANG) {
      if (r < 0.1) return 10;
      if (r < 0.2) return 1;
      return 0.2 * r;
    }
    return 0.1 * r;
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

  const averageSlope = withBiome(b => {
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

  const slopeAmp = withBiome(b => (b.type === B_DANG ? 0.8 : 0.3));
  let descent =
    averageSlope +
    slopeAmp *
      (slowSlopeFactor * slowSlope +
        normalSlopeFactor * normalSlope +
        crazySlopeFactor * crazySlope) /
      slopeFactorSum;

  descent = withBiome(b => {
    let rand = b.biomeSeed * 11 % 1;
    if (rand < 0.2 && !b.isSafe) return descent * 0.2; // no slope in some cases
    if (rand > 0.8) return descent + 0.6; // high slope in some cases
    return descent;
  });

  turn = Math.max(-0.4999, Math.min(turn, 0.4999));
  descent = Math.max(0.1, Math.min(descent, 0.9999));

  turn = withBiome((b, unique) => {
    // specific business logic
    if (b.type === B_FINISH) {
      return 0;
    }
    if (b.type === B_INTERS) {
      const turnSmoothing = 5;
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

export function formatTrackIndex(trackIndex: number): string {
  trackIndex--;
  const level = Math.max(0, Math.floor(trackIndex / LEVEL_SAFE_MULT));
  const biome = Math.max(
    0,
    Math.floor((trackIndex - LEVEL_SAFE_MULT * level) / BIOME_FREQ)
  );
  return "AREA  " + (level + 1) + "-" + (biome + 1);
}

export default memoize(
  genTrack,
  (trackIndex: number, seed: number) => trackIndex + "_" + seed
);
