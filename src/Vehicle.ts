import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './PhysicsWorld';
import { TerrainElevationService } from './TerrainElevationService';

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

  // Control de vuelco y auto-recuperación
  private flipAccumulator = 0;

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
      material: physicsWorld.chassisMaterial, // Material deslizante de teflón para evitar snagging
    });
    this.chassisBody.addShape(chassisShape);
    
    // Posicionamos el auto a salvo en Z=0 elevados del suelo para amortiguar suavemente
    this.chassisBody.position.set(0, 1.5, 0);
    // Añadimos damping de aire para amortiguar oscilaciones mecánicas del chasis
    this.chassisBody.angularDamping = 0.45;
    this.chassisBody.linearDamping = 0.08;

    // ----------------------------------------------------
    // 2. Chasis Visual de Alta Fidelidad - Tesla Model Y
    // ----------------------------------------------------
    this.mesh = new THREE.Group();

    // --- MATERIALES PREMIUM (ARTE TÉCNICO SENIOR) ---
    // Blanco Perlado Brillante Premium con capa de laca protectora (Clearcoat)
    const bodyPaintMat = new THREE.MeshPhysicalMaterial({
      color: 0xfefefe,          // Blanco puro perlado
      roughness: 0.12,          // Superficie altamente pulida
      metalness: 0.15,          // Sutil brillo metálico de fondo
      clearcoat: 1.0,           // Laca transparente brillante de 100% de reflectividad
      clearcoatRoughness: 0.03, // Capa exterior súper suave y nítida
    });

    // Embellecedores de plástico mate y sills laterales característicos de Tesla
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x1d1d1f,          // Negro carbón texturizado mate
      roughness: 0.75,
      metalness: 0.1,
    });

    // Vidrio panorámico negro ahumado de alto brillo y reflectividad
    const panoramicGlassMat = new THREE.MeshStandardMaterial({
      color: 0x050508,          // Tinte negro profundo con tintes azulados ultra sutiles
      roughness: 0.04,          // Altamente especular y nítido
      metalness: 0.95,          // Reflejos especulares puros del entorno
      transparent: true,
      opacity: 0.88,
    });

    // Cuero blanco interior característico de los asientos minimalistas de Tesla
    const whiteLeatherMat = new THREE.MeshStandardMaterial({
      color: 0xfafafa,          // Blanco nítido inmaculado
      roughness: 0.55,          // Acabado de cuero natural mate
      metalness: 0.0,
    });

    // Salpicadero y bases internas oscuras
    const dashboardDarkMat = new THREE.MeshStandardMaterial({
      color: 0x18181a,
      roughness: 0.65,
    });

    // Detalles metálicos / Logos en cromo
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe5e5e7,
      roughness: 0.15,
      metalness: 0.95,
    });

    // Faros delanteros LED iluminados (Foco dinámico)
    const ledHeadlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf0f8ff,
      emissiveIntensity: 1.8,
      roughness: 0.08,
    });

    // Luces traseras LED rojas de barra delgada
    const ledTaillightMat = new THREE.MeshStandardMaterial({
      color: 0xb30000,
      emissive: 0xff0000,
      emissiveIntensity: 1.3,
      roughness: 0.08,
    });

    // --- CONSTRUCCIÓN DE LA CARROCERÍA PROCEDURAL DETALLADA ---

    // A. Base Inferior - Spoiler bajo y molduras oscuras laterales (Protección aerodinámica)
    const baseGeo = new THREE.BoxGeometry(0.98, 0.10, 1.95);
    const baseMesh = new THREE.Mesh(baseGeo, darkTrimMat);
    baseMesh.position.set(0, -0.15, 0);
    this.mesh.add(baseMesh);

    // B. Cuerpo Principal de la Carrocería (White Pearl Body)
    const mainBodyGeo = new THREE.BoxGeometry(0.98, 0.32, 1.95);
    const mainBodyMesh = new THREE.Mesh(mainBodyGeo, bodyPaintMat);
    mainBodyMesh.position.set(0, 0.06, 0);
    this.mesh.add(mainBodyMesh);

    // C. Capó y Nariz Aerodinámica Sloping de Tesla
    // El Tesla Model Y no tiene rejilla de radiador frontal, sino una nariz aerodinámica redondeada continua
    const hoodGeo = new THREE.BoxGeometry(0.98, 0.22, 0.65);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyPaintMat);
    hoodMesh.position.set(0, 0.04, -0.65);
    hoodMesh.rotation.x = 0.16; // Caída aerodinámica hacia adelante
    this.mesh.add(hoodMesh);

    // Parachoques delantero curvado
    const bumperFrontGeo = new THREE.BoxGeometry(0.98, 0.20, 0.15);
    const bumperFront = new THREE.Mesh(bumperFrontGeo, bodyPaintMat);
    bumperFront.position.set(0, -0.06, -0.98);
    this.mesh.add(bumperFront);

    // D. Portón Trasero Hatchback Sloped (Fastback Aero Tail)
    const trunkGeo = new THREE.BoxGeometry(0.98, 0.22, 0.60);
    const trunkMesh = new THREE.Mesh(trunkGeo, bodyPaintMat);
    trunkMesh.position.set(0, 0.04, 0.68);
    trunkMesh.rotation.x = -0.15; // Inclinación fastback aerodinámica
    this.mesh.add(trunkMesh);

    // Spoiler integrado estilizado en la parte trasera (negro satinado)
    const spoilerGeo = new THREE.BoxGeometry(0.98, 0.03, 0.12);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, darkTrimMat);
    spoilerMesh.position.set(0, 0.14, 0.96);
    spoilerMesh.rotation.x = -0.1;
    this.mesh.add(spoilerMesh);

    // E. Paneles de Cristales Panorámicos y Pilares (Cúpula del Habitáculo)
    // Parabrisas Delantero Inclinado
    const windshieldGeo = new THREE.BoxGeometry(0.92, 0.02, 0.75);
    const windshield = new THREE.Mesh(windshieldGeo, panoramicGlassMat);
    windshield.position.set(0, 0.34, -0.42);
    windshield.rotation.x = 0.58; // Inclinación deportiva
    this.mesh.add(windshield);

    // Parabrisas Trasero Inclinado
    const rearGlassGeo = new THREE.BoxGeometry(0.92, 0.02, 0.70);
    const rearGlass = new THREE.Mesh(rearGlassGeo, panoramicGlassMat);
    rearGlass.position.set(0, 0.35, 0.40);
    rearGlass.rotation.x = -0.52;
    this.mesh.add(rearGlass);

    // Techo Panorámico de Vidrio Negro
    const roofGeo = new THREE.BoxGeometry(0.86, 0.02, 0.80);
    const roofGlass = new THREE.Mesh(roofGeo, panoramicGlassMat);
    roofGlass.position.set(0, 0.48, -0.02);
    this.mesh.add(roofGlass);

    // Cristales Laterales Ahumados (Izquierda / Derecha)
    const windowLeftGeo = new THREE.BoxGeometry(0.02, 0.26, 0.95);
    const windowLeft = new THREE.Mesh(windowLeftGeo, panoramicGlassMat);
    windowLeft.position.set(-0.48, 0.32, -0.01);
    this.mesh.add(windowLeft);

    const windowRightGeo = new THREE.BoxGeometry(0.02, 0.26, 0.95);
    const windowRight = new THREE.Mesh(windowRightGeo, panoramicGlassMat);
    windowRight.position.set(0.48, 0.32, -0.01);
    this.mesh.add(windowRight);

    // Pilares de la carrocería en Blanco Perlado (A, B y C Pillars)
    const pillarALeftGeo = new THREE.BoxGeometry(0.03, 0.42, 0.03);
    const pillarALeft = new THREE.Mesh(pillarALeftGeo, bodyPaintMat);
    pillarALeft.position.set(-0.46, 0.32, -0.45);
    pillarALeft.rotation.x = 0.58;
    this.mesh.add(pillarALeft);

    const pillarARightGeo = new THREE.BoxGeometry(0.03, 0.42, 0.03);
    const pillarARight = new THREE.Mesh(pillarARightGeo, bodyPaintMat);
    pillarARight.position.set(0.46, 0.32, -0.45);
    pillarARight.rotation.x = 0.58;
    this.mesh.add(pillarARight);

    const pillarCLeftGeo = new THREE.BoxGeometry(0.03, 0.45, 0.03);
    const pillarCLeft = new THREE.Mesh(pillarCLeftGeo, bodyPaintMat);
    pillarCLeft.position.set(-0.46, 0.32, 0.41);
    pillarCLeft.rotation.x = -0.52;
    this.mesh.add(pillarCLeft);

    const pillarCRightGeo = new THREE.BoxGeometry(0.03, 0.45, 0.03);
    const pillarCRight = new THREE.Mesh(pillarCRightGeo, bodyPaintMat);
    pillarCRight.position.set(0.46, 0.32, 0.41);
    pillarCRight.rotation.x = -0.52;
    this.mesh.add(pillarCRight);

    // F. Retrovisores Aerodinámicos Exteriores
    const mirrorLeftGeo = new THREE.BoxGeometry(0.12, 0.06, 0.06);
    const mirrorLeft = new THREE.Mesh(mirrorLeftGeo, bodyPaintMat);
    mirrorLeft.position.set(-0.55, 0.24, -0.48);
    this.mesh.add(mirrorLeft);

    const mirrorRightGeo = new THREE.BoxGeometry(0.12, 0.06, 0.06);
    const mirrorRight = new THREE.Mesh(mirrorRightGeo, bodyPaintMat);
    mirrorRight.position.set(0.55, 0.24, -0.48);
    this.mesh.add(mirrorRight);

    // G. Diseño del Habitáculo Interior (Visibilidad 360% a través del Vidrio)
    const floorGeo = new THREE.BoxGeometry(0.88, 0.02, 1.10);
    const floor = new THREE.Mesh(floorGeo, dashboardDarkMat);
    floor.position.set(0, 0.12, -0.05);
    this.mesh.add(floor);

    // Asientos Delanteros Deportivos (Cuero Blanco)
    // Conductor (Izquierda)
    const seatBaseL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.28), whiteLeatherMat);
    seatBaseL.position.set(-0.22, 0.16, -0.12);
    this.mesh.add(seatBaseL);

    const seatBackL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.08), whiteLeatherMat);
    seatBackL.position.set(-0.22, 0.32, -0.01);
    seatBackL.rotation.x = 0.12;
    this.mesh.add(seatBackL);

    const headrestL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.08), whiteLeatherMat);
    headrestL.position.set(-0.22, 0.50, 0.02);
    this.mesh.add(headrestL);

    // Acompañante (Derecha)
    const seatBaseR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.28), whiteLeatherMat);
    seatBaseR.position.set(0.22, 0.16, -0.12);
    this.mesh.add(seatBaseR);

    const seatBackR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.08), whiteLeatherMat);
    seatBackR.position.set(0.22, 0.32, -0.01);
    seatBackR.rotation.x = 0.12;
    this.mesh.add(seatBackR);

    const headrestR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.08), whiteLeatherMat);
    headrestR.position.set(0.22, 0.50, 0.02);
    this.mesh.add(headrestR);

    // Asientos Traseros (Banco Dividido en Cuero Blanco)
    const rearSeatBase = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.28), whiteLeatherMat);
    rearSeatBase.position.set(0, 0.17, 0.32);
    this.mesh.add(rearSeatBase);

    const rearSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.36, 0.08), whiteLeatherMat);
    rearSeatBack.position.set(0, 0.33, 0.44);
    rearSeatBack.rotation.x = 0.10;
    this.mesh.add(rearSeatBack);

    // Salpicadero Minimalista de Tesla
    const dashGeo = new THREE.BoxGeometry(0.88, 0.08, 0.22);
    const dash = new THREE.Mesh(dashGeo, dashboardDarkMat);
    dash.position.set(0, 0.24, -0.42);
    this.mesh.add(dash);

    // La mítica moldura blanca horizontal de punta a punta del tablero
    const dashWhiteAccent = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.03), whiteLeatherMat);
    dashWhiteAccent.position.set(0, 0.24, -0.31);
    this.mesh.add(dashWhiteAccent);

    // La icónica pantalla central vertical (Tesla Central Tablet)
    const tabletGeo = new THREE.BoxGeometry(0.18, 0.11, 0.015);
    const tablet = new THREE.Mesh(tabletGeo, chromeMat);
    tablet.position.set(0, 0.28, -0.28);
    tablet.rotation.y = -0.12; // Girado ligeramente hacia el conductor
    tablet.rotation.x = -0.05;
    this.mesh.add(tablet);

    const tabletScreen = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.10, 0.005), dashboardDarkMat);
    tabletScreen.position.set(0, 0.28, -0.27);
    tabletScreen.rotation.y = -0.12;
    tabletScreen.rotation.x = -0.05;
    this.mesh.add(tabletScreen);

    // Volante minimalista
    const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.013, 8, 20), dashboardDarkMat);
    steeringWheel.position.set(-0.22, 0.30, -0.32);
    steeringWheel.rotation.x = 0.4;
    this.mesh.add(steeringWheel);

    // H. Faros Delanteros LED y Luces Traseras Red Line de Tesla
    const lightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), ledHeadlightMat);
    lightLeft.position.set(-0.38, 0.08, -0.86);
    this.mesh.add(lightLeft);

    const lightRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.14), ledHeadlightMat);
    lightRight.position.set(0.38, 0.08, -0.86);
    this.mesh.add(lightRight);

    const tailLightLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), ledTaillightMat);
    tailLightLeft.position.set(-0.36, 0.12, 0.94);
    this.mesh.add(tailLightLeft);

    const tailLightRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), ledTaillightMat);
    tailLightRight.position.set(0.36, 0.12, 0.94);
    this.mesh.add(tailLightRight);

    // I. Emblemas Metálicos cromados de Tesla ("T" logo)
    const frontLogo = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.005, 8), chromeMat);
    frontLogo.position.set(0, 0.11, -0.93);
    frontLogo.rotation.x = Math.PI / 2;
    this.mesh.add(frontLogo);

    const rearLogo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.005, 8), chromeMat);
    rearLogo.position.set(0, 0.14, 0.95);
    rearLogo.rotation.x = Math.PI / 2;
    this.mesh.add(rearLogo);

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
      suspensionRestLength: 0.68,                 // Altura de descanso incrementada de forma defensiva
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

    // Neumático de goma premium
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.22, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x141416, // Goma negra carbón realista
      roughness: 0.85,  // Superficie opaca de neumático
      metalness: 0.08,
    });

    // Materiales del Rim/Llantas
    const rimAlloyMat = new THREE.MeshStandardMaterial({
      color: 0x2c2c2e, // Gris antracita oscuro satinado de Tesla
      roughness: 0.45,
      metalness: 0.85, // Apariencia de aleación metálica cepillada
    });

    connectionPoints.forEach((point, i) => {
      // 1. Agregar físicamente la rueda
      const opts = {
        ...wheelOptions,
        chassisConnectionPointLocal: point,
        isFrontWheel: i < 2,
      };
      this.raycastVehicle.addWheel(opts);

      // 2. Crear visual de rueda híbrida de alta fidelidad (Tire + detailed covers)
      const wheelMesh = new THREE.Mesh(tireGeo, tireMat);

      // Decidir dirección exterior del tapacubo/rim según el lado
      const isLeftWheel = (i % 2 === 0);
      const sideSign = isLeftWheel ? -1 : 1;

      // Base del Rim / Disco de aleación empotrado
      const rimBaseGeo = new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, 0.04, 24);
      rimBaseGeo.rotateZ(Math.PI / 2);
      const rimBase = new THREE.Mesh(rimBaseGeo, rimAlloyMat);
      rimBase.position.x = sideSign * 0.095;
      wheelMesh.add(rimBase);

      // Tapa de tuerca central con logotipo de Tesla
      const centerCapGeo = new THREE.CylinderGeometry(wheelRadius * 0.15, wheelRadius * 0.15, 0.01, 16);
      centerCapGeo.rotateZ(Math.PI / 2);
      const centerCap = new THREE.Mesh(centerCapGeo, chromeMat);
      centerCap.position.x = sideSign * 0.118;
      wheelMesh.add(centerCap);

      // Radios / Spokes específicos de diseño de turbina (Gemini / Induction Style)
      const spokeCount = 7;
      for (let s = 0; s < spokeCount; s++) {
        const angle = (s * Math.PI * 2) / spokeCount;
        const spokeGeo = new THREE.BoxGeometry(0.024, wheelRadius * 0.65, 0.035);
        const spoke = new THREE.Mesh(spokeGeo, rimAlloyMat);
        
        // Colocar el radio en el plano exterior de la rueda
        spoke.position.x = sideSign * 0.110;
        spoke.position.y = Math.cos(angle) * wheelRadius * 0.36;
        spoke.position.z = Math.sin(angle) * wheelRadius * 0.36;
        
        // Rotar para apuntar radialmente desde el centro
        spoke.rotation.x = -angle;
        // Torsión aerodinámica para estilo turbina (como se muestra en image_0.png)
        spoke.rotation.y = sideSign * 0.22; 

        wheelMesh.add(spoke);
      }

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
   * Transfiere las fuerzas mecánicas aplicadas por el usuario al vehículo físico.
   * Cuenta con un amortiguador preventivo en juntas críticas basado en la altura matemática del terreno.
   */
  public updatePhysics(elevationService?: TerrainElevationService): void {
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

    // 4. Colchón defensivo anti-junturas microscópicas (Raycast Margin Cushion)
    if (elevationService) {
      const px = this.chassisBody.position.x;
      const pz = this.chassisBody.position.z;
      const groundHeight = elevationService.getElevation(px, pz);
      const distToGround = this.chassisBody.position.y - groundHeight;

      // Si el auto está a punto de penetrar o perder muelle de manera anómala,
      // aplicamos una sustentación vertical compensante progresiva para evitar el vacío.
      if (distToGround < 0.65) {
        const penetration = 0.65 - distToGround;
        const liftCoefficient = distToGround < 0 ? 35000 : 15000; // Sustentación súper firme bajo tierra
        const liftForce = penetration * liftCoefficient;

        // Modifica la fuerza vertical de amortiguador artificial estable
        this.chassisBody.force.y += liftForce;

        // Limita e hidrata la velocidad de caída brusca del chasis
        if (this.chassisBody.velocity.y < -1) {
          this.chassisBody.velocity.y *= 0.75;
        }
      }

      // Sistema anti-caída catastrófica: teletransportar arriba de inmediato si se hunde
      if (distToGround < -1.2) {
        this.chassisBody.position.y = groundHeight + 0.8;
        this.chassisBody.velocity.y = 0;
        this.chassisBody.velocity.x *= 0.5;
        this.chassisBody.velocity.z *= 0.5;
        this.chassisBody.angularVelocity.set(0, 0, 0);

        // Alinear para que quede de pie
        const currentEuler = new THREE.Euler().setFromQuaternion(this.mesh.quaternion, 'YXZ');
        const uprightQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, currentEuler.y, 0));
        this.chassisBody.quaternion.copy(uprightQ as unknown as CANNON.Quaternion);
      }
    }

    // 5. Limitador defensivo de velocidad angular de rotación (anti-spin helicóptero)
    const angVel = this.chassisBody.angularVelocity;
    const angSpeedSq = angVel.lengthSquared();
    const maxAngSpeed = 6.0; // Límite generoso pero seguro de rotación
    if (angSpeedSq > maxAngSpeed * maxAngSpeed) {
      angVel.normalize();
      angVel.scale(maxAngSpeed, angVel);
    }

    // 6. Sistema de auto-recuperación de vuelco (auto roll-over reset)
    // El vector local (0, 1, 0) transformado por la orientación de la malla nos da el vector "up" real del vehículo en el mundo
    const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
    
    // Si el auto está muy inclinado, volcado de lado o completamente boca abajo
    if (upVector.y < 0.45) {
      this.flipAccumulator += 1;
      // Aproximadamente 1.25 segundos a ~60 FPS (75 frames)
      if (this.flipAccumulator > 75) {
        this.resetToRoad(elevationService);
        this.flipAccumulator = 0;
      }
    } else {
      // Reducir gradualmente el acumulador para que un bache o salto corto no lo active de golpe
      this.flipAccumulator = Math.max(0, this.flipAccumulator - 2);
    }
  }

  /**
   * Resetea el vehículo de manera segura al centro de la carretera (X=0)
   * a su posición longitudinal actual (Z) y su altura correspondiente.
   */
  public resetToRoad(elevationService?: TerrainElevationService): void {
    const pz = this.chassisBody.position.z;
    const px = 0; // Centro de la carretera
    const py = elevationService ? (elevationService.getElevation(px, pz) + 0.8) : 1.5;

    // Reposicionar cuerpo de Cannon.js
    this.chassisBody.position.set(px, py, pz);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);

    // Orientar mirando perfectamente al frente (+Z) sin inclinación
    this.chassisBody.quaternion.set(0, 0, 0, 1);

    // Sincronizar malla visual de inmediato para evitar tirones
    this.mesh.position.set(px, py, pz);
    this.mesh.quaternion.set(0, 0, 0, 1);

    // Resetear rotaciones físicas de las mallas de las ruedas
    this.wheelMeshes.forEach((wheelMesh) => {
      wheelMesh.quaternion.set(0, 0, 0, 1);
    });
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
