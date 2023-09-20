import type { Vec3 } from './utils';

import { distance, hexToVec3, loadShaders } from './utils';

const FRAGMENT_SHADER = `
precision highp float;

uniform vec2 resolution;

uniform vec3 color1;
uniform vec3 color2;
uniform vec3 color3;
uniform vec3 color4;

uniform vec2 color1Pos;
uniform vec2 color2Pos;
uniform vec2 color3Pos;
uniform vec2 color4Pos;

void main() {
  vec2 position = gl_FragCoord.xy / resolution.xy;
  position.y = 1.0 - position.y;

  float dp1 = distance(position, color1Pos);
  float dp2 = distance(position, color2Pos);
  float dp3 = distance(position, color3Pos);
  float dp4 = distance(position, color4Pos);
  float minD = min(dp1, min(dp2, min(dp3, dp4)));
  float p = 3.0;

  dp1 = pow(1.0 - (dp1 - minD), p);
  dp2 = pow(1.0 - (dp2 - minD), p);
  dp3 = pow(1.0 - (dp3 - minD), p);
  dp4 = pow(1.0 - (dp4 - minD), p);
  float dpt = abs(dp1 + dp2 + dp3 + dp4);

  gl_FragColor =
    (vec4(color1 / 255.0, 1.0) * dp1 / dpt) +
    (vec4(color2 / 255.0, 1.0) * dp2 / dpt) +
    (vec4(color3 / 255.0, 1.0) * dp3 / dpt) +
    (vec4(color4 / 255.0, 1.0) * dp4 / dpt);
}
`;

const VERTEX_SHADER = `
// an attribute will receive data from a buffer
attribute vec4 a_position;

// all shaders have a main function
void main() {

  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  gl_Position = a_position;
}
`;

const KEY_POINTS = [
  [0.265, 0.582], // 0
  [0.176, 0.918], // 1
  [1 - 0.585, 1 - 0.164], // 0
  [0.644, 0.755], // 1
  [1 - 0.265, 1 - 0.582], // 0
  [1 - 0.176, 1 - 0.918], // 1
  [0.585, 0.164], // 0
  [1 - 0.644, 1 - 0.755], // 1
];

export interface TwallpaperOptions {
  colors: string[];
  mask: {
    enabled: boolean;
    image: string;
    color: string;
  };
}

export class Twallpaper {
  private gradientContainer!: HTMLCanvasElement;

  private maskContainer!: HTMLDivElement;

  private options!: Omit<TwallpaperOptions, 'colors'> & { colors: Vec3[] };

  private glslProgram!: WebGLProgram;

  private gl!: WebGLRenderingContext;

  private resolutionLoc!: WebGLUniformLocation;

  private color1Loc!: WebGLUniformLocation;

  private color2Loc!: WebGLUniformLocation;

  private color3Loc!: WebGLUniformLocation;

  private color4Loc!: WebGLUniformLocation;

  private color1PosLoc!: WebGLUniformLocation;

  private color2PosLoc!: WebGLUniformLocation;

  private color3PosLoc!: WebGLUniformLocation;

  private color4PosLoc!: WebGLUniformLocation;

  private keyShift = 0;

  private targetColor1Pos!: number[];

  private targetColor2Pos!: number[];

  private targetColor3Pos!: number[];

  private targetColor4Pos!: number[];

  private color1Pos!: number[];

  private color2Pos!: number[];

  private color3Pos!: number[];

  private color4Pos!: number[];

  private speed = 0.1;

  private animating = false;

  constructor(private readonly container: HTMLElement) {
    this.animate = this.animate.bind(this);
  }

  setOptions(options: TwallpaperOptions): void {
    this.options = {
      ...options,
      colors: options.colors.map(hexToVec3),
    };
  }

