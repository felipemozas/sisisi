import { describe, it, expect } from 'vitest';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld';

describe('PhysicsWorld (OOP Service) Suite', () => {
  it('debe construir un CANNON.World con gravedad realista y materiales por defecto', () => {
    const physics = new PhysicsWorld();
    
    expect(physics.world).toBeInstanceOf(CANNON.World);
    expect(physics.world.gravity.y).toBeCloseTo(-9.82, 2);
    expect(physics.groundMaterial).toBeInstanceOf(CANNON.Material);
    expect(physics.wheelMaterial).toBeInstanceOf(CANNON.Material);
  });

  it('debe registrar y liberar cuerpos de colision', () => {
    const physics = new PhysicsWorld();
    const body = new CANNON.Body({ mass: 1 });
    
    physics.addBody(body);
    expect(physics.world.bodies.includes(body)).toBe(true);

    physics.removeBody(body);
    expect(physics.world.bodies.includes(body)).toBe(false);
  });

  it('debe realizar la simulacion temporal (step) de forma estable', () => {
    const physics = new PhysicsWorld();
    const body = new CANNON.Body({ mass: 1 });
    body.position.set(0, 10, 0);
    physics.addBody(body);

    // Damos un paso de fisica
    physics.step(1 / 60);

    // El cuerpo debe caer por la gravedad
    expect(body.position.y).toBeLessThan(10);
  });
});
