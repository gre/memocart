//@flow
import genLevelStepBiomeIndex from "./genLevelStepBiomeIndex";
import { BIOME_SIZE } from "./genTrack";
export default (level: number): number =>
  BIOME_SIZE * genLevelStepBiomeIndex(level);
