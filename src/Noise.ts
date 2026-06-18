/**
 * Clase Noise
 * Generador modular y determinista de ruido Perlin 2D clásico.
 * Diseñado con bajo acoplamiento para facilitar inyección en cualquier motor 3D.
 */
export class Noise {
  private permutation: number[];
  private p: number[];

  constructor(seed: number = 1) {
    this.permutation = Array.from({ length: 256 }, (_, i) => i);
    
    // Seeded pseudo-random shuffle (determinista)
    let randomVal = seed;
    const random = () => {
      const x = Math.sin(randomVal++) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = this.permutation[i];
      this.permutation[i] = this.permutation[j];
      this.permutation[j] = temp;
    }

    // Doblar la permutación para evitar desbordamiento de índices
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.p[i] = this.permutation[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  /**
   * Generación de ruido Perlin en un plano 2D continuo.
   * Retorna un valor en el rango [-1.0, 1.0]
   */
  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }
}
