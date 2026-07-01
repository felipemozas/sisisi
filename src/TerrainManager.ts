import * as THREE from 'three';
import { TerrainChunk } from './TerrainChunk';
import { TerrainElevationService } from './TerrainElevationService';
import { PhysicsWorld } from './PhysicsWorld';

/**
 * Clase TerrainManager (Capa de Servicio)
 * Coordina la carga y descarga bajo demanda de porciones del terreno.
 * Evita leaks de memoria en la GPU descartando mallas visuales de Three.js y físicas de Cannon.js.
 */
export class TerrainManager {
  public chunks: Map<number, TerrainChunk>;
  private chunkSize: number;
  private elevationService: TerrainElevationService;
  private physicsWorld?: PhysicsWorld;

  constructor(
    scene: THREE.Scene,
    chunkSize: number,
    elevationService: TerrainElevationService,
    physicsWorld?: PhysicsWorld
  ) {
    this.chunks = new Map();
    this.chunkSize = chunkSize;
    this.elevationService = elevationService;
    this.physicsWorld = physicsWorld;
  }

  /**
   * Actualiza los chunks activos en base a la coordenada Z actual del vehículo/cámara.
   * Promueve una visibilidad óptima de al menos 3 chunks secuenciales.
   */
  public update(scene: THREE.Scene, currentZ: number): void {
    // Calculamos el índice del chunk central en el que estamos situados actualmente.
    // Como conducimos en la dirección -Z (Z disminuye), redondeamos con Math.floor.
    const currentChunkIndex = Math.floor(currentZ / this.chunkSize);

    // Definimos la ventana de chunks necesarios.
    // Necesitamos:
    // - 1 chunk inmediatamente atrás del plano actual (ndx + 1)
    // - El chunk actual donde se sitúa la cámara (ndx)
    // - Hasta 3 chunks de terreno futuro adelante (ndx - 1, ndx - 2, ndx - 3)
    //   La generación anticipada (hasta -3) asegura que las físicas e inercias de colisión
    //   estén listas en el mundo de Cannon antes de aproximarse visualmente.
    const requiredIndices = [
      currentChunkIndex + 1,
      currentChunkIndex,
      currentChunkIndex - 1,
      currentChunkIndex - 2,
      currentChunkIndex - 3,
    ];

    const requiredZs = new Set<number>();
    for (const index of requiredIndices) {
      requiredZs.add(index * this.chunkSize);
    }

    // 1. Spawneamos chunks requeridos que aún no han sido instanciados
    for (const z of requiredZs) {
      if (!this.chunks.has(z)) {
        const chunk = new TerrainChunk(
          scene,
          z,
          this.chunkSize,
          this.elevationService,
          this.physicsWorld
        );
        this.chunks.set(z, chunk);
      }
    }

    // 2. Limpiamos y eliminamos chunks antiguos que han quedado desfasados en el retrovisor
    for (const [z, chunk] of this.chunks.entries()) {
      if (!requiredZs.has(z)) {
        chunk.dispose(scene, this.physicsWorld);
        this.chunks.delete(z);
      }
    }
  }

  /**
   * Limpia toda la persistencia de terreno al reconstruir/reiniciar el motor
   */
  public clearAll(scene: THREE.Scene): void {
    for (const chunk of this.chunks.values()) {
      chunk.dispose(scene, this.physicsWorld);
    }
    this.chunks.clear();
  }
}
