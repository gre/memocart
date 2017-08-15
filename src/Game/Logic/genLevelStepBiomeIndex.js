//@flow
import memoize from "lodash/memoize";

const mult = 3;
const forLevel = level => mult * Math.floor(level + 0.2 * level * level);

const genLevelStepBiomeIndex = (level: number): number =>
  level === -1
    ? forLevel(8) // DEMO
    : level === 0
      ? forLevel(1) // TUTORIAL
      : forLevel(level);

export const reverseBiomeIndex = memoize((biomeIndex: number) => {
  let level = 1;
  while (forLevel(level) < biomeIndex) level++;
  const biomeIndexLevelFirst = forLevel(level);
  const biomeIndexLevelLast = level <= 1 ? 0 : forLevel(level - 1) + 1;
  return {
    level,
    biomeIndexLevelFirst,
    biomeIndexLevelLast,
    isLevelStart: biomeIndexLevelFirst === biomeIndex
  };
});

export default genLevelStepBiomeIndex;
