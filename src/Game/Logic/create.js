//@flow
import mat3 from "gl-mat3";
import {
  STATUS_RUNNING,
  TRACK_SIZE,
  ALTT_OFF,
  TURN_DX,
  DESCENT_DY
} from "../Constants";
import genTrack from "./genTrack";
import genLevelStepIndex from "./genLevelStepIndex";
import { pressSpace } from "./messages";
import type { GameState, Quality } from "./types";

// level: -1 is demo, 0 is tutorial, rest is for normal game
export default (
  level: number,
  seed: string,
  quality: Quality,
  username: string
): GameState => {
  let speed = 0,
    acc = 0.1,
    uiState = null;

  if (level === -1) {
    // Menu Screen / DEMO
    acc = 1;
    speed = 3;
    uiState = {
      useContextTitle: true,
      showHighscores: true,
      footerBlink: true,
      footerCentered: true,
      footer: pressSpace()
    };
  } else if (level === 0) {
    // Tutorial
  } else {
    // Game
    speed = 2;
    uiState = {
      levelInfoActive: true
    };
  }

  const stepIndex = genLevelStepIndex(level);

  const track = [];
  for (let i = 0; track.length < TRACK_SIZE(quality); i--) {
    track.push(genTrack(stepIndex + i, seed));
  }

  // worldDelta is relative to the end position
  const worldDelta = [0, 0, 0];
  for (let i = 0; i < stepIndex; i++) {
    const t = genTrack(i, seed);
    worldDelta[0] -= TURN_DX * t.turn;
    worldDelta[1] -= DESCENT_DY * t.descent;
    worldDelta[2] -= 1;
  }

  return {
    username,
    gameOversCountPerBiomeIndex: {},
    quality,
    audioState: {
      volume: 0.5, // will increase shortly
      speed: 0,
      braking: 0,
      descentShake: 0,
      turnShake: 0,
      biomesProximity: Array(16).fill(0),
      triggerSwitchChange: false,
      triggerCartAccident: false,
      triggerLightCartAccident: false,
      triggerIntersectionSwitch: false,
      triggerWin: false,
      stepIndex,
      home: level === -1
    },
    uiState,
    uiStateBlinkTick: false,
    status: STATUS_RUNNING,
    tutorial: 0,
    time: 0,
    startTime: 0,
    statusChangedTime: 0,
    stepTime: 0,
    tick: 0,
    stepTick: 0,
    stepIndex,
    trackStepProgress: 0,
    intersectionBiomeEnd: 0,
    terrainOffset: [0, 0, 0],
    rotX: 0,
    rotY: 0,
    rot: mat3.create(),
    track,
    seed,
    level,
    levelReached: level,
    speed,
    acc,
    braking: 0,
    switchDirectionTarget: -1,
    switchDirection: -1,
    zoomOut: 0,
    altTrack: [],
    altTrackMode: ALTT_OFF,
    altTrackOffset: [0, 0, 0],
    altTrackFailures: 0,
    stateAtMouseDown: null,
    origin: [0, 0.05, 1.4],
    worldDelta
  };
};
