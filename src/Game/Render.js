//@flow
import React, { Component } from "react";
import smoothstep from "smoothstep";
import createREGL from "regl";
import postShader from "./shaders/post";
import SimplexNoise from "simplex-noise";
import * as Debug from "../Debug";
import { DEV, TRACK_SIZE } from "./Constants";
import renderShader from "./shaders/render";
import persistenceShader from "./shaders/persistence";
import copyShader from "./shaders/copy";
import makeDrawUI from "./drawUI";

function encodeTrack(track: Array<*>, data: Uint8Array) {
  for (let i = 0; i < track.length; i++) {
    const { turn, descent, biome1, biome2, biomeMix, trackSeed } = track[i];
    data[4 * i] = 255 * (turn + 1) / 2;
    data[4 * i + 1] = 255 * descent;
    data[4 * i + 2] = (biome1.type << 4) | biome2.type;
    data[4 * i + 3] =
      (Math.floor(biomeMix * 15) << 4) | Math.floor(trackSeed * 15);
  }
}

const makeSeamless = (w: number, h: number) => (
  f: (x: number, y: number) => number
) => (x: number, y: number) =>
  (f(x, y) * (w - x) * (h - y) +
    f(x - w, y) * x * (h - y) +
    f(x - w, y - h) * x * y +
    f(x, y - h) * (w - x) * y) /
  (w * h);

function genPerlinTextureData(n) {
  const simplex = new SimplexNoise();
  const data = new Uint8Array(n * n * 4);
  const seamless = makeSeamless(n, n);
  const noiseR = seamless((x, y) => simplex.noise3D(x, y, 0));
  const noiseG = seamless((x, y) => simplex.noise3D(x, y, 1));
  const noiseB = seamless((x, y) => simplex.noise3D(x, y, 2));
  const noiseA = seamless((x, y) => simplex.noise3D(x, y, 3));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      data[4 * (n * y + x) + 0] = 255 * (0.5 + 0.5 * noiseR(x, y));
      data[4 * (n * y + x) + 1] = 255 * (0.5 + 0.5 * noiseG(x, y));
      data[4 * (n * y + x) + 2] = 255 * (0.5 + 0.5 * noiseB(x, y));
      data[4 * (n * y + x) + 3] = 255 * (0.5 + 0.5 * noiseA(x, y));
    }
  }

  return {
    data,
    width: n,
    height: n,
    mag: "linear",
    min: "linear",
    wrapS: "repeat",
    wrapT: "repeat"
  };
}

class Game extends Component {
  onRef = (canvas: *) => {
    this.canvas = canvas;
  };

  canvas: ?HTMLCanvasElement;
  tapped = false;
  mouseAt = null;
  mouseDown = null;
  keys = {};

  getUserEvents = () => {
    const { keys, mouseDown, mouseAt, touchTime } = this;
    let spacePressed = keys[32];
    let keyRightDelta =
      (keys[39] || keys[68]) - (keys[37] || keys[65] || keys[81]);
    let keyUpDelta =
      (keys[38] || keys[87] || keys[90]) - (keys[40] || keys[83]);

    if (mouseDown && mouseAt) {
      const dx = mouseAt[0] - mouseDown[0];
      const dy = mouseAt[1] - mouseDown[1];
      if (Math.abs(dx) > Math.max(10, Math.abs(dy))) {
        keyRightDelta = dx > 0 ? 1 : -1;
      }
    }

    if (this.tapped) {
      this.tapped = false;
      spacePressed = true;
    } else if (mouseDown && touchTime && Date.now() - touchTime > 300) {
      spacePressed = true;
    }

    return {
      keys,
      keyRightDelta,
      keyUpDelta,
      spacePressed,
      mouseDown,
      mouseAt
    };
  };

