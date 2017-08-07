//@flow
export default function GLSL(strings: Array<string>, ...values: Array<string>) {
  let code = "";
  for (let i = 0; i < strings.length; i++) {
    code += (i === 0 ? "" : values[i - 1]) + strings[i];
  }
  return code;
}
