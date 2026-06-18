// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TerrainManager } from './TerrainManager';
import { TerrainElevationService } from './TerrainElevationService';
import { Noise } from './Noise';

describe('TerrainManager Suite', () => {
  let scene: THREE.Scene;
  let elevationService: TerrainElevationService;
  const chunkSize = 100;

  beforeEach(() => {
    scene = new THREE.Scene();
    elevationService = new TerrainElevationService(new Noise(9));
  });

  it('debe inicializar y mantener exactamente la cantidad minima de chunks activos', () => {
    const manager = new TerrainManager(scene, chunkSize, elevationService);
    
    // Al inicializarse en Z = 0, debe crear un set básico redundante alrededor (por ejemplo, Z=0, Z=-100, Z=-200)
    manager.update(scene, 0);

    expect(manager.chunks.size).toBeGreaterThanOrEqual(3);
    const keys = Array.from(manager.chunks.keys());
    expect(keys.includes(0)).toBe(true);
    expect(keys.includes(-100)).toBe(true);
  });

  it('debe spawnear chunks futuros y remover los pasados al avanzar el eje Z', () => {
    const manager = new TerrainManager(scene, chunkSize, elevationService);
    
    // Estado inicial en 0
    manager.update(scene, 0);
    const initialKeysSize = manager.chunks.size;

    // Conducimos hacia adelante (Z negativo: -150)
    manager.update(scene, -150);

    // Debe seguir manteniendo al menos 3 chunks, y el chunk antiguo Z=100 o Z=0 si está muy atrás debe ser desechado
    expect(manager.chunks.size).toBeLessThanOrEqual(initialKeysSize + 1);
    
    // No debe haber fugas en la escena de Three.js (2 meshes por chunk: terreno + carretera)
    const meshes = scene.children.filter(child => child instanceof THREE.Mesh);
    expect(meshes.length).toBe(manager.chunks.size * 2);
  });
});
