//@flow
import type { GameState } from "../logic/types";

const context = new AudioContext();

let sync;
if (!context) {
  sync = (g: GameState) => {};
} else {
  const out = context.createGain();
  out.gain.value = 0.5;
  // $FlowFixMe
  const compressor = context.createDynamicsCompressor();
  out.connect(compressor);
  compressor.connect(context.destination);

  const osc = context.createOscillator();
  osc.frequency.value = 800;

  osc.connect(out);

  sync = (g: GameState) => {};
}

export default sync;
