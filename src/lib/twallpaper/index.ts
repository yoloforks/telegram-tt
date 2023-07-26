import { loadShaders } from './load-shaders';
import { hexToVec3 } from './hex-to-vec3';
import { distance } from './distance';
import animals from '../../assets/patterns/animals.svg';

const vertexShader = `
// an attribute will receive data from a buffer
attribute vec4 a_position;

// all shaders have a main function
void main() {

  // gl_Position is a special variable a vertex shader
  // is responsible for setting
  gl_Position = a_position;
}
`;

const fragmentShader = `
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
  float p = 4.0;

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

const config = {
  speed: 0.1,
  mask: true,
  colors: {
    color1: '#dbddbb',
    color2: '#6ba587',
    color3: '#d5d88d',
    color4: '#88b884',
  },
};

const colors = {
  color1: hexToVec3(config.colors.color1),
  color2: hexToVec3(config.colors.color2),
  color3: hexToVec3(config.colors.color3),
  color4: hexToVec3(config.colors.color4),
};

export function twallpaper(
  gradientCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
) {
  const canvas2d = maskCanvas.getContext('2d')!;
  if (!canvas2d) {
    throw new Error('Canvas2D not supported');
  }

  const gl = gradientCanvas.getContext('webgl')!;
  if (!gl) {
    throw new Error('WebGL not supported');
  }

  // setup GLSL program
  const program = gl.createProgram()!;
  if (!program) {
    throw new Error('Unable to create WebGLProgram');
  }

  // load mask texture
  let imageBitmap: ImageBitmap | undefined;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = animals;
  img.addEventListener('load', () => {
    createImageBitmap(img, {
      resizeWidth: 1440,
      resizeHeight: 2960,
    }).then((bitmap) => {
      imageBitmap = bitmap;
      renderMaskCanvas();
    });
  });

  img.addEventListener('error', () => {
    // eslint-disable-next-line no-alert
    alert('Unable to load image');
  });

  function renderMaskCanvas() {
    if (!imageBitmap) return;

    const { width, height } = maskCanvas;
    canvas2d.clearRect(0, 0, width, height);

    let imageWidth = imageBitmap.width;
    let imageHeight = imageBitmap.height;
    const patternHeight = (500 + window.visualViewport!.height / 2.5) * devicePixelRatio;
    const ratio = patternHeight / imageHeight;
    imageWidth *= ratio;
    imageHeight = patternHeight;

    if (config.mask) {
      canvas2d.fillStyle = '#000';
      canvas2d.fillRect(0, 0, width, height);
      canvas2d.globalCompositeOperation = 'destination-out';
    } else {
      canvas2d.globalCompositeOperation = 'source-over';
    }

    const draq = (y: number) => {
      for (let x = 0; x < width; x += imageWidth) {
        canvas2d.drawImage(imageBitmap!, x, y, imageWidth, imageHeight);
      }
    };

    const centerY = (height - imageHeight) / 2;
    draq(centerY);

    if (centerY > 0) {
      let topY = centerY;
      do {
        draq((topY -= imageHeight));
      } while (topY >= 0);
    }

    const endY = height - 1;
    for (
      let bottomY = centerY + imageHeight;
      bottomY < endY;
      bottomY += imageHeight
    ) {
      draq(bottomY);
    }
  }

  // load shaders
  const shaders = loadShaders(gl, [vertexShader, fragmentShader]);
  for (const shader of shaders) {
    gl.attachShader(program, shader);
  }

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-alert
    alert('Unable to initialize the shader program.');
  }

  gl.useProgram(program);

  // look up where the vertex data needs to go.
  const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');

  // Create a buffer to put three 2d clip space points in
  const positionBuffer = gl.createBuffer();

  // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // fill it with a 2 triangles that cover clipspace
  gl.bufferData(
    gl.ARRAY_BUFFER,
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
    gl.STATIC_DRAW,
  );

  // Tell WebGL how to convert from clip space to pixels
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  // Tell it to use our program (pair of shaders)
  gl.useProgram(program);

  // Turn on the attribute
  gl.enableVertexAttribArray(positionAttributeLocation);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  gl.vertexAttribPointer(
    positionAttributeLocation,
    2, // 2 components per iteration
    gl.FLOAT, // the data is 32bit floats
    false, // don't normalize the data
    0, // 0 = move forward size * sizeof(type) each iteration to get the next position
    0, // start at the beginning of the buffer
  );

  const resolutionLoc = gl.getUniformLocation(program, 'resolution');
  const color1Loc = gl.getUniformLocation(program, 'color1');
  const color2Loc = gl.getUniformLocation(program, 'color2');
  const color3Loc = gl.getUniformLocation(program, 'color3');
  const color4Loc = gl.getUniformLocation(program, 'color4');
  const color1PosLoc = gl.getUniformLocation(program, 'color1Pos');
  const color2PosLoc = gl.getUniformLocation(program, 'color2Pos');
  const color3PosLoc = gl.getUniformLocation(program, 'color3Pos');
  const color4PosLoc = gl.getUniformLocation(program, 'color4Pos');

  const keyPoints = [
    [0.265, 0.582], // 0
    [0.176, 0.918], // 1
    [1 - 0.585, 1 - 0.164], // 0
    [0.644, 0.755], // 1
    [1 - 0.265, 1 - 0.582], // 0
    [1 - 0.176, 1 - 0.918], // 1
    [0.585, 0.164], // 0
    [1 - 0.644, 1 - 0.755], // 1
  ];
  let keyShift = 0;
  let targetColor1Pos: number[];
  let targetColor2Pos: number[];
  let targetColor3Pos: number[];
  let targetColor4Pos: number[];

  updateTargetColors();

  function updateTargetColors() {
    targetColor1Pos = keyPoints[keyShift % 8];
    targetColor2Pos = keyPoints[(keyShift + 2) % 8];
    targetColor3Pos = keyPoints[(keyShift + 4) % 8];
    targetColor4Pos = keyPoints[(keyShift + 6) % 8];
    keyShift = (keyShift + 1) % 8;
  }

  const color1Pos = [targetColor1Pos![0], targetColor1Pos![1]];
  const color2Pos = [targetColor2Pos![0], targetColor2Pos![1]];
  const color3Pos = [targetColor3Pos![0], targetColor3Pos![1]];
  const color4Pos = [targetColor4Pos![0], targetColor4Pos![1]];

  renderGradientCanvas();

  function renderGradientCanvas() {
    gl.uniform2fv(resolutionLoc, [gl.canvas.width, gl.canvas.height]);
    gl.uniform3fv(color1Loc, colors.color1);
    gl.uniform3fv(color2Loc, colors.color2);
    gl.uniform3fv(color3Loc, colors.color3);
    gl.uniform3fv(color4Loc, colors.color4);
    gl.uniform2fv(color1PosLoc, color1Pos);
    gl.uniform2fv(color2PosLoc, color2Pos);
    gl.uniform2fv(color3PosLoc, color3Pos);
    gl.uniform2fv(color4PosLoc, color4Pos);

    gl.drawArrays(
      gl.TRIANGLES,
      0, // offset
      6, // num vertices to process
    );
  }

  const speed = 0.1;
  let animating = false;
  function animate() {
    animating = true;
    if (
      distance(color1Pos, targetColor1Pos) > 0.01
    || distance(color2Pos, targetColor2Pos) > 0.01
    || distance(color3Pos, targetColor3Pos) > 0.01
    || distance(color3Pos, targetColor3Pos) > 0.01
    ) {
      color1Pos[0] = color1Pos[0] * (1 - speed) + targetColor1Pos[0] * speed;
      color1Pos[1] = color1Pos[1] * (1 - speed) + targetColor1Pos[1] * speed;
      color2Pos[0] = color2Pos[0] * (1 - speed) + targetColor2Pos[0] * speed;
      color2Pos[1] = color2Pos[1] * (1 - speed) + targetColor2Pos[1] * speed;
      color3Pos[0] = color3Pos[0] * (1 - speed) + targetColor3Pos[0] * speed;
      color3Pos[1] = color3Pos[1] * (1 - speed) + targetColor3Pos[1] * speed;
      color4Pos[0] = color4Pos[0] * (1 - speed) + targetColor4Pos[0] * speed;
      color4Pos[1] = color4Pos[1] * (1 - speed) + targetColor4Pos[1] * speed;
      renderGradientCanvas();
      requestAnimationFrame(animate);
    } else {
      animating = false;
    }
  }

  // TODO: remove this
  // @ts-ignore
  window.sendMessage = () => {
    updateTargetColors();
    if (!animating) requestAnimationFrame(animate);
  };

  function toggleMask(theme: string) {
    config.mask = theme === 'dark';
    renderMaskCanvas();
  }

  return {
    toggleMask,
    renderMaskCanvas,
    renderGradientCanvas,
  };
}
