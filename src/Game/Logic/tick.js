//@flow
import vec3 from "gl-vec3";
import mat3 from "gl-mat3";
import {
  DEV,
  TRACK_SIZE,
  STATUS_FINISHED,
  B_INTERS,
  ALTT_OFF,
  ALTT_CART_ON,
  ALTT_CART_OFF,
  TURN_DX,
  DESCENT_DY
} from "../Constants";
import genTrack from "./genTrack";
import debugFreeControls from "./debugFreeControls";
import trackToCoordinates from "./trackToCoordinates";
import * as Debug from "../../Debug";
import type { GameState, Biome } from "./types";

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

function correctDirection(g: GameState, biome: Biome): boolean {
  return (
    Boolean(g.switchDirectionTarget < 0) === Boolean(biome.biomeSeed > 0.5)
  );
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
  { time, tick }: { time: number, tick: number },
  userEvents: *
): GameState => {
  const g = { ...gameState };

  const freeControls = DEV && Debug.getEditable("freeControls");
  if (freeControls) {
    debugFreeControls(g, userEvents);
  }

  if (g.stepIndex < 0) {
    g.status = STATUS_FINISHED;
    return g;
  }

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
    const droppedTrack = g.track[0];
    g.track = g.track.slice(1);
    g.track.push(genTrack(g.stepIndex - TRACK_SIZE + 1, g.seed));

    const { uniqueBiome } = g.track[0];
    if (uniqueBiome && uniqueBiome.biome.type === B_INTERS) {
      const droppedAltTrack = g.altTrack[0];
      g.altTrack = g.track.map((t, i) => {
        const track = { ...t };
        track.turn *= -1;
        return track;
      });

      if (droppedAltTrack) {
        g.altTrackOffset[0] -=
          TURN_DX * (droppedTrack.turn - droppedAltTrack.turn);
        g.altTrackOffset[1] -=
          DESCENT_DY * (droppedTrack.descent - droppedAltTrack.descent);
      }

      const altTrackHasDiverged = g.altTrackOffset[0] !== 0;

      const directionIsCorrect = correctDirection(g, uniqueBiome.biome);
      if (!altTrackHasDiverged || g.altTrackMode === ALTT_OFF) {
        g.altTrackMode = directionIsCorrect ? ALTT_CART_OFF : ALTT_CART_ON;
      }
    } else if (g.altTrackMode !== ALTT_OFF) {
      // there used to be altTrack but we no longer is in INTERS biome
      if (g.altTrackMode === ALTT_CART_ON) {
        // TODO set game over / start over the level
      } else {
        // Continue the game
        g.altTrack = [];
        g.altTrackMode = ALTT_OFF;
        g.altTrackOffset = [0, 0, 0];
      }
    }
  }
  g.trackStepProgress = trackStepProgress;

  const trackCoords = trackToCoordinates(g.track);
  const altTrackCoords = trackToCoordinates(g.altTrack);

  g.braking += (userEvents.braking - g.braking) * 0.1;

  const descent = g.track[0].descent + 0.001;
  const frictionFactor = 0.006;
  const speedFriction = Math.pow(1 - frictionFactor, 60 * dt);
  const accFriction = Math.pow(1 - 0.2 * frictionFactor, 60 * dt);

  g.acc = Math.max(0, Math.min((g.acc + 0.3 * descent * dt) * accFriction, 4));
  g.acc -= g.braking * 0.4 * dt;
  g.speed = Math.max(0, Math.min((g.speed + dt * g.acc) * speedFriction, 10));

  //g.speed = 0.5;

  /*
  Debug.log("descent", descent);
  Debug.log("acc", g.acc);
  Debug.log("speed", g.speed);
  */

  if (userEvents.keyRightDelta) {
    g.switchDirectionTarget = userEvents.keyRightDelta;
  }

  if (!freeControls) {
    let targetRotX, targetRotY;
    const n = Math.max(2, Math.min(3, TRACK_SIZE - 1));
    const targetP = vec3.create();
    const relativeFirst = vec3.create();
    const relativeLast = vec3.create();
    const { uniqueBiome } = g.track[0];
    const focusOnAltTrack =
      altTrackCoords.length > 0 &&
      uniqueBiome &&
      g.altTrackMode === ALTT_CART_ON; // FIXME something not correct after diverge

    const coords = focusOnAltTrack ? altTrackCoords : trackCoords;

    vec3.scale(relativeFirst, coords[1], 1 - trackStepProgress);
    vec3.subtract(relativeLast, coords[n + 1], coords[n]);
    vec3.scale(relativeLast, relativeLast, trackStepProgress);
    vec3.add(targetP, coords[n], relativeFirst);
    vec3.add(targetP, targetP, relativeLast);
    // targetP = (1-p)*c[1] + c[n] + (c[n+1]-c[c])*p
    targetRotX = Math.atan(-0.4 + 0.5 * targetP[1] / n);
    targetRotY = Math.atan(0.8 * targetP[0] / n);
    g.rotX += (targetRotX - g.rotX) * 0.03;
    g.rotY += (targetRotY - g.rotY) * 0.03;
    // FIXME is the rotation correct? why is the camera weird like on a boat XD
  }

  g.switchDirection += (g.switchDirectionTarget - g.switchDirection) * 0.1;

  setMatRot(g.rot, g.rotX, g.rotY);

  Debug.log("altTrackMode", g.altTrackMode);
  Debug.log("stepIndex", g.stepIndex);
  Debug.log(
    "trackBiome",
    g.track[0].biomeMix === 0
      ? g.track[0].biome1.type
      : g.track[0].biomeMix === 1
        ? g.track[0].biome2.type
        : g.track[0].biome1.type +
          "–>" +
          g.track[0].biome2.type +
          " % " +
          g.track[0].biomeMix.toFixed(2)
  );

  return g;
};
