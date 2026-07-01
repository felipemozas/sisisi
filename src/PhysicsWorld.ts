import * as CANNON from 'cannon-es';

/**
 * Clase PhysicsWorld (Capa de Servicio)
 * Encapsula la inicialización, configuración de fricción y simulación temporal
 * del motor de físicas de Cannon.js (cannon-es).
 */
export class PhysicsWorld {
  public world: CANNON.World;
  public groundMaterial: CANNON.Material;
  public wheelMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World();
    
    // Gravedad terrestre realista
    this.world.gravity.set(0, -9.82, 0);

    // Tipos de resolución de colisiones y sub-steps
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 10;
    
    // Permitir suspensión de cuerpos para optimizar ciclos ociosos (sleep)
    this.world.allowSleep = true;

    // Inicializar materiales físicos
    this.groundMaterial = new CANNON.Material('ground');
    this.wheelMaterial = new CANNON.Material('wheel');

    // Configurar contact material para definir tracción y frenado realista
    const contactMat = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.wheelMaterial,
      {
        friction: 0.8, // Tracción óptima para que el neumático no deslice infinitamente
        restitution: 0.15, // Pequeño rebote para atenuar colisiones bruscas
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e7,
      }
    );

    this.world.addContactMaterial(contactMat);
  }

  /**
   * Ejecuta el avance en el tiempo de la simulación del mundo físico
   */
  public step(deltaTime: number): void {
    // Implementar paso de tiempo fijo estricto con substepping (hasta 10 sub-pasos de física interna)
    // para prevenir el efecto "tunneling" a altas velocidades
    this.world.step(1 / 60, deltaTime, 10);
  }

  /**
   * Añade un cuerpo rígido al mundo físico
   */
  public addBody(body: CANNON.Body): void {
    this.world.addBody(body);
  }

  /**
   * Remueve un cuerpo rígido del mundo físico
   */
  public removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }
}
