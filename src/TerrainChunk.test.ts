// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { TerrainChunk } from './TerrainChunk';
import { TerrainElevationService } from './TerrainElevationService';
import { Noise } from './Noise';
import { PhysicsWorld } from './PhysicsWorld';

describe('TerrainChunk Suite', () => {
  let scene: THREE.Scene;
  let elevationService: TerrainElevationService;

  beforeEach(() => {
    scene = new THREE.Scene();
    elevationService = new TerrainElevationService(new Noise(12345));
  });

  it('debe estructurar la geometría con ondulaciones de ruido y agregarse a la escena', () => {
    const chunk = new TerrainChunk(scene, 0, 100, elevationService);

    expect(chunk.mesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children.includes(chunk.mesh)).toBe(true);
    expect(chunk.chunkZ).toBe(0);
  });

  it('debe crear un roadMesh de asfalto representativo y agregarlo a la escena', () => {
    const chunk = new TerrainChunk(scene, 0, 100, elevationService);

    expect(chunk.roadMesh).toBeInstanceOf(THREE.Mesh);
    expect(scene.children.includes(chunk.roadMesh!)).toBe(true);
  });

  it('debe estructurar un colisionador estatico de Cannon si se pasa PhysicsWorld', () => {
    const physics = new PhysicsWorld();
    const chunk = new TerrainChunk(scene, 0, 100, elevationService, physics);

    expect(chunk.collisionBody).toBeDefined();
    expect(chunk.collisionBody?.mass).toBe(0); // Estático
    expect(physics.world.bodies.includes(chunk.collisionBody!)).toBe(true);

    chunk.dispose(scene, physics);
    expect(physics.world.bodies.includes(chunk.collisionBody!)).toBe(false);
  });

  it('debe liberar correctamente la memoria de ambos meshes con dispose()', () => {
    const chunk = new TerrainChunk(scene, -100, 100, elevationService);
    
    // Debe haber al menos el terreno y el asfalto + pinos decorativos
    expect(scene.children.length).toBeGreaterThanOrEqual(2);

    chunk.dispose(scene);

    // Todos los elementos creados deben removerse de la escena principal
    expect(scene.children.length).toBe(0);
    expect(chunk.roadMesh).toBeNull();
  });
});
