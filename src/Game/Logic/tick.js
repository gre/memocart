//@flow
import vec3 from "gl-vec3";
import mat3 from "gl-mat3";
import { DEV, TRACK_SIZE } from "../Constants";
import genTrack from "./genTrack";
import debugFreeControls from "./debugFreeControls";
import trackToCoordinates from "./trackToCoordinates";
import * as Debug from "../../Debug";

function setMatRot(rot: Array<number>, rotX: number, rotY: number) {
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  // prettier-ignore
  mat3.multiply(
    rot,
    [
      1, 0, 0,
      0, cx, sx,
      0, -sx, cx
    ],
    [
      cy, 0, sy,
      0, 1, 0,
      -sy, 0, cy
    ]
  );
  mat3.transpose(rot, rot);
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

if (DEV) {
  Debug.defineEditable("freeControls", false);
}

export default (
  gameState: GameState,
  { time, tick }: *,
  userEvents: *
): GameState => {
  const g = { ...gameState };
  if (g.time === 0) {
    g.stepTime = time;
    g.stepTick = tick;
    g.time = time;
    g.tick = tick;
  }
  const dt = Math.min(time - g.time, 100 /* safe dt */);
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
    g.stepIndex--;
    g.track = g.track.slice(1);
    g.track.push(genTrack(g.stepIndex, g.seed));
  }
  g.trackStepProgress = trackStepProgress;

  const trackCoords = trackToCoordinates(g.track);

  g.braking += (userEvents.braking - g.braking) * 0.1;

  const descent = g.track[0].descent + 0.001;
  const frictionFactor = 0.006;
  const speedFriction = Math.pow(1 - frictionFactor, 60 * dt);
  const accFriction = Math.pow(1 - 0.2 * frictionFactor, 60 * dt);

  g.acc = Math.max(0, Math.min((g.acc + 0.3 * descent * dt) * accFriction, 4));
  g.acc -= g.braking * 0.4 * dt;
  g.speed = Math.max(0, Math.min((g.speed + dt * g.acc) * speedFriction, 10));

  Debug.log("descent", descent);
  Debug.log("acc", g.acc);
  Debug.log("speed", g.speed);

  if (userEvents.keyRightDelta) {
    g.switchDirectionTarget = userEvents.keyRightDelta;
  }

  if (DEV && Debug.getEditable("freeControls")) {
    debugFreeControls(g, userEvents);
  } else {
    let targetRotX, targetRotY;
    const n = Math.max(2, Math.min(3, TRACK_SIZE - 1));
    const targetP = vec3.create();
    const relativeFirst = vec3.create();
    const relativeLast = vec3.create();
    vec3.scale(relativeFirst, trackCoords[1], 1 - trackStepProgress);
    vec3.subtract(relativeLast, trackCoords[n + 1], trackCoords[n]);
    vec3.scale(relativeLast, relativeLast, trackStepProgress);
    vec3.add(targetP, trackCoords[n], relativeFirst);
    vec3.add(targetP, targetP, relativeLast);
    // targetP = (1-p)*c[1] + c[n] + (c[n+1]-c[c])*p
    targetRotX = Math.atan(-0.4 + 0.5 * targetP[1] / n);
    targetRotY = Math.atan(0.8 * targetP[0] / n);
    g.rotX += (targetRotX - g.rotX) * 0.04;
    g.rotY += (targetRotY - g.rotY) * 0.04;
    // FIXME is the rotation correct? why is the camera weird like on a boat XD
  }

  g.switchDirection += (g.switchDirectionTarget - g.switchDirection) * 0.1;

  setMatRot(g.rot, g.rotX, g.rotY);

  Debug.log("stepIndex", g.stepIndex);

  return g;
};
