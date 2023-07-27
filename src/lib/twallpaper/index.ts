import { curve, positions } from './constants';

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Position = {
  x: number;
  y: number;
};

type PatternOptions = {
  isMask?: boolean;
  imageUrl?: string;
  backgroundColor?: string;
  blur?: number;
  size?: number;
  opacity?: number;
};

type TWallpaperOptions = {
  colors: string[];
  fps?: number;
  tails?: number;
  pattern?: PatternOptions;
};

function isHexColor(hex: string): RegExpExecArray | null {
  if (hex.length === 4) {
    hex = `${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
}

export function hexToRgb(hex: string): Rgb | null {
  const result = isHexColor(hex);
  return result ? {
    r: parseInt(result[1]!, 16),
    g: parseInt(result[2]!, 16),
    b: parseInt(result[3]!, 16),
    // eslint-disable-next-line no-null/no-null
  } : null;
}

export class TWallpaper {
  private width = 50;

  private height = 50;

  private phase = 0;

  private tail = 0;

  private tails!: number; // 90

  private frametime!: number; // 1000 / 15

  private frames: ImageData[] = [];

  private rgb: Rgb[] = [];

  private curve = curve;

  private positions = positions;

  private phases = positions.length;

  private interval!: ReturnType<typeof setInterval> | null;

  private hc!: HTMLCanvasElement;

  private hctx!: CanvasRenderingContext2D;

  private canvas!: HTMLCanvasElement;

  private ctx!: CanvasRenderingContext2D;

  private pattern!: HTMLDivElement | null;

  private options!: TWallpaperOptions;

  constructor(private container: HTMLElement) {}

  private getPositions(shift: number): Position[] {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const positions = [...this.positions];
    while (shift > 0) {
      positions.push(positions.shift()!);
      shift--;
    }

    const result = [];
    for (let i = 0; i < positions.length; i += 2) {
      result.push(positions[i]);
    }

    return result;
  }

  private curPosition(phase: number, tail: number): Position[] {
    tail %= this.tails;
    const pos = this.getPositions(phase % this.phases);

    if (tail) {
      const nextPosition = this.getPositions(++phase % this.phases);
      const d1x = (nextPosition[0].x - pos[0].x) / this.tails;
      const d1y = (nextPosition[0].y - pos[0].y) / this.tails;
      const d2x = (nextPosition[1].x - pos[1].x) / this.tails;
      const d2y = (nextPosition[1].y - pos[1].y) / this.tails;
      const d3x = (nextPosition[2].x - pos[2].x) / this.tails;
      const d3y = (nextPosition[2].y - pos[2].y) / this.tails;
      const d4x = (nextPosition[3].x - pos[3].x) / this.tails;
      const d4y = (nextPosition[3].y - pos[3].y) / this.tails;

      return [
        {
          x: pos[0].x + d1x * tail,
          y: pos[0].y + d1y * tail,
        },
        {
          x: pos[1].x + d2x * tail,
          y: pos[1].y + d2y * tail,
        },
        {
          x: pos[2].x + d3x * tail,
          y: pos[2].y + d3y * tail,
        },
        {
          x: pos[3].x + d4x * tail,
          y: pos[3].y + d4y * tail,
        },
      ];
    }

    return pos;
  }

  private drawNextPositionAnimated(): void {
    if (this.frames.length > 0) {
      const id = this.frames.shift()!;
      this.drawImageData(id);
    } else if (this.interval) {
      clearInterval(this.interval);
      // eslint-disable-next-line no-null/no-null
      this.interval = null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  private getGradientImageData(positions: Position[]): ImageData {
    const id = this.hctx.createImageData(this.width, this.height);
    const pixels = id.data;
    let offset = 0;

    for (let y = 0; y < this.height; y++) {
      const directPixelY = y / this.height;
      const centerDistanceY = directPixelY - 0.5;
      const centerDistanceY2 = centerDistanceY * centerDistanceY;

      for (let x = 0; x < this.width; x++) {
        const directPixelX = x / this.width;

        const centerDistanceX = directPixelX - 0.5;
        const centerDistance = Math.sqrt(
          centerDistanceX * centerDistanceX + centerDistanceY2,
        );

        const swirlFactor = 0.35 * centerDistance;
        const theta = swirlFactor * swirlFactor * 0.8 * 8;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const pixelX = Math.max(
          0,
          Math.min(
            1,
            0.5 + centerDistanceX * cosTheta - centerDistanceY * sinTheta,
          ),
        );
        const pixelY = Math.max(
          0,
          Math.min(
            1,
            0.5 + centerDistanceX * sinTheta + centerDistanceY * cosTheta,
          ),
        );

        let distanceSum = 0;
        let r = 0;
        let g = 0;
        let b = 0;

        for (let i = 0; i < this.rgb.length; i++) {
          const colorX = positions[i].x;
          const colorY = positions[i].y;

          const distanceX = pixelX - colorX;
          const distanceY = pixelY - colorY;

          let distance = Math.max(
            0,
            0.9 - Math.sqrt(distanceX * distanceX + distanceY * distanceY),
          );
          // eslint-disable-next-line operator-assignment
          distance = distance * distance * distance * distance;
          distanceSum += distance;

          r += (distance * this.rgb[i].r) / 255;
          g += (distance * this.rgb[i].g) / 255;
          b += (distance * this.rgb[i].b) / 255;
        }

        pixels[offset++] = (r / distanceSum) * 255;
        pixels[offset++] = (g / distanceSum) * 255;
        pixels[offset++] = (b / distanceSum) * 255;
        pixels[offset++] = 0xff; // 255
      }
    }

    return id;
  }

  private drawImageData(id: ImageData): void {
    this.hctx.putImageData(id, 0, 0);
    this.ctx.drawImage(this.hc, 0, 0, this.width, this.height);
  }

  private drawGradient(): void {
    const position = this.curPosition(this.phase, this.tail);
    this.drawImageData(this.getGradientImageData(position));
  }

  init(options: TWallpaperOptions): void {
    this.options = options;

    if (!this.hc) {
      this.hc = document.createElement('canvas');
      this.hc.width = this.width;
      this.hc.height = this.height;
      this.hctx = this.hc.getContext('2d')!;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('wallpaper-canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d')!;
    this.container.appendChild(this.canvas);

    if (!this.container.classList.contains('wallpaper-wrap')) {
      this.container.classList.add('wallpaper-wrap');
    }

    if (this.options.pattern) {
      this.pattern = document.createElement('div');
      this.pattern.classList.add('wallpaper-pattern');
      this.updatePattern(this.options.pattern);
      this.container.appendChild(this.pattern);
    }

    this.updateTails(this.options.tails);
    this.updateFrametime(this.options.fps);
    this.updateColors(this.options.colors);
    this.drawGradient();
  }

  updateTails(tails = 90): void {
    if (tails > 0) {
      this.tails = tails;
    }
  }

  updateFrametime(fps = 30): void {
    this.frametime = 1000 / fps;
  }

  updatePattern(pattern: PatternOptions): void {
    if (!this.pattern) return;

    const {
      size = 1,
      opacity = 0.5,
      blur = 0,
      backgroundColor = '#000',
      imageUrl,
      isMask,
    } = { ...this.options.pattern, ...pattern };

    this.container.style.setProperty('--wallpaper-size', `${size}px`);
    this.container.style.setProperty('--wallpaper-opacity', `${opacity}`);
    this.container.style.setProperty('--wallpaper-blur', `${blur}px`);
    this.container.style.setProperty('--wallpaper-background', backgroundColor);

    if (imageUrl) {
      this.container.style.setProperty('--wallpaper-image', `url(${imageUrl})`);
    } else {
      this.container.style.removeProperty('--wallpaper-image');
    }

    if (isMask) {
      this.canvas.classList.add('wallpaper-mask');
    } else {
      this.canvas.classList.remove('wallpaper-mask');
    }
  }

  toNextPosition(): void {
    if (this.interval) return;

    this.frames = [];

    const previousPosition = this.getPositions(this.phase % this.phases);
    this.phase++;
    const pos = this.getPositions(this.phase % this.phases);

    const h = 27;
    const d1x = (pos[0].x - previousPosition[0].x) / h;
    const d1y = (pos[0].y - previousPosition[0].y) / h;
    const d2x = (pos[1].x - previousPosition[1].x) / h;
    const d2y = (pos[1].y - previousPosition[1].y) / h;
    const d3x = (pos[2].x - previousPosition[2].x) / h;
    const d3y = (pos[2].y - previousPosition[2].y) / h;
    const d4x = (pos[3].x - previousPosition[3].x) / h;
    const d4y = (pos[3].y - previousPosition[3].y) / h;

    for (let frame = 0; frame < this.curve.length; frame++) {
      const currentPosition: Position[] = [
        {
          x: previousPosition[0].x + d1x * this.curve[frame],
          y: previousPosition[0].y + d1y * this.curve[frame],
        },
        {
          x: previousPosition[1].x + d2x * this.curve[frame],
          y: previousPosition[1].y + d2y * this.curve[frame],
        },
        {
          x: previousPosition[2].x + d3x * this.curve[frame],
          y: previousPosition[2].y + d3y * this.curve[frame],
        },
        {
          x: previousPosition[3].x + d4x * this.curve[frame],
          y: previousPosition[3].y + d4y * this.curve[frame],
        },
      ];

      this.frames.push(this.getGradientImageData(currentPosition));
    }

    this.interval = setInterval(() => {
      this.drawNextPositionAnimated();
    }, this.frametime);
  }

  updateColors(hexCodes: string[]): void {
    const colors = hexCodes.reduce<Rgb[]>((rgbColors, color) => {
      const rgb = hexToRgb(color);

      if (rgb) {
        rgbColors.push(rgb);
      }

      return rgbColors;
    }, []).slice(0, 4);

    if (!colors.length) {
      throw new Error(
        'Colors do not exist or are not valid hex codes (e.g. #fff or #ffffff)',
      );
    }

    this.rgb = colors;
  }
}
