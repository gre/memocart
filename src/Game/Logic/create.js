//@flow
import mat3 from "gl-mat3";
import {
  STATUS_RUNNING,
  TRACK_SIZE,
  ALTT_OFF,
  TURN_DX,
  DESCENT_DY
} from "../Constants";
import genTrack, { LEVEL_SAFE_MULT } from "./genTrack";
import type { GameState } from "./types";

// level: -1 is demo, 0 is tutorial, rest is for normal game
export default (level: number, seed: number): GameState => {
  let speed = 0,
    acc = 0.1,
    stepIndex,
    uiState = null;

  if (level === -1) {
    // Menu Screen / DEMO
    acc = 1;
    speed = 3;
    stepIndex = 1000;
    uiState = {
      logo: true,
      footerBlink: true,
      footerCentered: true,
      footer: "Press SPACE"
    };
  } else if (level === 0) {
    // Tutorial
    stepIndex = 100;
  } else {
    // Game
    speed = 2;
    stepIndex = LEVEL_SAFE_MULT * level;
    uiState = {
      levelInfoActive: true
    };
  }

  const track = [];
  for (let i = 0; track.length < TRACK_SIZE; i--) {
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
    speed, // z-unit per second
    acc,
    braking: 0, // braking factor
    switchDirectionTarget: -1,
    switchDirection: -1,
    zoomOut: 0,

    /*
algorithm:

When intersection is in Z step future, altTrackOffset is (0., Z), altTrack is init with a full track already that don't swap. altTrackMode=1.0.

Then when reached it will be (DX,0) where DX gets accumulated with track & alt track data. It swaps same way data does. altTrackMode=2.0 if play took wrong turn otherwise 1.0 until the altTrack fade away.

If followAltTrack, camera and cart is offset by altTrackOffset.
*/
    altTrack: [], // wrong turn track data
    altTrackMode: ALTT_OFF,
    altTrackOffset: [0, 0, 0], // how many x,y does track starts

    stateAtMouseDown: null,
    origin: [0, 0.05, 1.4],
    worldDelta
  };
};
