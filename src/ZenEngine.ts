import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Noise } from './Noise';
import { TerrainElevationService } from './TerrainElevationService';
import { TerrainManager } from './TerrainManager';
import { Vehicle } from './Vehicle';
import { PhysicsWorld } from './PhysicsWorld';
import { ZenAudioService } from './ZenAudioService';

/**
 * Clase ZenEngine (Clase Coordinadora Principal - OOP)
 * Orquesta la escena WebGL de Three.js y el motor de físicas Cannon.js (PhysicsWorld),
 * sincronizándolos síncronamente en el render.
 */
export class ZenEngine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;
  public speed: number = 0;
  public distance: number = 0;
  public isRunning: boolean = false;
  
  public vehicle: Vehicle;
  public elevationService: TerrainElevationService;
  public physicsWorld: PhysicsWorld;
  public audioService: ZenAudioService;
  
  private noise: Noise;
  private terrainManager: TerrainManager;
  private animationFrameId: number | null = null;

  // Registro dinámico de teclas pulsadas
  private keys: { [key: string]: boolean } = {
    w: false,
    s: false,
    a: false,
    d: false,
    ' ': false, // Barra espaciadora para frenar
    arrowup: false,
    arrowdown: false,
    arrowleft: false,
    arrowright: false,
  };

  constructor(container: HTMLElement) {
    // 1. Inicializar Escena de Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f1ea); // Warm Clean off-white beige
    
    // Añadimos Niebla (Fog) sutil para crear la ilusión de un horizonte infinito estilo Zen
    this.scene.fog = new THREE.FogExp2(0xf4f1ea, 0.0075);

    // 2. Inicializar Cámara Cinematográfica
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 15);
    this.camera.lookAt(0, 1, 0);

    // 3. Inicializar Renderizador
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    // 4. Inicializar Iluminación
    this.ambientLight = new THREE.AmbientLight(0xfffaf5, 0.7);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xfff5ea, 1.1);
    this.directionalLight.position.set(5, 12, 10);
    this.scene.add(this.directionalLight);

    // 5. Inicializar Motor Físico (Cannon.js)
    this.physicsWorld = new PhysicsWorld();

    // 6. Inicializar Audio Procedural (Capa de Servicio)
    this.audioService = new ZenAudioService();

    // 7. Inicializar Elevación y TerrainManager
    this.noise = new Noise(2026); // Aesthetic seeds matching Zen Flow
    this.elevationService = new TerrainElevationService(this.noise);
    
    // El TerrainManager asocia internamente el PhysicsWorld para colisionadores en Trimesh
    this.terrainManager = new TerrainManager(
      this.scene,
      180,
      this.elevationService,
      this.physicsWorld
    );
    
    // Carga de chunks locales Z=0 inmediatamente
    this.terrainManager.update(this.scene, 0);

    // 7. Instanciar Vehículo Físico Real de Cannon.js
    this.vehicle = new Vehicle(this.scene, this.physicsWorld);

    // Reposicionar el coche para que calce exactamente sobre el centro de la carretera spline serpenteante
    const startX = this.elevationService.getRoadCenter(0);
    const startY = this.elevationService.getElevation(startX, 0) + 1.2; // Caída suave de amortiguación
    this.vehicle.chassisBody.position.set(startX, startY, 0);

    // Calcular vector orientación inicial para comenzar alineado hacia el frente de la carretera
    const nextZ = -2.0;
    const nextX = this.elevationService.getRoadCenter(nextZ);
    const dx = nextX - startX;
    const dz = nextZ - 0;
    const startAngle = Math.atan2(dx, -dz);
    this.vehicle.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), startAngle);

    // Enlazar listeners adaptativos de teclado
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Vincular loop de frames
    this.animate = this.animate.bind(this);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k in this.keys) {
      this.keys[k] = true;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    if (k in this.keys) {
      this.keys[k] = false;
    }
  }

  /**
   * Safe resize handler para reajustes dinámicos
   */
  public handleResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Arranca la simulación del mundo
   */
  public start(): void {
    if (this.animationFrameId === null) {
      this.animate();
    }
  }

  /**
   * Frena la simulación del mundo
   */
  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Frame de render de simulación física y visual síncrono
   */
  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    // 1. Evaluar e integrar inputs de control
    const up = this.keys.w || this.keys.arrowup;
    const down = this.keys.s || this.keys.arrowdown;
    const left = this.keys.a || this.keys.arrowleft;
    const right = this.keys.d || this.keys.arrowright;
    const brake = this.keys[' '];

    this.vehicle.setInputs(up, down, left, right, brake);

    // 2. Resolver comportamiento físico en Cannon
    this.vehicle.updatePhysics();
    this.physicsWorld.step(1 / 60);

    // Sincronizar coordenadas físicas hacia mallas visuales correspondientes
    this.vehicle.syncVisuals();

    // 3. Telemetría de estadísticas
    // Convertimos velocidad m/s lineal de chasis a km/h para UI
    this.speed = Math.round(this.vehicle.realSpeed * 3.6);
    this.distance = Math.abs(this.vehicle.position.z) / 400;

    // Actualizar audio del motor procedural en tiempo real si el usuario lo ha inicializado
    if (this.audioService && this.audioService.isInitialized()) {
      this.audioService.update(this.vehicle.realSpeed * 3.6);
    }

    // 4. Mapear luces direccionales para mantener contrastes y sombreados consistentes
    this.directionalLight.position.set(
      this.vehicle.position.x + 25,
      this.vehicle.position.y + 40,
      this.vehicle.position.z + 15
    );

    // 5. Cámara de seguimiento (Chase Cam) estricta pero suave (Fallo 1)
    // Calcula el vector de dirección hacia adelante (forward) basado en la rotación (quaternion) del vehículo.
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.vehicle.mesh.quaternion);
    forward.normalize();

    const distBehind = 7.5;
    const heightAbove = 2.6;

    // Calcular punto exacto detrás y arriba del auto, basándose exclusivamente en el forward vector
    const targetCamPos = new THREE.Vector3(
      this.vehicle.position.x - forward.x * distBehind,
      this.vehicle.position.y + heightAbove,
      this.vehicle.position.z - forward.z * distBehind
    );

    // Mover posición lentamente usando interpolación lineal (Lerp) para fluidez sutil
    this.camera.position.lerp(targetCamPos, 0.08);

    // Mirar directamente al auto (camara.lookAt). Siempre vuelve a la parte trasera al enderezarse
    const posicionAuto = new THREE.Vector3(
      this.vehicle.position.x,
      this.vehicle.position.y + 0.35,
      this.vehicle.position.z
    );
    this.camera.lookAt(posicionAuto);

    // 6. Carga procedural y física en Z actual del auto
    this.terrainManager.update(this.scene, this.vehicle.position.z);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Destruye recursos y desvincula eventos de forma segura previniendo leaks de memoria
   */
  public destroy(container: HTMLElement): void {
    this.stop();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    if (this.audioService) {
      this.audioService.stop();
    }

    if (this.renderer && this.renderer.domElement && container.contains(this.renderer.domElement)) {
      container.removeChild(this.renderer.domElement);
    }

    this.terrainManager.clearAll(this.scene);
    this.vehicle.destroy(this.scene, this.physicsWorld);
  }
}
