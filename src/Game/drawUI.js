//@flow
import type { UIState } from "./Logic/types";
import { DEV } from "./Constants";
import * as Debug from "../Debug";
if (DEV) Debug.defineEditable("noUI", false);
export default (ui: CanvasRenderingContext2D) => {
  function uiClear() {
    ui.clearRect(0, 0, 64, 64);
  }
  const lineHeight = 8;
  function calcTextHeight(text) {
    return text.split("\n").length * lineHeight;
  }
  function measureText(text) {
    return ui.measureText(text).width;
  }
  function uiText(text, x, y, withBorder) {
    if (!text) return;
    ui.save();
    const lines = text.split("\n");
    lines.forEach((text, i) => {
      if (withBorder) ui.strokeText(text, x, y + lineHeight * i);
      ui.fillText(text, x, y + lineHeight * i);
    });
    ui.restore();
  }
  function uiLogo() {
    ui.save();
    ui.scale(2, 2);
    ui.translate(7.75, 4);
    ui.fillStyle = "#000";
    uiText("MEMO\nCART", 0.5, 0.5);
    uiText("MEMO\nCART", -0.5, -0.5);
    uiText("MEMO\nCART", 0.5, -0.5);
    uiText("MEMO\nCART", -0.5, 0.5);
    uiText("MEMO\nCART", 0.5, 0);
    uiText("MEMO\nCART", 1, 0);
    ui.fillStyle = "#D83";
    uiText("MEMO\nCART", 0, 0);
    ui.restore();
  }

  function uiSync(
    uiState: ?UIState,
    blink: boolean,
    context: {
      highscores: ?Array<{ username: string, level: number }>,
      title: string
    }
  ) {
    if (!uiState || (DEV && Debug.getEditable("noUI"))) {
      uiClear();
      return;
    }

    const titleHeight = uiState.title ? calcTextHeight(uiState.title) : 0;
    const bodyHeight = uiState.body ? calcTextHeight(uiState.body) : 0;
    const footerHeight = uiState.footer ? calcTextHeight(uiState.footer) : 0;

    let mainTextColor = uiState.black ? "#000" : "#fff";
    let secondTextColor = "#D83";
    let borderOn = !uiState.black;

    uiClear();
    ui.textBaseline = "top";
    ui.strokeStyle = "#000";
    ui.font = "7px MinimalPixels";

    if (uiState.logo) {
      uiLogo();
    }

    if (uiState.area) {
      ui.fillStyle = secondTextColor;
      const w = measureText(uiState.area);
      uiText(uiState.area, 62 - w, 2);
    }

    const title =
      uiState.title || (uiState.useContextTitle ? context.title : "");

    if (title) {
      const x = uiState.titleCentered
        ? Math.floor((64 - measureText(title)) / 2)
        : 2;
      const y = 1;
      ui.fillStyle = secondTextColor;
      uiText(title, x, y, borderOn);
    }

    if (uiState.body) {
      const x = 2;
      const y = Math.floor((64 + titleHeight - footerHeight - bodyHeight) / 2);

      ui.fillStyle = mainTextColor;
      uiText(uiState.body, x, y, borderOn);
    }
    if (uiState.footer) {
      ui.fillStyle = uiState.footerBlink && !blink ? secondTextColor : "#000";
      uiText(
        uiState.footer,
        uiState.footerCentered
          ? Math.floor((64 - measureText(uiState.footer)) / 2)
          : 2,
        64 - footerHeight
      );
    }

    if (uiState.showHighscores) {
      ui.fillStyle = mainTextColor;
      const { highscores } = context;
      if (!highscores) {
        uiText("loading\nhighscores\n...", 2, 20, borderOn);
      } else if (highscores.length > 0) {
        uiText("BEST EXPLORERS:", 2, 12, borderOn);
        const text = highscores
          .slice(0, 4)
          .forEach(({ username, level }, i) => {
            const pad = 8;
            const y = 20 + i * lineHeight;
            ui.fillStyle = mainTextColor;
            uiText(username, pad, y);
            const levelText = level.toString();
            ui.fillStyle = secondTextColor;
            uiText(levelText, 64 - pad - measureText(levelText), y);
            return (
              username + Array(9 - username.length).fill("_").join("") + level
            );
          });
      } else {
        uiText("You are the first\nto explore\nthis mine!", 2, 20, borderOn);
      }
    }
  }

  return uiSync;
};
