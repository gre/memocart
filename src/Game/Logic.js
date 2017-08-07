//@flow
import * as Debug from "../Debug";
import { DEV, TRACK_SIZE } from "./Constants";
import mat3 from "gl-mat3";
import vec3 from "gl-vec3";

if (DEV) {
  Debug.defineEditable("freeControls", false);
}

type GameState = *;

const Logic = {};

function threshold(value, limit) {
  if (Math.abs(value) < limit) return 0;
  return value;
}

function setMatRot(rot, rotX, rotY) {
  mat3.multiply(
    rot,
    [
      1,
      0,
      0,
      0,
      Math.cos(rotX),
      Math.sin(rotX),
      0,
      -Math.sin(rotX),
      Math.cos(rotX)
    ],
    [
      Math.cos(rotY),
      0,
      Math.sin(rotY),
      0,
      1,
      0,
      -Math.sin(rotY),
      0,
      Math.cos(rotY)
    ]
  );
  mat3.transpose(rot, rot);
}

function genTrack(i: number, seed: number) {
  const turn =
    0.5 *
    (Math.cos(8 * seed + i * 0.2) + Math.sin(20 * (seed * 20 % 1) + i * 0.33));
  const descent = 0.5 + 0.5 * Math.cos(seed * 99 % 8 + i * 0.5);
  const biome1 = 1;
  const biome2 = 1;
  const biomeMix = 0;
  const biomeSeed = Math.cos(
    (i + 100.0 * (seed * 3 % 1)) * 83.93 +
      6 * (seed - 0.5) +
      Math.sin(i * (47.1 + seed * 8 % 1))
  );
  return {
    turn,
    descent,
    biome1,
    biome2,
    biomeMix,
    biomeSeed
  };
}

/*
// HACK altTrackOffset (tmp rendering)
// FIXME better idea: when the track is in future, we'll just use the same track data (optim: the loop only opU for the alt tracks so maybe we need to know the intersection index (futureIntersection index ?))
const offZ = 4;
altTrackOffset = [0, 0, offZ];
for (let i = 0; i < offZ; i++) {
  altTrackOffset[0] += 1.5 * (trackData[4 * i] / 255 - 0.5);
  altTrackOffset[1] += -0.6 * (trackData[4 * i + 1] / 255);
}
*/

Logic.create = (level: number, seed: number): GameState => {
  const track = [];
  for (let i = 0; i < TRACK_SIZE; i++) {
    track.push(genTrack(i, seed));
  }
  return {
    time: 0,
    stepTime: 0,
    tick: 0,
    stepTick: 0,
    stepIndex: 0,
    trackStepProgress: 0,
    switchDirectionTarget: -1,
    switchDirection: -1,
    altTrack: [],
    altTrackMode: 0,
    altTrackOffset: [0, 0, 0],
    stateAtMouseDown: null,
    origin: [0, 0.05, 1.2],
    rotX: 0,
    rotY: 0,
    rot: mat3.create(),
    track,
    seed,
    level,
    speed: 4 // z-unit per second
  };
};

Logic.tick = (
  gameState: GameState,
  { time, tick }: *,
  { keys, keyRightDelta, keyUpDelta, mouseAt, mouseDown }: *
): GameState => {
  const g = { ...gameState };
  if (g.stepTime === 0) {
    g.stepTime = time;
    g.stepTick = tick;
  }
  g.time = time;
  g.tick = tick;
  let trackStepProgress = g.speed * (time - g.stepTime);
  if (trackStepProgress >= 1) {
    // new step
    if (DEV) {
      Debug.log("fps", Math.round((tick - g.stepTick) / (time - g.stepTime)));
    }
    g.stepTick = tick;
    g.stepTime = time;
    trackStepProgress = 0;
    g.stepIndex++;
    g.track = g.track.slice(1);
    g.track.push(genTrack(g.stepIndex, g.seed));
  }
  g.trackStepProgress = trackStepProgress;

  if (keyRightDelta) {
    g.switchDirectionTarget = keyRightDelta;
  }

  // freeControls debug
  // keyboard
  if (DEV && Debug.getEditable("freeControls")) {
    let move = [0, 0, 0];
    if (mouseDown && !g.stateAtMouseDown) {
      g.stateAtMouseDown = g;
    } else if (!mouseDown && g.stateAtMouseDown) {
      g.stateAtMouseDown = null;
    }
    if (keys[18]) {
      g.rotY += 0.03 * keyRightDelta;
      g.rotX += 0.02 * keyUpDelta;
    } else {
      if (keys[16]) {
        move[1] += 0.1 * keyUpDelta;
        move[0] += 0.1 * keyRightDelta;
      } else {
        g.rotY += 0.03 * keyRightDelta;
        move[2] += 0.1 * keyUpDelta;
      }
    }

    // mouse
    if (mouseDown) {
      g.rotY = g.stateAtMouseDown.rotY - 0.005 * (mouseAt[0] - mouseDown[0]);
      g.rotX = g.stateAtMouseDown.rotX + 0.005 * (mouseAt[1] - mouseDown[1]);
    }

    // gamepads
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    if (gamepads[0]) {
      const { axes, buttons } = gamepads[0];
      if (axes.length >= 2) {
        move[0] += 0.06 * threshold(axes[0], 0.2);
        move[2] -= 0.06 * threshold(axes[1], 0.2);
      }
      if (axes.length >= 4) {
        g.rotY += 0.02 * threshold(axes[2], 0.2);
        g.rotX += 0.02 * threshold(axes[3], 0.2);
      }
      if (buttons.length > 7) {
        move[1] += 0.05 * (buttons[7].value - buttons[6].value);
      }
    }
    const vector = vec3.create();
    vec3.transformMat3(vector, move, g.rot);
    vec3.add(g.origin, g.origin, vector);
  } else {
    const n = Math.round(0.4 * (TRACK_SIZE - 1));
    let i = 0,
      x = 0,
      y = 0;
    x += (1 - g.trackStepProgress) * 1.5 * (0.5 * g.track[i].turn);
    y += -(1 - g.trackStepProgress) * 0.6 * g.track[i].descent;
    for (i = 1; i < n; i++) {
      x += 1.5 * (0.5 * g.track[i].turn);
      y += -0.6 * g.track[i].descent;
    }

    x += g.trackStepProgress * 1.5 * (0.5 * g.track[i].turn);
    y += -g.trackStepProgress * 0.6 * g.track[i].descent;
    g.rotX = Math.atan(-0.4 + 0.5 * y / n);
    g.rotY = Math.atan(0.8 * x / n);
    // FIXME is the rotation correct? why is the camera weird like on a boat XD
  }

  g.switchDirection += (g.switchDirectionTarget - g.switchDirection) * 0.1;

  setMatRot(g.rot, g.rotX, g.rotY);

  return g;
};

export default Logic;
