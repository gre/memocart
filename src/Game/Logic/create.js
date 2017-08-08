//@flow
import mat3 from "gl-mat3";
import { STATUS_RUNNING, TRACK_SIZE, ALTT_OFF } from "../Constants";
import genTrack, { LEVEL_SAFE_MULT } from "./genTrack";
import type { GameState } from "./types";

const LEVEL_0_SIZE = 100;

export default (level: number, seed: number): GameState => {
  const track = [];
  const stepIndex = level === 0 ? 0.5 * LEVEL_0_SIZE : LEVEL_SAFE_MULT * level;
  for (let i = 0; track.length < TRACK_SIZE; i--) {
    track.push(genTrack(stepIndex + i, seed));
  }
  return {
    status: STATUS_RUNNING,
    time: 0,
    stepTime: 0,
    tick: 0,
    stepTick: 0,
    stepIndex,
    trackStepProgress: 0,
    rotX: 0,
    rotY: 0,
    rot: mat3.create(),
    track,
    seed,
    level,
    speed: 0, // z-unit per second
    acc: 0.1,
    braking: 0, // braking factor
    switchDirectionTarget: -1,
    switchDirection: -1,

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
    debugOrigin: [0, 0, 0]
  };
};
