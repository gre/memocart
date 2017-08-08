//@flow
import GLSL from "./GLSL";

export default (regl: *) =>
  regl({
    frag: GLSL`
precision highp float;
varying vec2 p;
uniform sampler2D ui, game;
uniform float level;

float levelMult = level==-1.0 ? 0.7 : 1.0;
void main() {
  vec2 uv = (floor(64.*p)+0.5)/64.;
  vec4 uiC = texture2D(ui, uv);
  vec4 gameC = texture2D(game, uv);
  vec3 c = uiC.rgb;
  gl_FragColor = vec4(mix(levelMult * gameC.rgb, c, uiC.a), 1.0);
}
`,

    vert: GLSL`
precision mediump float;
attribute vec2 position;
varying vec2 p;
void main() {
  gl_Position = vec4(position, 0, 1);
  p = (position + 1.0) / 2.0;
}`,

    attributes: {
      position: regl.buffer([[-1, -1], [-1, 4], [4, -1]])
    },

    uniforms: {
      ui: regl.prop("ui"),
      game: regl.prop("game"),
      level: regl.prop("level")
    },

    count: 3
  });
