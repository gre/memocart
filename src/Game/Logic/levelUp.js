//@flow
import type { GameState } from "./types";
import create from "./create";

// level: -1 is demo, 0 is tutorial, rest is for normal game
export default (state: GameState): GameState => {
  const g = create(
    state.level + 1,
    // if before was demo, we start fresh with a new seed.
    state.level === -1 ? Math.random() : state.seed
  );
  return g;
};
