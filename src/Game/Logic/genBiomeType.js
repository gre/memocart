//@flow
import * as Constants from "../Constants";
import smoothstep from "smoothstep";

const biomeFrequencyPerIndex = {
  B_UFO: (biomeIndex: number) => 5 * smoothstep(20, 200, biomeIndex),
  B_FIRE: (biomeIndex: number) => 2 * smoothstep(10, 50, biomeIndex),
  B_SAPPHIRE: (biomeIndex: number) => 2 * smoothstep(0, 40, biomeIndex),
  B_PLANT: (biomeIndex: number) => 4 * smoothstep(0, 20, biomeIndex),
  B_GOLD: (biomeIndex: number) =>
    6 * smoothstep(0, 30, biomeIndex) + 10 * smoothstep(30, 100, biomeIndex),
  B_COAL: (biomeIndex: number) => 8 * smoothstep(0, 20, biomeIndex),
  B_VOID: (biomeIndex: number) => 10 * smoothstep(10, 80, biomeIndex),
  B_DARK: (biomeIndex: number) => 10 * smoothstep(5, 30, biomeIndex),
  B_DANG: (biomeIndex: number) => 15 * smoothstep(0, 10, biomeIndex),
  B_EMPTY: (biomeIndex: number) => 10,
  B_WIRED: (biomeIndex: number) => 30 - 20 * smoothstep(30, 100, biomeIndex)
};

export default function(biomeIndex: number, r: number): number {
  const biomeFrequencyKeys = Object.keys(biomeFrequencyPerIndex);
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
