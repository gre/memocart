//@flow
import GLSL from "./GLSL";

export default (regl: *) =>
  regl({
    frag: GLSL`
precision highp float;
varying vec2 uv;
uniform sampler2D t;
void main() {
  gl_FragColor = texture2D(t, uv);
}
`,

    vert: GLSL`
precision mediump float;
attribute vec2 position;
varying vec2 uv;
void main() {
  gl_Position = vec4(position, 0, 1);
  uv = (position + 1.0) / 2.0;
}`,

    attributes: {
      position: regl.buffer([[-1, -1], [-1, 4], [4, -1]])
    },

    uniforms: {
      t: regl.prop("t")
    },

    count: 3
  });
