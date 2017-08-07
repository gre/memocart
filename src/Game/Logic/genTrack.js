//@flow
import smoothstep from "smoothstep";
import mix from "./mix";
import * as Constants from "../Constants";

export default function genTrack(i: number, seed: number) {
  let turn =
    0.5 *
    (Math.cos(8 * seed + i * 0.2) + Math.sin(20 * (seed * 20 % 1) + i * 0.33));
  let descent = 0.5 + 0.5 * Math.cos(seed * 99 % 8 + i * 0.5);
  let biome1 = Constants.B_EMPTY;
  let biome2 = Constants.B_EMPTY;
  let biomeMix = 0;
  let biomeSeed = Math.cos(
    (i + 100.0 * (seed * 3 % 1)) * 83.93 +
      6 * (seed - 0.5) +
      Math.sin(i * (47.1 + seed * 8 % 1))
  );

  if (i < 0) {
    // this is an ending track, we converge to some defaults
    const mixValue = smoothstep(0, -4, i);
    turn = mix(turn, 0, mixValue);
    descent = mix(descent, 0.1, mixValue);
    biome1 = Constants.B_EMPTY;
    biome2 = Constants.B_FINISH;
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
