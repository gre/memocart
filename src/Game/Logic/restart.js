//@flow
import type { GameState } from "./types";
import create from "./create";

// level: -1 is demo, 0 is tutorial, rest is for normal game
export default (state: GameState): GameState => {
  const g = create(
    state.level,
    // only refresh seed if demo
    state.level === -1 ? Math.random() : state.seed
  );
  g.tutorial = state.tutorial;
  g.switchDirectionTarget = state.switchDirectionTarget;
  return g;
};
