//@flow
import type { GameState } from "./types";
import create from "./create";

// level: -1 is demo, 0 is tutorial, rest is for normal game
export default (state: GameState): GameState => {
  const g = create(state.level, state.seed, state.quality);
  g.stepTick = Math.floor(1000 + 1000 * Math.random());
  g.tutorial = state.tutorial;
  g.switchDirectionTarget = state.switchDirectionTarget;
  return g;
};
