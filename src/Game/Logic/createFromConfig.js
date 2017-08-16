//@flow
import create from "./create";
import type { GameState } from "./types";
// level: -1 is demo, 0 is tutorial, rest is for normal game
export default ({ seed, quality, username }: *): GameState =>
  create(-1, seed, quality, username);
