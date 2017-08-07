//@flow
import smoothstep from "smoothstep";
import mix from "./mix";
import { B_EMPTY, B_DARK, B_INTERS, B_FINISH } from "../Constants";

const BIOME_FREQ = 20;
const BIOME_WINDOW_TRANSITION = 8;
const BIOME_PAD = (BIOME_FREQ - BIOME_WINDOW_TRANSITION) / 2;
const BIOME_SAFE_EACH = 10;
export const LEVEL_SAFE_MULT = BIOME_SAFE_EACH * BIOME_FREQ;

function genBiome(i: number, seed: number) {
  const r =
    0.49999 +
    0.5 * Math.cos((seed + 3 * i) * 345 % 1 + Math.sin((i + seed) * 99.9));
  let b = B_EMPTY;
  if (r < 0.5) b = B_DARK;

  // FIXME maybe can vary that based on levels (aka the i value)?
  const intersectionRoulette = 5;
  if (i === 2) {
    return B_INTERS;
  }

  if (i > 6 && i % BIOME_SAFE_EACH > 1) {
    const intersectionMinReference = Math.floor(i / intersectionRoulette);
    const winner = Math.floor(
      (seed + 1) * intersectionMinReference * 39.2 % intersectionRoulette
    );
    if (i % intersectionRoulette === winner) {
      return B_INTERS;
    }
  }
  return b;
}

export default function genTrack(i: number, seed: number) {
  let turn =
    0.4999 *
    (Math.cos(8 * seed + i * 0.2) + Math.sin(20 * (seed * 20 % 1) + i * 0.33));
  let descent = 0.49999 + 0.5 * Math.cos(seed * 99 % 8 + i * 0.5);

  const biomeIndex = Math.ceil(i / BIOME_FREQ);
  const biomePrevTrackIndex = biomeIndex * BIOME_FREQ;
  const biomeTrackIndexDelta = biomePrevTrackIndex - i;
  let biome1 = genBiome(biomeIndex, seed);
  let biome2 = genBiome(biomeIndex - 1, seed);
  let biomeMix = smoothstep(
    BIOME_PAD,
    BIOME_FREQ - BIOME_PAD,
    biomeTrackIndexDelta
  );

  let biomeSeed =
    0.4999 +
    0.5 *
      Math.cos(
        (i + 100.0 * (seed * 3 % 1)) * 83.93 +
          6 * (seed - 0.5) +
          Math.sin(i * (47.1 + seed * 8 % 1))
      );

  if (i < 0) {
    // this is an ending track, we converge to some defaults
    const mixValue = smoothstep(0, -20, i);
    turn = mix(turn, 0, mixValue);
    descent = mix(descent, 0.1, mixValue);
    biome1 = B_EMPTY;
    biome2 = B_FINISH;
    biomeMix = mixValue;
  }
  return {
    turn,
    descent,
    biome1,
    biome2,
    biomeMix,
    biomeSeed
  };
}
