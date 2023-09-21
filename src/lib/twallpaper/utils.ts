export function loadShaders(
  gl: WebGLRenderingContext,
  shaderSources: [vertexShader: string, fragmentShader: string],
): readonly [WebGLShader, WebGLShader] {
  const [vertexShader, fragmentShader] = shaderSources;
  return [
    createShader(gl, vertexShader, gl.VERTEX_SHADER),
    createShader(gl, fragmentShader, gl.FRAGMENT_SHADER),
  ] as const;
}

function createShader(
  gl: WebGLRenderingContext,
  shaderSource: string,
  shaderType: number,
): WebGLShader {
  const shader = gl.createShader(shaderType)!;
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  return shader;
}

export type Vec3 = [r: number, g: number, b: number];

export function hexToVec3(hex: string): Vec3 {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return [r, g, b];
}

export function distance(p1: number[], p2: number[]): number {
  return Math.sqrt((p1[1] - p2[1]) * (p1[1] - p2[1]));
}
