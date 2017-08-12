//@flow
import { LEVEL_SAFE_MULT } from "./genTrack";
export default (level: number): number =>
  level === -1 ? 1000 : level === 0 ? 100 : LEVEL_SAFE_MULT * level;