  _pos = (e: *) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  touchId = null;
  touchTime = null;
  findTouch = (list: Array<*>) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === this.touchId) {
        return list[i];
      }
    }
    return null;
  };
  onTouchStart = (e: *) => {
    if (this.touchId !== null) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.touchId = touch.identifier;
    this.touchTime = Date.now();
    this.mouseAt = this.mouseDown = this._pos(touch);
  };
  onTouchMove = (e: *) => {
    const touch = this.findTouch(e.changedTouches);
    if (touch) {
      e.preventDefault();
      this.mouseAt = this._pos(touch);
    }
  };
  onTouchEnd = (e: *) => {
    const touch = this.findTouch(e.changedTouches);
    if (touch) {
      e.preventDefault();
      const { mouseDown } = this;
      this.mouseDown = null;
      this.touchId = null;
      const pos = this._pos(touch);
      if (pos && mouseDown) {
        const dx = pos[0] - mouseDown[0];
        const dy = pos[1] - mouseDown[1];
        const d = dx * dx + dy * dy;
        if (d < 20) {
          this.tapped = true;
        }
      }
    }
  };
  onTouchCancel = (e: *) => {
    const touch = this.findTouch(e.changedTouches);
    if (touch) {
      this.mouseDown = null;
      this.touchId = null;
    }
  };

  onMouseDown = (e: *) => {
    e.preventDefault();
    this.mouseAt = this.mouseDown = this._pos(e);
  };
  onMouseMove = (e: *) => {
    this.mouseAt = this._pos(e);
  };
  onMouseUp = () => {
    this.mouseDown = null;
  };
  onMouseLeave = () => {
    this.mouseDown = null;
  };

  onKeyUp = (e: *) => {
    this.keys[e.which] = 0;
  };
  onKeyDown = (e: *) => {
    if (e.which === 32) e.preventDefault();
    this.keys[e.which] = 1;
  };
  componentDidMount() {
    const { body } = document;
    const { canvas } = this;
    if (!body || !canvas) return;
    const { getGameState, action } = this.props;
    for (let k = 0; k < 500; k++) {
      this.keys[k] = 0;
    }
    body.addEventListener("keyup", this.onKeyUp);
    body.addEventListener("keydown", this.onKeyDown);

    const initialState = getGameState();
    const enableAfterEffects = initialState.quality === "high";

    let resolution = 64;

    const uiCanvas = document.createElement("canvas");
    const SCALE_UI = 4;
    uiCanvas.width = uiCanvas.height = resolution * SCALE_UI;
    const ui = uiCanvas.getContext("2d");
    ui.scale(SCALE_UI, SCALE_UI);

    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const regl = createREGL(gl);

    const uiTexture = regl.texture();
    const perlin = regl.texture(genPerlinTextureData(128));
    const track = regl.texture();
    const altTrack = regl.texture();
    const renderFBOTexture = regl.texture(resolution);
    const renderFBO = regl.framebuffer({
      color: renderFBOTexture
    });
    let fbo1Texture, fbo1, fbo2Texture, fbo2;
    if (enableAfterEffects) {
      fbo1Texture = regl.texture(resolution);
      fbo1 = regl.framebuffer({
        color: fbo1Texture
      });
      fbo2Texture = regl.texture(resolution);
      fbo2 = regl.framebuffer({
        color: fbo2Texture
      });
    }
    let swapFbos = [fbo1, fbo2];
    let swapFboTextures = [fbo1Texture, fbo2Texture];
    let drawUI = makeDrawUI(ui);
    let render = renderShader(regl, initialState.quality);
    let persistence = persistenceShader(regl);
    let copy = copyShader(regl);
    let post = postShader(regl);

    function uiSync(g) {
      drawUI(g.uiState, g.uiStateBlinkTick);
      uiTexture({
        data: uiCanvas,
        min: "nearest",
        mag: "nearest",
        flipY: true
      });
    }

    if (DEV) {
      Debug.defineEditable("high resolution", false, hi => {
        resolution = hi ? 4 * resolution : 64;
        renderFBOTexture(resolution);
        renderFBO({ color: renderFBOTexture });
        if (enableAfterEffects) {
          fbo1Texture(resolution);
          fbo1({ color: fbo1Texture });
          fbo2Texture(resolution);
          fbo2({ color: fbo2Texture });
        }
      });
    }

    if (module.hot) {
      //$FlowFixMe
      module.hot.accept("./shaders/render", () => {
        Debug.tryFunction(() => {
          render = require("./shaders/render").default(
            regl,
            initialState.quality
          );
        });
      });
      //$FlowFixMe
      module.hot.accept("./drawUI", () => {
        Debug.tryFunction(() => {
          drawUI = require("./drawUI").default(ui);
          const state = getGameState();
          drawUI(state.uiState, state.uiStateBlinkTick);
        });
      });
      //$FlowFixMe
      module.hot.accept("./shaders/post", () => {
        Debug.tryFunction(() => {
          post = require("./shaders/post").default(regl);
        });
      });
      //$FlowFixMe
      module.hot.accept("./shaders/persistence", () => {
        Debug.tryFunction(() => {
          persistence = require("./shaders/persistence").default(regl);
        });
      });
    }

    uiSync(initialState);

    const trackSize = TRACK_SIZE(initialState.quality);

    let trackData = new Uint8Array(4 * trackSize);
    encodeTrack(initialState.track, trackData);
    track({
      width: trackSize,
      height: 1,
      data: trackData
    });

    let altTrackData = new Uint8Array(4 * trackSize);
    encodeTrack(initialState.altTrack, altTrackData);
    altTrack({
      width: trackSize,
      height: 1,
      data: altTrackData
    });

    let lastTime;

    regl.frame(e => {
      const prevState = getGameState();
      const state = action("tick", e, this.getUserEvents());

      if (prevState.track !== state.track) {
        encodeTrack(state.track, trackData);
        track({
          width: trackSize,
          height: 1,
          data: trackData
        });
      }

      if (prevState.altTrack !== state.altTrack) {
        encodeTrack(state.altTrack, altTrackData);
        altTrack({
          width: trackSize,
          height: 1,
          data: altTrackData
        });
      }

      if (
        prevState.uiState !== state.uiState ||
        state.uiStateBlinkTick !== prevState.uiStateBlinkTick ||
        state.tick % 60 === 0
      ) {
        uiSync(state);
      }

      let [backFBO, frontFBO] = swapFbos;
      let [back, front] = swapFboTextures;

      regl.clear({
        framebuffer: renderFBO,
        color: [0, 0, 0, 0],
        depth: 1
      });

      render({
        ...state,
        framebuffer: renderFBO,
        altTrack,
        track,
        perlin
      });

      if (enableAfterEffects) {
        regl.clear({
          framebuffer: frontFBO,
          color: [0, 0, 0, 0],
          depth: 1
        });
        copy({
          framebuffer: frontFBO,
          t: renderFBOTexture
        });

        regl.clear({
          framebuffer: frontFBO,
          color: [0, 0, 0, 0],
          depth: 1
        });
        persistence({
          framebuffer: frontFBO,
          amount: 0.3 + 0.5 * smoothstep(4.0, 20.0, state.speed),
          back,
          front: renderFBOTexture
        });

        regl.clear({
          color: [0, 0, 0, 0],
          depth: 1
        });
      } else {
        front = renderFBOTexture;
      }

      post({
        ...state,
        game: front,
        ui: uiTexture,
        resolution
      });

      swapFbos = [frontFBO, backFBO];
      swapFboTextures = [front, back];

      if (!lastTime) lastTime = e.time;
      const diff = e.time - lastTime;
      lastTime = e.time;
      if (diff > 0.3) {
        Debug.log("slow frame", "#" + e.tick + ": " + diff.toFixed(3) + "s");
        console.log("⚠️ slow frame#" + e.tick + ": " + diff.toFixed(3) + "s");
      }
    });
  }

  render() {
    const { width, height } = this.props;
    const evts = {};
    if (DEV) {
      Object.assign(evts, {
        onMouseDown: this.onMouseDown,
        onMouseUp: this.onMouseUp,
        onMouseMove: this.onMouseMove,
        onMouseLeave: this.onMouseLeave
      });
    }
    Object.assign(evts, {
      onTouchStart: this.onTouchStart,
      onTouchMove: this.onTouchMove,
      onTouchEnd: this.onTouchEnd,
      onTouchCancel: this.onTouchCancel
    });
    return (
      <canvas
        ref={this.onRef}
        width={width}
        height={height}
        style={{ width, height }}
        {...evts}
      />
    );
  }
}

export default Game;
