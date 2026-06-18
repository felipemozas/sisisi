// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { Vehicle } from './Vehicle';
import { PhysicsWorld } from './PhysicsWorld';

describe('RaycastVehicle Physical Suite', () => {
  let scene: THREE.Scene;
  let physics: PhysicsWorld;

  beforeEach(() => {
    scene = new THREE.Scene();
    physics = new PhysicsWorld();
  });

  it('debe inicializar el cuerpo del chasis en Cannon con una masa realista', () => {
    const vehicle = new Vehicle(scene, physics);

    expect(vehicle.chassisBody).toBeDefined();
    // Chasis de masa recomendada entre 1000 - 1500kg
    expect(vehicle.chassisBody.mass).toBe(1500);
    expect(physics.world.bodies.includes(vehicle.chassisBody)).toBe(true);
  });

  it('debe poseer exactamente 4 ruedas físicas en RaycastVehicle', () => {
    const vehicle = new Vehicle(scene, physics);
    
    // RaycastVehicle tiene wheelInfos para cada rueda agregada
    expect(vehicle.raycastVehicle.wheelInfos.length).toBe(4);
    expect(vehicle.wheelMeshes.length).toBe(4);
  });

  it('debe calibrar valores de direccion alternadamente en base a inputs de teclado', () => {
    const vehicle = new Vehicle(scene, physics);
    
    // Inicialmente no hay inputs: valores de motor y giro deben ser neutros
    vehicle.setInputs(false, false, false, false, false);
    vehicle.updatePhysics();

    expect(vehicle.raycastVehicle.wheelInfos[0].steering).toBe(0);

    // Girar a la izquierda
    vehicle.setInputs(false, false, true, false, false);
    vehicle.updatePhysics();
    expect(vehicle.raycastVehicle.wheelInfos[0].steering).toBeGreaterThan(0);

    // Girar a la derecha
    vehicle.setInputs(false, false, false, true, false);
    vehicle.updatePhysics();
    expect(vehicle.raycastVehicle.wheelInfos[0].steering).toBeLessThan(0);
  });

  it('debe aplicar fuerza de motor al acelerar en las ruedas de traccion trasera (indices 2 y 3)', () => {
    const vehicle = new Vehicle(scene, physics);

    // Aceleración
    vehicle.setInputs(true, false, false, false, false);
    vehicle.updatePhysics();

    // Ruedas de tracción trasera (índices 2 y 3)
    expect(vehicle.raycastVehicle.wheelInfos[2].engineForce).toBeGreaterThan(0);
    expect(vehicle.raycastVehicle.wheelInfos[3].engineForce).toBeGreaterThan(0);
  });

  it('debe inyectar torque de frenado en todas las ruedas cuando se presione el freno (barra espaciadora)', () => {
    const vehicle = new Vehicle(scene, physics);

    // Activar pedal de frenado
    vehicle.setInputs(false, false, false, false, true);
    vehicle.updatePhysics();

    for (let i = 0; i < 4; i++) {
      expect(vehicle.raycastVehicle.wheelInfos[i].brake).toBeGreaterThan(0);
    }
  });

  it('debe desmantelar limpiamente mallas y cuerpos fisicos al destruirse', () => {
    const vehicle = new Vehicle(scene, physics);
    expect(scene.children.length).toBeGreaterThan(0);
    expect(physics.world.bodies.includes(vehicle.chassisBody)).toBe(true);

    vehicle.destroy(scene, physics);

    // Las mallas deben ser removidas de la escena de Three.js
    expect(scene.children.includes(vehicle.mesh)).toBe(false);
    // El chasis debe borrarse del mundo físico
    expect(physics.world.bodies.includes(vehicle.chassisBody)).toBe(false);
  });
});
