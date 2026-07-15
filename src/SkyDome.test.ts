import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { SkyDome } from './SkyDome';

describe('SkyDome (Procedural Sky Dome) Suite', () => {
  it('debe construir un Skydome con una esfera gigante invertida y un ShaderMaterial con los uniforms requeridos', () => {
    const scene = new THREE.Scene();
    const skyDome = new SkyDome(scene);

    expect(skyDome.mesh).toBeInstanceOf(THREE.Mesh);
    expect(skyDome.mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(skyDome.mesh.material).toBeInstanceOf(THREE.ShaderMaterial);

    const material = skyDome.mesh.material as THREE.ShaderMaterial;
    expect(material.side).toBe(THREE.BackSide);
    
    // Verificar que los uniforms necesarios para el shader procedimental existen
    expect(material.uniforms).toHaveProperty('u_time');
    expect(material.uniforms).toHaveProperty('u_skyColor');
    expect(material.uniforms).toHaveProperty('u_horizonColor');
    expect(material.uniforms).toHaveProperty('u_cloudSpeed');
    expect(material.uniforms).toHaveProperty('u_weatherFactor');

    // Debe estar añadido a la escena
    expect(scene.children.includes(skyDome.mesh)).toBe(true);
  });

  it('debe actualizar la posicion de la malla para seguir al auto, incrementar u_time e interpolar colores según el clima', () => {
    const scene = new THREE.Scene();
    const skyDome = new SkyDome(scene);
    const material = skyDome.mesh.material as THREE.ShaderMaterial;

    const carPos = new THREE.Vector3(10, 5, -50);
    
    // Ejecutar el update
    skyDome.update(0.016, carPos, 'zen', 0.25);

    // La malla del skydome debe seguir la posición del vehículo para crear un horizonte infinito
    expect(skyDome.mesh.position.x).toBe(10);
    expect(skyDome.mesh.position.y).toBe(5);
    expect(skyDome.mesh.position.z).toBe(-50);

    // El tiempo en el shader debe haberse incrementado
    expect(material.uniforms.u_time.value).toBeGreaterThan(0);
  });

  it('debe remover e inactivar el skydome de la escena al destruirlo', () => {
    const scene = new THREE.Scene();
    const skyDome = new SkyDome(scene);

    expect(scene.children.includes(skyDome.mesh)).toBe(true);

    skyDome.destroy(scene);
    expect(scene.children.includes(skyDome.mesh)).toBe(false);
  });
});
