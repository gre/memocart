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

  function uiSync(uiState: ?UIState, blink: boolean) {
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

    if (uiState.title) {
      const x = uiState.titleCentered
        ? Math.floor((64 - measureText(uiState.title)) / 2)
        : 2;
      const y = 1;
      ui.fillStyle = secondTextColor;
      uiText(uiState.title, x, y, borderOn);
    }
    if (uiState.body) {
      const x = 2;
      const y = Math.floor((64 + titleHeight - footerHeight - bodyHeight) / 2);

      ui.fillStyle = mainTextColor;
      uiText(uiState.body, x, y, borderOn);
    }
    if (uiState.footer && (!uiState.footerBlink || blink)) {
      ui.fillStyle = secondTextColor;
      uiText(
        uiState.footer,
        uiState.footerCentered
          ? Math.floor((64 - measureText(uiState.footer)) / 2)
          : 2,
        64 - footerHeight
      );
    }
  }

  return uiSync;
};
