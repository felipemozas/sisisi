import { Noise } from './Noise';

/**
 * Servicio de Elevación de Terreno
 * Encapsula la lógica matemática para determinar la altura del terreno del juego en cualquier coordenada.
 * Facilita el desacoplamiento de la malla visual de Three.js y el motor de físicas del auto.
 */
export class TerrainElevationService {
  private noise: Noise;

  constructor(noise: Noise) {
    this.noise = noise;
  }

  /**
   * Retorna la coordenada X del centro de la carretera para un Z dado.
   * Crea un serpenteo o espiral suave y relajante para la conducción.
   */
  public getRoadCenter(worldZ: number): number {
    return Math.sin(worldZ * 0.007) * 22.0 + Math.cos(worldZ * 0.002) * 12.0;
  }

  /**
   * Retorna la altura (Y) correspondiente para las coordenadas globales (worldX, worldZ)
   */
  public getElevation(worldX: number, worldZ: number): number {
    // Ondulación del terreno (montañas suaves)
    let height = this.noise.noise2D(worldX * 0.012, worldZ * 0.012) * 5.0;
    height += this.noise.noise2D(worldX * 0.04, worldZ * 0.04) * 1.5;

    // Preservamos una carretera plana alrededor de la trayectoria spline del camino
    const roadCenterX = this.getRoadCenter(worldZ);
    const distanceFromRoad = Math.abs(worldX - roadCenterX);
    
    const roadWidth = 14;
    const transitionWidth = 12;

    let roadFactor = 1.0;
    if (distanceFromRoad < roadWidth) {
      roadFactor = 0.0;
    } else if (distanceFromRoad < roadWidth + transitionWidth) {
      roadFactor = (distanceFromRoad - roadWidth) / transitionWidth;
    }

    const result = height * roadFactor;
    return result === 0 ? 0 : result;
  }
}
