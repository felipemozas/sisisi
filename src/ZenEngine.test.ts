// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ZenEngine } from './ZenEngine';

// Mock WebGLRenderer to avoid headless WebGL context issues
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  
  class MockWebGLRenderer {
    public domElement = document.createElement('canvas');
    public setSize() {}
    public setPixelRatio() {}
    public render() {}
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe('ZenEngine', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('should initialize a ZenEngine instance successfully', () => {
    const engine = new ZenEngine(container);
    expect(engine).toBeDefined();
    expect(engine.scene).toBeInstanceOf(THREE.Scene);
    expect(engine.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    // Verificamos que el motor de físicas de Cannon se asocia correctamente
    expect(engine.physicsWorld).toBeDefined();

    engine.destroy(container);
  });

  it('should create ambient and directional lights', () => {
    const engine = new ZenEngine(container);
    
    // Check if the scene contains lights
    const lights = engine.scene.children.filter(
      (child) => child instanceof THREE.Light
    );
    expect(lights.length).toBeGreaterThanOrEqual(2);

    engine.destroy(container);
  });

  it('should handle dynamic browser resizing', () => {
    const engine = new ZenEngine(container);
    engine.handleResize(800, 600);
    
    expect(engine.camera.aspect).toBe(800 / 600);

    engine.destroy(container);
  });
});
