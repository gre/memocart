//@flow
import type { GameState } from "./types";
import create from "./create";

// level: -1 is demo, 0 is tutorial, rest is for normal game
export default (state: GameState): GameState => {
  const g = create(state.level, state.seed, state.quality, state.username);
  g.stepTick = Math.floor(1000 + 1000 * Math.random());
  g.tutorial = state.tutorial;
  g.switchDirectionTarget = state.switchDirectionTarget;
  g.gameOversCountPerBiomeIndex = state.gameOversCountPerBiomeIndex;
  return g;
};
