import { describe, it, expect } from 'vitest';
import { TerrainElevationService } from './TerrainElevationService';
import { Noise } from './Noise';

describe('TerrainElevationService Suite', () => {
  const noise = new Noise(42);
  const elevationService = new TerrainElevationService(noise);

  it('debe devolver 0 metros en el centro exacto de la carretera serpenteante (X = roadCenter)', () => {
    const rc1 = elevationService.getRoadCenter(50);
    const rc2 = elevationService.getRoadCenter(-100);

    const h1 = elevationService.getElevation(rc1, 50);
    const h2 = elevationService.getElevation(rc2, -100);
    expect(h1).toBe(0);
    expect(h2).toBe(0);
  });

  it('debe generar elevación ondulada en los laterales lejanos de la carretera (X >> roadCenter)', () => {
    const rc = elevationService.getRoadCenter(-100);
    const hFarRight = elevationService.getElevation(rc + 60, -100);
    expect(Math.abs(hFarRight)).toBeGreaterThan(0);
  });

  it('debe realizar la transición suave de alturas (roadFactor)', () => {
    const rc = elevationService.getRoadCenter(-50);
    const hRoad = elevationService.getElevation(rc + 5, -50);
    const hTransition = elevationService.getElevation(rc + 20, -50);
    const hMountain = elevationService.getElevation(rc + 100, -50);

    // hRoad debe ser perfectamente plano (0) dentro del ancho de carretera
    expect(hRoad).toBe(0);
    // hTransition debe graduar la elevación suavemente
    expect(Math.abs(hTransition)).toBeLessThanOrEqual(Math.abs(hMountain));
  });
});
