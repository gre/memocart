//@flow
import * as Constants from "../Constants";

const biomeFrequency = {
  B_UFO: 1,
  B_FIRE: 2,
  B_SAPPHIRE: 2,
  B_PLANT: 4,
  B_GOLD: 6,
  B_COAL: 8,
  B_DARK: 10,
  B_DANG: 15,
  B_EMPTY: 20,
  B_WIRED: 30
};

const biomeFrequencyKeys = Object.keys(biomeFrequency);
const biomeFrequencySum = biomeFrequencyKeys.reduce(
  (sum, k) => sum + biomeFrequency[k],
  0
);
const biomeFrequencyProbability = biomeFrequencyKeys.map(
  k => biomeFrequency[k] / biomeFrequencySum
);

export default function(r: number): number {
  let i = 0;
  // eslint-disable-next-line no-cond-assign
  while (
    (r -= biomeFrequencyProbability[i]) > 0 &&
    ++i < biomeFrequencyKeys.length
  );
  return Constants[biomeFrequencyKeys[i]];
}
