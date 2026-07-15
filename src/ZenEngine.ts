import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Noise } from './Noise';
import { TerrainElevationService } from './TerrainElevationService';
import { TerrainManager } from './TerrainManager';
import { Vehicle } from './Vehicle';
import { PhysicsWorld } from './PhysicsWorld';
import { ZenAudioService } from './ZenAudioService';
import { SkyDome } from './SkyDome';

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
  public isRunning: boolean = true;
  public weather: 'zen' | 'rain' | 'fog' = 'zen';
  private rainParticles: THREE.Points | null = null;
  
  public vehicle: Vehicle;
  public elevationService: TerrainElevationService;
  public physicsWorld: PhysicsWorld;
  public audioService: ZenAudioService;
  public skyDome: SkyDome;
  
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
    
    // El fondo se controla proceduralmente mediante nuestro Skydome con Shaders
    this.skyDome = new SkyDome(this.scene);
    
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
   * Cambia dinámicamente el estado del clima en el motor y la escena
   */
  public setWeather(weather: 'zen' | 'rain' | 'fog'): void {
    this.weather = weather;

    if (weather === 'zen') {
      this.terrainManager.treeCount = 24;
      this.removeRain();
    } else if (weather === 'rain') {
      this.terrainManager.treeCount = 36;
      this.initRain();
    } else if (weather === 'fog') {
      this.terrainManager.treeCount = 12;
      this.removeRain();
    }

    // 1.5. Actualizar el estado del clima en el servicio de audio
    this.audioService.setWeather(weather);

    // 2. Reconstruir chunks de terreno con la nueva densidad procedural de árboles
    this.terrainManager.clearAll(this.scene);
    this.terrainManager.update(this.scene, this.vehicle.position.z);
  }

  /**
   * Inicializa las partículas de lluvia
   */
  private initRain(): void {
    if (this.rainParticles) return;

    const particleCount = 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    const carPos = this.vehicle.position;
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = carPos.x + (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = carPos.y + Math.random() * 25;
      positions[i * 3 + 2] = carPos.z + (Math.random() - 0.5) * 40;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x718096,
      size: 0.12,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    this.rainParticles = new THREE.Points(geometry, material);
    this.scene.add(this.rainParticles);
  }

  /**
   * Elimina de forma limpia las partículas de lluvia
   */
  private removeRain(): void {
    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles.geometry.dispose();
      if (Array.isArray(this.rainParticles.material)) {
        this.rainParticles.material.forEach(m => m.dispose());
      } else {
        this.rainParticles.material.dispose();
      }
      this.rainParticles = null;
    }
  }

  /**
   * Actualiza el ciclo día-noche de forma cíclica y fluida según la distancia recorrida
   * e integra modificadores meteorológicos de forma reactiva en tiempo real.
   */
  private updateEnvironment(): void {
    // Definimos la duración del ciclo completo en unidades de distancia (3.0 km/unidades)
    const cycleLength = 3.0;
    const progress = (this.distance % cycleLength) / cycleLength;

    // Segmentos clave del ciclo (Mediodía -> Atardecer/Zen -> Noche -> Amanecer -> Mediodía)
    // Cada segmento define los colores para el cenit (skyColor) y el horizonte (horizonColor)
    const segments = [
      { t: 0.0,  skyColor: 0xb2d9ea, horizonColor: 0xe3f2fd, fogDensity: 0.0012, ambientColor: 0xd1f3ff, ambientIntensity: 0.7,  dirColor: 0xfffdf2, dirIntensity: 1.2,  dirX: 20,  dirY: 40, dirZ: 10 },  // Mediodía
      { t: 0.25, skyColor: 0xffcb9a, horizonColor: 0xffe8d6, fogDensity: 0.0015, ambientColor: 0xffe4d1, ambientIntensity: 0.6,  dirColor: 0xff7c3b, dirIntensity: 1.4,  dirX: 38,  dirY: 7,  dirZ: 12 },  // Atardecer (Zen)
      { t: 0.50, skyColor: 0x060814, horizonColor: 0x0c0f24, fogDensity: 0.003,  ambientColor: 0x1a2130, ambientIntensity: 0.15, dirColor: 0x7f8ea6, dirIntensity: 0.3,  dirX: -25, dirY: 25, dirZ: -10 }, // Noche cósmica
      { t: 0.75, skyColor: 0xd6bcfb, horizonColor: 0xfbe6fc, fogDensity: 0.0025, ambientColor: 0xfeb2b2, ambientIntensity: 0.45, dirColor: 0xf6ad55, dirIntensity: 0.85, dirX: -35, dirY: 12, dirZ: 10 },  // Amanecer místico
      { t: 1.0,  skyColor: 0xb2d9ea, horizonColor: 0xe3f2fd, fogDensity: 0.0012, ambientColor: 0xd1f3ff, ambientIntensity: 0.7,  dirColor: 0xfffdf2, dirIntensity: 1.2,  dirX: 20,  dirY: 40, dirZ: 10 }   // Mediodía
    ];

    let idx = 0;
    for (let i = 0; i < segments.length - 1; i++) {
      if (progress >= segments[i].t && progress <= segments[i + 1].t) {
        idx = i;
        break;
      }
    }

    const segStart = segments[idx];
    const segEnd = segments[idx + 1];
    const segProgress = (progress - segStart.t) / (segEnd.t - segStart.t);

    // Interpolación lineal entre los límites del segmento actual
    const baseSky = new THREE.Color(segStart.skyColor).lerp(new THREE.Color(segEnd.skyColor), segProgress);
    const baseHorizon = new THREE.Color(segStart.horizonColor).lerp(new THREE.Color(segEnd.horizonColor), segProgress);
    let baseFogDensity = segStart.fogDensity + (segEnd.fogDensity - segStart.fogDensity) * segProgress;
    const baseAmbient = new THREE.Color(segStart.ambientColor).lerp(new THREE.Color(segEnd.ambientColor), segProgress);
    let baseAmbientIntensity = segStart.ambientIntensity + (segEnd.ambientIntensity - segStart.ambientIntensity) * segProgress;
    const baseDir = new THREE.Color(segStart.dirColor).lerp(new THREE.Color(segEnd.dirColor), segProgress);
    let baseDirIntensity = segStart.dirIntensity + (segEnd.dirIntensity - segStart.dirIntensity) * segProgress;

    const dirX = segStart.dirX + (segEnd.dirX - segStart.dirX) * segProgress;
    const dirY = segStart.dirY + (segEnd.dirY - segStart.dirY) * segProgress;
    const dirZ = segStart.dirZ + (segEnd.dirZ - segStart.dirZ) * segProgress;

    // Aplicar modificadores de clima sobre el ciclo base
    if (this.weather === 'rain') {
      baseSky.lerp(new THREE.Color(0x2d3748), 0.7);
      baseHorizon.lerp(new THREE.Color(0x2d3748), 0.7);
      baseAmbient.lerp(new THREE.Color(0x4a5568), 0.6);
      baseAmbientIntensity *= 0.6;
      baseDir.lerp(new THREE.Color(0x4a5568), 0.8);
      baseDirIntensity *= 0.35;
      baseFogDensity += 0.012;
    } else if (this.weather === 'fog') {
      baseSky.lerp(new THREE.Color(0xe2e8f0), 0.85);
      baseHorizon.lerp(new THREE.Color(0xe2e8f0), 0.85);
      baseAmbient.lerp(new THREE.Color(0xedf2f7), 0.8);
      baseAmbientIntensity *= 0.9;
      baseDir.lerp(new THREE.Color(0xcbd5e0), 0.9);
      baseDirIntensity *= 0.15;
      baseFogDensity += 0.032;
    }

    // El fondo principal se asume controlado por la esfera del skydome, pero mantenemos scene.background como fallback
    this.scene.background = baseSky;
    
    // Configurar la niebla para que coincida EXACTAMENTE con el color del horizonte del skydome.
    // Esto asegura que el terreno lejano se disuelva de forma invisible en la base del cielo.
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(baseHorizon);
      this.scene.fog.density = baseFogDensity;
    }

    this.ambientLight.color.copy(baseAmbient);
    this.ambientLight.intensity = baseAmbientIntensity;

    this.directionalLight.color.copy(baseDir);
    this.directionalLight.intensity = baseDirIntensity;

    // Sincronizar posición de la luz de costado respecto al auto
    this.directionalLight.position.set(
      this.vehicle.position.x + dirX,
      this.vehicle.position.y + dirY,
      this.vehicle.position.z + dirZ
    );

    // Sincronizar el skydome dinámico procedimental (tiempo, posición del coche, clima y progreso)
    if (this.skyDome) {
      this.skyDome.setColors(baseSky, baseHorizon);
      this.skyDome.update(0.016, this.vehicle.position, this.weather, progress);
    }
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
    this.vehicle.updatePhysics(this.elevationService);
    this.physicsWorld.step(1 / 60);

    // Red de Seguridad Activa (Failsafe Teleport - Defensa Técnica)
    const currentPosX = this.vehicle.chassisBody.position.x;
    const currentPosZ = this.vehicle.chassisBody.position.z;
    const mathGroundY = this.elevationService.getElevation(currentPosX, currentPosZ);

    if (this.vehicle.chassisBody.position.y < mathGroundY - 2.0) {
      // Neutralizar el tensor de momento lineal e inercial para prevenir giros caóticos
      this.vehicle.chassisBody.velocity.set(0, 0, 0);
      this.vehicle.chassisBody.angularVelocity.set(0, 0, 0);
      
      // Rescatar al jugador y relocalizar de forma segura en asfalto/terreno seco
      this.vehicle.chassisBody.position.y = mathGroundY + 1.5;
      
      // Enderezar físicamente el auto alineándolo con el horizonte
      this.vehicle.chassisBody.quaternion.set(0, 0, 0, 1);
    }

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

    // 4. Actualizar el ciclo día-noche dinámico y la iluminación según el clima y la distancia
    this.updateEnvironment();

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

    // 5.2. Escalamiento sutil y fluido de FOV basado en la velocidad para realzar el dinamismo
    // Base FOV de 60, escalando hasta un máximo seguro de +10 grados de forma progresiva.
    const baseFov = 60;
    const maxFovIncrease = 10;
    const targetFov = baseFov + Math.min(this.vehicle.realSpeed * 0.35, maxFovIncrease);
    // Interpolación muy suave (lerp) para conservar la paz estética 'Zen' sin movimientos bruscos
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.05);
    this.camera.updateProjectionMatrix();

    // 5.5. Simular partículas de lluvia si está lluvioso
    if (this.weather === 'rain' && this.rainParticles) {
      const positionAttr = this.rainParticles.geometry.attributes.position as THREE.BufferAttribute;
      const carPos = this.vehicle.position;
      const count = positionAttr.count;

      for (let i = 0; i < count; i++) {
        let x = positionAttr.getX(i);
        let y = positionAttr.getY(i);
        let z = positionAttr.getZ(i);

        // Caer verticalmente y desplazarse ligeramente hacia atrás del auto para simular velocidad
        y -= 0.35;
        z += this.vehicle.realSpeed * 0.05 + 0.02;

        const dx = x - carPos.x;
        const dz = z - carPos.z;

        // Reposicionar si cae por debajo del nivel del suelo o se aleja demasiado
        if (y < carPos.y - 4 || Math.abs(dx) > 20 || Math.abs(dz) > 20) {
          x = carPos.x + (Math.random() - 0.5) * 40;
          y = carPos.y + 15 + Math.random() * 10;
          z = carPos.z + (Math.random() - 0.5) * 40;
        }

        positionAttr.setXYZ(i, x, y, z);
      }
      positionAttr.needsUpdate = true;
    }

    // 6. Carga procedural y física en Z actual del auto
    this.terrainManager.update(this.scene, this.vehicle.position.z);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Destruye recursos y desvincula eventos de forma segura previniendo leaks de memoria
   */
  public destroy(container: HTMLElement): void {
    this.stop();
    this.removeRain();
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
    if (this.skyDome) {
      this.skyDome.destroy(this.scene);
    }
  }
}
