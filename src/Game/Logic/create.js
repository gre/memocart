//@flow
import mat3 from "gl-mat3";
import { TRACK_SIZE } from "../Constants";
import genTrack from "./genTrack";
import type { GameState } from "./types";

export default (level: number, seed: number): GameState => {
  const track = [];
  const stepIndex = 500;
  for (let i = 0; i < TRACK_SIZE; i++) {
    track.push(genTrack(stepIndex + i - TRACK_SIZE, seed));
  }
  return {
    time: 0,
    stepTime: 0,
    tick: 0,
    stepTick: 0,
    stepIndex: 500,
    trackStepProgress: 0,
    switchDirectionTarget: -1,
    switchDirection: -1,
    altTrack: [],
    altTrackMode: 0,
    altTrackOffset: [0, 0, 0],
    stateAtMouseDown: null,
    debugOrigin: [0, 0, 0],
    rotX: 0,
    rotY: 0,
    rot: mat3.create(),
    track,
    seed,
    level,
    speed: 0, // z-unit per second
    acc: 0.1,
    braking: 0 // braking factor
  };
};