  init(options: TwallpaperOptions): void {
    this.setOptions(options);
    this.gradientContainer = document.createElement('canvas');
    this.gradientContainer.classList.add('wallpaper-canvas');

    this.maskContainer = document.createElement('div');
    this.maskContainer.classList.add('wallpaper-pattern');

    this.container.classList.add('wallpaper-wrap');
    this.container.append(this.gradientContainer, this.maskContainer);

    this.updateMask();

    this.gl = this.gradientContainer.getContext('webgl')!;
    if (!this.gl) {
      throw new Error('WebGL not supported');
    }

    this.glslProgram = this.gl.createProgram()!;
    if (!this.glslProgram) {
      throw new Error('Unable to create WebGLProgram');
    }

    const shaders = loadShaders(this.gl, [VERTEX_SHADER, FRAGMENT_SHADER]);
    for (const shader of shaders) {
      this.gl.attachShader(this.glslProgram, shader);
    }

    this.gl.linkProgram(this.glslProgram);

    if (!this.gl.getProgramParameter(this.glslProgram, this.gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program.');
    }

    this.gl.useProgram(this.glslProgram);

    // look up where the vertex data needs to go.
    const positionAttributeLocation = this.gl.getAttribLocation(
      this.glslProgram,
      'a_position',
    );

    // Create a buffer to put three 2d clip space points in
    const positionBuffer = this.gl.createBuffer();

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

    // fill it with a 2 triangles that cover clipspace
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        -1,
        -1, // first triangle
        1,
        -1,
        -1,
        1,
        -1,
        1, // second triangle
        1,
        -1,
        1,
        1,
      ]),
      this.gl.STATIC_DRAW,
    );

    // Tell WebGL how to convert from clip space to pixels
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Tell it to use our program (pair of shaders)
    this.gl.useProgram(this.glslProgram);

    // Turn on the attribute
    this.gl.enableVertexAttribArray(positionAttributeLocation);

    // Bind the position buffer.
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    this.gl.vertexAttribPointer(
      positionAttributeLocation,
      2, // 2 components per iteration
      this.gl.FLOAT, // the data is 32bit floats
      false, // don't normalize the data
      0, // 0 = move forward size * sizeof(type) each iteration to get the next position
      0, // start at the beginning of the buffer
    );

    this.resolutionLoc = this.gl.getUniformLocation(
      this.glslProgram,
      'resolution',
    )!;
    this.color1Loc = this.gl.getUniformLocation(this.glslProgram, 'color1')!;
    this.color2Loc = this.gl.getUniformLocation(this.glslProgram, 'color2')!;
    this.color3Loc = this.gl.getUniformLocation(this.glslProgram, 'color3')!;
    this.color4Loc = this.gl.getUniformLocation(this.glslProgram, 'color4')!;
    this.color1PosLoc = this.gl.getUniformLocation(
      this.glslProgram,
      'color1Pos',
    )!;
    this.color2PosLoc = this.gl.getUniformLocation(
      this.glslProgram,
      'color2Pos',
    )!;
    this.color3PosLoc = this.gl.getUniformLocation(
      this.glslProgram,
      'color3Pos',
    )!;
    this.color4PosLoc = this.gl.getUniformLocation(
      this.glslProgram,
      'color4Pos',
    )!;

    this.updateColors();

    this.color1Pos = [this.targetColor1Pos![0], this.targetColor1Pos![1]]!;
    this.color2Pos = [this.targetColor2Pos![0], this.targetColor2Pos![1]]!;
    this.color3Pos = [this.targetColor3Pos![0], this.targetColor3Pos![1]]!;
    this.color4Pos = [this.targetColor4Pos![0], this.targetColor4Pos![1]]!;

    this.renderGradient();
  }

  updateMask(): void {
    this.container.style.setProperty('--wallpaper-size', '420px');
    this.container.style.setProperty(
      '--wallpaper-background',
      this.options.mask.color,
    );

    this.container.style.setProperty(
      '--wallpaper-image',
      `url(${window.location.origin}/patterns/${this.options.mask.image}.svg)`,
    );

    if (this.options.mask.enabled) {
      this.container.style.setProperty('--wallpaper-opacity', '0.3');
      this.gradientContainer.classList.add('wallpaper-mask');
    } else {
      this.container.style.setProperty('--wallpaper-opacity', '0.5');
      this.gradientContainer.classList.remove('wallpaper-mask');
    }
  }

  updateColors() {
    this.targetColor1Pos = KEY_POINTS[this.keyShift % 8];
    this.targetColor2Pos = KEY_POINTS[(this.keyShift + 2) % 8];
    this.targetColor3Pos = KEY_POINTS[(this.keyShift + 4) % 8];
    this.targetColor4Pos = KEY_POINTS[(this.keyShift + 6) % 8];
    this.keyShift = (this.keyShift + 1) % 8;
  }

  renderGradient() {
    this.gl.uniform2fv(this.resolutionLoc, [
      this.gl.canvas.width,
      this.gl.canvas.height,
    ]);
    this.gl.uniform3fv(this.color1Loc, this.options.colors[0]);
    this.gl.uniform3fv(this.color2Loc, this.options.colors[1]);
    this.gl.uniform3fv(this.color3Loc, this.options.colors[2]);
    this.gl.uniform3fv(this.color4Loc, this.options.colors[3]);
    this.gl.uniform2fv(this.color1PosLoc, this.color1Pos);
    this.gl.uniform2fv(this.color2PosLoc, this.color2Pos);
    this.gl.uniform2fv(this.color3PosLoc, this.color3Pos);
    this.gl.uniform2fv(this.color4PosLoc, this.color4Pos);

    this.gl.drawArrays(
      this.gl.TRIANGLES,
      0, // offset
      6, // num vertices to process
    );
  }

  animate(): void {
    this.animating = true;

    if (
      distance(this.color1Pos, this.targetColor1Pos) > 0.01
      || distance(this.color2Pos, this.targetColor2Pos) > 0.01
      || distance(this.color3Pos, this.targetColor3Pos) > 0.01
      || distance(this.color3Pos, this.targetColor3Pos) > 0.01
    ) {
      this.color1Pos[0] = this.color1Pos[0] * (1 - this.speed) + this.targetColor1Pos[0] * this.speed;
      this.color1Pos[1] = this.color1Pos[1] * (1 - this.speed) + this.targetColor1Pos[1] * this.speed;
      this.color2Pos[0] = this.color2Pos[0] * (1 - this.speed) + this.targetColor2Pos[0] * this.speed;
      this.color2Pos[1] = this.color2Pos[1] * (1 - this.speed) + this.targetColor2Pos[1] * this.speed;
      this.color3Pos[0] = this.color3Pos[0] * (1 - this.speed) + this.targetColor3Pos[0] * this.speed;
      this.color3Pos[1] = this.color3Pos[1] * (1 - this.speed) + this.targetColor3Pos[1] * this.speed;
      this.color4Pos[0] = this.color4Pos[0] * (1 - this.speed) + this.targetColor4Pos[0] * this.speed;
      this.color4Pos[1] = this.color4Pos[1] * (1 - this.speed) + this.targetColor4Pos[1] * this.speed;
      this.renderGradient();
      requestAnimationFrame(this.animate);
    } else {
      this.animating = false;
    }
  }
}
