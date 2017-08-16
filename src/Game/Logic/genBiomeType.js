//@flow
import * as Constants from "../Constants";
import { DEV } from "../Constants";
import smoothstep from "smoothstep";
import * as Debug from "../../Debug";

const biomeFrequencyPerIndex: { [_: string]: (i: number) => number } = {
  B_CLIFF: i =>
    30 * smoothstep(0, 100, i) * Math.pow(Math.max(0, Math.cos(i / 5)), 2),
  B_COAL: i => 8 * smoothstep(0, 20, i),
  B_COPPER: i => 10 * smoothstep(10, 50, i),
  B_DANG: i => 20 * smoothstep(0, 10, i),
  B_DARK: i => 14 * smoothstep(5, 30, i),
  B_EMPTY: i => 20,
  B_FIRE: i => 4 * smoothstep(10, 80, i),
  B_GOLD: i => 6 * smoothstep(0, 30, i) + 9 * smoothstep(30, 100, i),
  B_ICY: i => 4 * smoothstep(0, 20, i),
  B_PLANT: i => 4 * smoothstep(0, 20, i),
  B_SAPPHIRE: i => 2 * smoothstep(0, 40, i),
  B_UFO: i => 5 * smoothstep(20, 200, i),
  B_WIRED: i => 30 - 20 * smoothstep(30, 100, i)
};

if (DEV) Debug.defineEditable("loopBiomes", false);

function genBiomeType(biomeIndex: number, r: number): number {
  const biomeFrequencyKeys = Object.keys(biomeFrequencyPerIndex);
  if (DEV && Debug.getEditable("loopBiomes")) {
    return Constants[
      biomeFrequencyKeys[biomeIndex % biomeFrequencyKeys.length]
    ]; // for DEBUG
  }

  const biomeFrequency = {};
  biomeFrequencyKeys.forEach(k => {
    const f = biomeFrequencyPerIndex[k];
    biomeFrequency[k] = f(biomeIndex);
  });
  const biomeFrequencySum = biomeFrequencyKeys.reduce(
    (sum, k) => sum + biomeFrequency[k],
    0
  );
  const biomeFrequencyProbability = biomeFrequencyKeys.map(
    k => biomeFrequency[k] / biomeFrequencySum
  );
  let i = 0;
  // eslint-disable-next-line no-cond-assign
  while (
    (r -= biomeFrequencyProbability[i]) > 0 &&
    ++i < biomeFrequencyKeys.length
  );
  return Constants[biomeFrequencyKeys[i]];
}

export default genBiomeType;
