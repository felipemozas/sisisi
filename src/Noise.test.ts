import { describe, it, expect } from 'vitest';
import { Noise } from './Noise';

describe('Noise Service (OOP)', () => {
  it('debe producir valores deterministas de ruido basados en el seed', () => {
    const generator = new Noise(42);
    const val1 = generator.noise2D(10.5, 20.3);
    const val2 = generator.noise2D(10.5, 20.3);
    expect(val1).toBe(val2);
    expect(val1).toBeGreaterThanOrEqual(-1);
    expect(val1).toBeLessThanOrEqual(1);
  });

  it('debe producir valores diferentes para coordenadas diferentes', () => {
    const generator = new Noise();
    const val1 = generator.noise2D(1.5, 1.5);
    const val2 = generator.noise2D(50.8, 50.8);
    expect(val1).not.toBe(val2);
  });
});
