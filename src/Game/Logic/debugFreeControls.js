//@flow
import vec3 from "gl-vec3";
import type { GameState } from "./types";

function threshold(value, limit) {
  if (Math.abs(value) < limit) return 0;
  return value;
}

export default (
  g: GameState,
  { mouseAt, mouseDown, keys, keyRightDelta, keyUpDelta }: *
) => {
  let move = [0, 0, 0];
  if (mouseDown && !g.stateAtMouseDown) {
    g.stateAtMouseDown = g;
  } else if (!mouseDown && g.stateAtMouseDown) {
    g.stateAtMouseDown = null;
  }

  // keyboard
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
  if (mouseDown && g.stateAtMouseDown) {
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
};
