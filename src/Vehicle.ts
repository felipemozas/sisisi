import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld';

/**
 * Clase Vehicle (Capa de Servicio OOP)
 * Encapsula la física realista en 3D sustentada en CANNON.RaycastVehicle,
 * gestionando fuerzas aplicadas a los amortiguadores y amortiguación de las ruedas.
 */
export class Vehicle {
  public mesh: THREE.Group;
  public chassisBody: CANNON.Body;
  public raycastVehicle: CANNON.RaycastVehicle;
  public wheelMeshes: THREE.Mesh[] = [];

  // Inputs internos
  private isAcel = false;
  private isRev = false;
  private isLeft = false;
  private isRight = false;
  private isBraking = false;

  // Ajustes de rendimiento de la conducción física
  private readonly engineForceMax = 1800; // Torque máximo del motor
  private readonly reverseForceMax = -800; // Fuerza máxima para retroceder
  private readonly maxSteeringVal = 0.45; // Angulación en radianes de giro libre
  private readonly brakeForceMax = 50; // Fuerza potente de bloqueo de neumáticos

  constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld) {
    // ----------------------------------------------------
    // 1. Cuerpo físico (Chasis en Cannon.js)
    // ----------------------------------------------------
    const chassisWidth = 0.9;
    const chassisHeight = 0.45;
    const chassisLength = 1.9;

    // Caja de colisión desplazada
    const chassisShape = new CANNON.Box(
      new CANNON.Vec3(chassisWidth / 2, chassisHeight / 2, chassisLength / 2)
    );

    this.chassisBody = new CANNON.Body({
      mass: 1500, // 1500 kg recomendados para peso realista
      material: physicsWorld.wheelMaterial, // Material para evitar fricciones bruscas directas
    });
    this.chassisBody.addShape(chassisShape);
    
    // Posicionamos el auto a salvo en Z=0 elevados del suelo para amortiguar suavemente
    this.chassisBody.position.set(0, 1.5, 0);
    // Añadimos damping de aire para amortiguar oscilaciones mecánicas del chasis
    this.chassisBody.angularDamping = 0.45;
    this.chassisBody.linearDamping = 0.08;

    // ----------------------------------------------------
    // 2. Chasis Visual en Three.js con acabados minimalistas
    // ----------------------------------------------------
    this.mesh = new THREE.Group();

    // Carrocería del chasis estilo Low-Poly
    const bodyMat = new THREE.MeshLambertMaterial({
      color: 0xe5ac9c, // Soft pastel coral pink/peach
      flatShading: true,
    });
    const bodyGeo = new THREE.BoxGeometry(chassisWidth, chassisHeight, chassisLength);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.add(bodyMesh);

    // Cabina/Canopy sutil estilo Low-Poly
    const cabMat = new THREE.MeshLambertMaterial({
      color: 0xfaf8f5, // Pure warm light pastel cream
      flatShading: true,
    });
    const cabGeo = new THREE.BoxGeometry(0.7, 0.35, 0.95);
    const cabMesh = new THREE.Mesh(cabGeo, cabMat);
    cabMesh.position.set(0, 0.38, -0.15); // Avanzado indicando flujo cinemático
    this.mesh.add(cabMesh);

    scene.add(this.mesh);

    // ----------------------------------------------------
    // 3. RaycastVehicle de Cannon.js
    // ----------------------------------------------------
    this.raycastVehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,   // Eje X
      indexUpAxis: 1,      // Eje Y
      indexForwardAxis: 2, // Eje Z
    });

    // ----------------------------------------------------
    // 4. Agregar Ruedas Físicas y Visuales
    // ----------------------------------------------------
    const wheelRadius = 0.32;
    const wheelOptions = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0), // Dirección amortiguadora hacia abajo
      suspensionRestLength: 0.52,                 // Altura de descanso de los muelles
      suspensionStiffness: 28,                    // Amortiguación elástica responsiva
      maxSuspensionForce: 100000,
      dampingRelaxation: 2.3,                     // Resistencia a la distensión
      dampingCompression: 4.3,                    // Resistencia a la compresión brusca
      frictionSlip: 3.5,                          // Grip de neumáticos
      rollInfluence: 0.12,                        // Factor anti-vuelco (centro de gravedad bajo virtual)
      axleLocal: new CANNON.Vec3(1, 0, 0),        // Eje de revolución X
    };

    // Conexiones estructurales relativas al centro de gravedad
    const xOff = 0.52;
    const yOff = -0.15;
    const zOff = 0.65;

    // Ruedas delanteras (0 e 1) y traseras (2 y 3)
    const connectionPoints = [
      new CANNON.Vec3(xOff, yOff, -zOff),   // Delantera Izquierda
      new CANNON.Vec3(-xOff, yOff, -zOff),  // Delantera Derecha
      new CANNON.Vec3(xOff, yOff, zOff),    // Trasera Izquierda
      new CANNON.Vec3(-xOff, yOff, zOff),   // Trasera Derecha
    ];

    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.22, 16);
    // Rotar para disponer los cilindros de costado lateral
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelMat = new THREE.MeshLambertMaterial({
      color: 0x4a4a48, // Smooth pastel charcoal
      flatShading: true,
    });

    connectionPoints.forEach((point, i) => {
      // 1. Agregar físicamente la rueda
      const opts = {
        ...wheelOptions,
        chassisConnectionPointLocal: point,
        isFrontWheel: i < 2,
      };
      this.raycastVehicle.addWheel(opts);

      // 2. Crear visual representativo de neumático cilíndrico
      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    });

    // Añadir el coche y registradores automáticos al mundo físico
    this.raycastVehicle.addToWorld(physicsWorld.world);
  }

  /**
   * Registra el estado activo de la botonera/mandos
   */
  public setInputs(up: boolean, down: boolean, left: boolean, right: boolean, brake: boolean): void {
    this.isAcel = up;
    this.isRev = down;
    this.isLeft = left;
    this.isRight = right;
    this.isBraking = brake;
  }

  /**
   * Transfiere las fuerzas mecánicas aplicadas por el usuario al vehículo físico
   */
  public updatePhysics(): void {
    // 1. Aceleración / Marcha atrás coordinada (Tracción Trasera en ruedas 2 y 3)
    let engineForce = 0;
    if (this.isAcel) {
      engineForce = this.engineForceMax;
    } else if (this.isRev) {
      engineForce = this.reverseForceMax;
    }

    this.raycastVehicle.applyEngineForce(engineForce, 2);
    this.raycastVehicle.applyEngineForce(engineForce, 3);

    // 2. Sistema de dirección en ruedas delanteras (0 y 1)
    let targetSteer = 0;
    if (this.isLeft) {
      targetSteer = this.maxSteeringVal;
    } else if (this.isRight) {
      targetSteer = -this.maxSteeringVal;
    }

    this.raycastVehicle.setSteeringValue(targetSteer, 0);
    this.raycastVehicle.setSteeringValue(targetSteer, 1);

    // 3. Bloqueo de frenos activo en las 4 ruedas
    const brakeForce = this.isBraking ? this.brakeForceMax : 0;
    for (let i = 0; i < 4; i++) {
      this.raycastVehicle.setBrake(brakeForce, i);
    }
  }

  /**
   * Sincroniza al milímetro las mallas de Three.js con sus cuerpos de Cannon.js correspondientes
   */
  public syncVisuals(): void {
    // Sincronizar chasis general
    this.mesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
    this.mesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

    // Sincronizar individualmente las 4 llantas visuales
    for (let i = 0; i < this.wheelMeshes.length; i++) {
      this.raycastVehicle.updateWheelTransform(i);
      const transform = this.raycastVehicle.wheelInfos[i].worldTransform;
      const mesh = this.wheelMeshes[i];
      mesh.position.copy(transform.position as unknown as THREE.Vector3);
      mesh.quaternion.copy(transform.quaternion as unknown as THREE.Quaternion);
    }
  }

  /**
   * Retorna el vector de posición actual del vehículo en el espacio 3D
   */
  public get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  /**
   * Retorna el ángulo aproximado de giro del vehículo usando su vector de rotación Y
   */
  public get angle(): number {
    const euler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
    return euler.y;
  }

  /**
   * Retorna la velocidad real escalar (magnitud del vector velocidad sobre Z local)
   */
  public get realSpeed(): number {
    const velocity = this.chassisBody.velocity;
    // Retornamos velocidad en m/s escalada
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
  }

  /**
   * Libera y quita de memoria mallas visuales y colisiones físicas del auto
   */
  public destroy(scene: THREE.Scene, physicsWorld: PhysicsWorld): void {
    // Remover mallas de Three.js
    scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((mat) => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.wheelMeshes.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.wheelMeshes = [];

    // Remover de Cannon.js
    this.raycastVehicle.removeFromWorld(physicsWorld.world);
  }
}
