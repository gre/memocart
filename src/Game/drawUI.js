//@flow
import type { GameState } from "./Logic/types";
export default (ui: CanvasRenderingContext2D) => {
  function uiClear() {
    ui.clearRect(0, 0, 64, 64);
  }
  function uiText(text, x, y) {
    ui.save();
    const lines = text.split("\n");
    const lineHeight = 6;
    lines.forEach((text, i) => ui.fillText(text, x, y + lineHeight * i));
    ui.restore();
  }
  function uiLogo() {
    ui.save();
    ui.scale(2, 2);
    ui.translate(7.75, 4);
    ui.fillStyle = "#666";
    uiText("MEMO\nCART", 0.5, 0.5);
    ui.fillStyle = "#eee";
    uiText("MEMO\nCART", 0, 0);
    ui.restore();
  }

  function uiSync(g: GameState) {
    const blink = g.tick % 120 < 60;
    uiClear();
    if (g.level === -1) {
      uiLogo();
      ui.fillStyle = "#fff";
      if (blink) uiText("press SPACE", 10, 54);
    } else if (g.level === 0) {
      ui.fillStyle = "#da6";
      if (g.stepIndex > 50) {
        uiText("SPACE: brake\nL   /   R: switch", 2, 50);
      }
    } else {
      ui.fillStyle = "#c22";
      uiText("LVL " + g.level, 2, 2);
    }
  }

  return uiSync;
};
