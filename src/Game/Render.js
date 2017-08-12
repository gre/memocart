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
  mouseAt = null;
  mouseDown = null;
  keys = {};

  getUserEvents = () => {
    const { keys, mouseDown, mouseAt } = this;
    const keyRightDelta =
      (keys[39] || keys[68]) - (keys[37] || keys[65] || keys[81]);
    const keyUpDelta =
      (keys[38] || keys[87] || keys[90]) - (keys[40] || keys[83]);

    return {
      keys,
      keyRightDelta,
      keyUpDelta,
      spacePressed: keys[32],
      mouseDown,
      mouseAt
    };
  };

  _pos = (e: *) => {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
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
    const fbo1Texture = regl.texture(resolution);
    const fbo1 = regl.framebuffer({
      color: fbo1Texture
    });
    const fbo2Texture = regl.texture(resolution);
    const fbo2 = regl.framebuffer({
      color: fbo2Texture
    });
    let swapFbos = [fbo1, fbo2];
    let swapFboTextures = [fbo1Texture, fbo2Texture];
    let drawUI = makeDrawUI(ui);
    let render = renderShader(regl, this.props.quality);
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
        fbo1Texture(resolution);
        fbo1({ color: fbo1Texture });
        fbo2Texture(resolution);
        fbo2({ color: fbo2Texture });
      });
    }

    if (module.hot) {
      //$FlowFixMe
      module.hot.accept("./shaders/render", () => {
        Debug.tryFunction(() => {
          render = require("./shaders/render").default(
            regl,
            this.props.quality
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

    const initialState = getGameState();
    uiSync(initialState);

    let trackData = new Uint8Array(4 * TRACK_SIZE);
    encodeTrack(initialState.track, trackData);
    track({
      width: TRACK_SIZE,
      height: 1,
      data: trackData
    });

    let altTrackData = new Uint8Array(4 * TRACK_SIZE);
    encodeTrack(initialState.altTrack, altTrackData);
    altTrack({
      width: TRACK_SIZE,
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
          width: TRACK_SIZE,
          height: 1,
          data: trackData
        });
      }

      if (prevState.altTrack !== state.altTrack) {
        encodeTrack(state.altTrack, altTrackData);
        altTrack({
          width: TRACK_SIZE,
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

      const [backFBO, frontFBO] = swapFbos;
      const [back, front] = swapFboTextures;

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
        amount: 0.4 + 0.5 * smoothstep(4.0, 20.0, state.speed),
        back,
        front: renderFBOTexture
      });

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
        console.log("⚠️ slow frame#" + e.tick + ": " + diff.toFixed(3) + "s");
      }
    });
  }

  render() {
    const { width, height } = this.props;
    const dpr = window.devicePixelRatio || 1;
    return (
      <canvas
        ref={this.onRef}
        width={dpr * width}
        height={dpr * height}
        style={{ width, height }}
        onMouseDown={this.onMouseDown}
        onMouseUp={this.onMouseUp}
        onMouseMove={this.onMouseMove}
        onMouseLeave={this.onMouseLeave}
      />
    );
  }
}

export default Game;
