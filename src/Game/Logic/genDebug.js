// In the Console:
// genDebugPrint(genDebug(10, globalSeed));genDebug(10, globalSeed)

import * as Constants from "../Constants";
import genTrack from "./genTrack";
import genBiome from "./genBiome";
import genBiomeType from "./genBiomeType";
import genLevelStepIndex from "./genLevelStepIndex";

window.genTrack = genTrack;
window.genBiome = genBiome;
window.genBiomeType = genBiomeType;
window.genLevelStepIndex = genLevelStepIndex;

window.genDebug = (levelMax: number, seed: number) => {
  let previousStepIndex = 0;
  const levels = [];
  for (let l = 1; l < levelMax; l++) {
    const stepIndex = genLevelStepIndex(l);
    const level = {
      tracks: [],
      biomes: []
    };
    let biome = null;
    for (let step = previousStepIndex; step < stepIndex; step++) {
      const track = genTrack(step, seed);
      const { uniqueBiome } = track;
      if (
        uniqueBiome &&
        (!biome || uniqueBiome.biomeSeed !== biome.biomeSeed)
      ) {
        biome = uniqueBiome;
        const { biomeSeed, type } = uniqueBiome;
        level.biomes.push({ biomeSeed, type });
      }
      level.tracks.push(track);
    }
    levels.push(level);
    previousStepIndex = stepIndex;
  }
  return { levels };
};

export const printBiome = (biome: Object) => {
  if (biome.type === Constants.B_INTERS) {
    return biome.biomeSeed > 0.5 ? "LEFT" : "RIGHT";
  }
  return Object.keys(Constants)
    .filter(k => k.indexOf("B_") === 0)
    .find(k => Constants[k] === biome.type)
    .toLowerCase()
    .slice(2);
};

window.genDebugPrint = (result: Object) => {
  console.log(
    result.levels
      .map((level, i) => {
        return `L${i + 1}: ${level.biomes.map(printBiome).join(" ")}`;
      })
      .join("\n")
  );
};
