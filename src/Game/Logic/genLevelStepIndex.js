//@flow
import { LEVEL_SAFE_MULT, BIOME_SIZE } from "./genTrack";
export default (level: number): number =>
  level === -1
    ? 20 * LEVEL_SAFE_MULT
    : level === 0
      ? 5 * BIOME_SIZE
      : LEVEL_SAFE_MULT * Math.floor(level + 0.2 * level * level);
