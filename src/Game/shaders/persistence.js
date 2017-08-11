//@flow
import GLSL from "./GLSL";

export default (regl: *) =>
  regl({
    frag: GLSL`
precision highp float;
varying vec2 p;
uniform sampler2D back, front;
uniform float amount;
void main() {
  gl_FragColor = mix(
    texture2D(front, p),
    texture2D(back, p) * 1.06, // light goes lighter creates kinda cool effect
    amount
  );
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
      back: regl.prop("back"),
      front: regl.prop("front"),
      amount: regl.prop("amount")
    },
    framebuffer: regl.prop("framebuffer"),

    count: 3
  });
