//@flow
import React, { Component } from "react";
import createREGL from "regl";
import postShader from "./shaders/post";
import SimplexNoise from "simplex-noise";
import * as Debug from "../Debug";
import { DEV, TRACK_SIZE } from "./Constants";
import renderShader from "./shaders/render";

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

function genPerlinTextureData(n) {
  const simplex = new SimplexNoise();
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      data[4 * (n * y + x) + 0] = 255 * (0.5 + 0.5 * simplex.noise3D(x, y, 0));
      data[4 * (n * y + x) + 1] = 255 * (0.5 + 0.5 * simplex.noise3D(x, y, 1));
      data[4 * (n * y + x) + 2] = 255 * (0.5 + 0.5 * simplex.noise3D(x, y, 2));
      data[4 * (n * y + x) + 3] = 255 * (0.5 + 0.5 * simplex.noise3D(x, y, 3));
    }
  }
  return {
    data,
    width: n,
    height: n,
    mag: "linear",
    min: "linear"
  };
}

class Game extends Component {
  onRef = (canvas: *) => {
    this.canvas = canvas;
  };

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
      braking: keys[32],
      mouseDown,
      mouseAt
    };
  };

  _pos = e => {
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

  onKeyUp = e => {
    this.keys[e.which] = 0;
  };
  onKeyDown = e => {
    if (e.which === 32) e.preventDefault();
    this.keys[e.which] = 1;
  };
  componentDidMount() {
    const { canvas } = this;
    const { width, height, getGameState, action } = this.props;
    for (let k = 0; k < 500; k++) {
      this.keys[k] = 0;
    }
    document.body.addEventListener("keyup", this.onKeyUp);
    document.body.addEventListener("keydown", this.onKeyDown);
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const regl = createREGL(gl);
    const perlin = regl.texture(genPerlinTextureData(128));
    const track = regl.texture();
    const altTrack = regl.texture();

    const renderFBOTexture = regl.texture(64);
    const renderFBO = regl.framebuffer({
      color: renderFBOTexture
    });

    if (DEV) {
      Debug.defineEditable("high resolution", false, hi => {
        renderFBOTexture(hi ? 512 : 64);
        renderFBO({ color: renderFBOTexture });
      });
    }

    let render = renderShader(regl, renderFBO);
    if (module.hot) {
      module.hot.accept("./shaders/render", () => {
        try {
          render = require("./shaders/render").default(regl, renderFBO);
        } catch (e) {
          // FIXME could somehow log the error somewhere to see on UI
        }
      });
    }

    const post = postShader(regl);

    const initialState = getGameState();

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

      regl.clear({
        framebuffer: renderFBO,
        color: [0, 0, 0, 0],
        depth: 1
      });
      render({
        ...state,
        aspect: width / height,
        altTrack,
        track,
        perlin
      });
      post({
        t: renderFBOTexture
      });
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
