import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { TerrainElevationService } from './TerrainElevationService';
import { PhysicsWorld } from './PhysicsWorld';

/**
 * Clase TerrainChunk (Capa de Servicio)
 * Representa una cuadrícula individual de terreno procedimental.
 * Vincula una malla visual de Three.js, una cinta gris de la carretera (La Carretera),
 * decoraciones de pinos estilizados y un cuerpo de colisión físico de Cannon.js.
 */
export class TerrainChunk {
  public mesh: THREE.Mesh;
  public roadMesh: THREE.Mesh | null = null;
  public chunkZ: number;
  public collisionBody: CANNON.Body | null = null;
  
  // Guardado de decoración procedural para desasignación limpia
  private decorations: THREE.Group[] = [];

  constructor(
    scene: THREE.Scene,
    chunkZ: number,
    size: number,
    elevationService: TerrainElevationService,
    physicsWorld?: PhysicsWorld,
    treeCount: number = 24
  ) {
    this.chunkZ = chunkZ;

    const segments = 24;
    // Creamos la geometría de plano local para el terreno
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Ajustamos la altura de cada vértice usando el de elevationService
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i); // En PlaneGeometry local, Y es la profundidad

      const worldX = x;
      // Fallo 3: Para evitar saltos y costuras (Z flip), usamos chunkZ - y
      const worldZ = chunkZ - y;

      const height = elevationService.getElevation(worldX, worldZ);

      // Asignamos la deformación en el eje vertical
      position.setZ(i, height);
    }

    geometry.computeVertexNormals();

    // Material de estilo Low-Poly de sombreado plano (flatShading) y tono pastel relajante
    const material = new THREE.MeshLambertMaterial({
      color: 0xccd5c3, // Soft pastel sage/moss green
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    
    // Posicionamos el bloque en su respectiva coordenada Z del mundo
    this.mesh.position.set(0, 0, chunkZ);
    // Lo rotamos plano en el eje horizontal del mundo
    this.mesh.rotation.x = -Math.PI / 2;

    scene.add(this.mesh);

    // ----------------------------------------------------
    // GENERACIÓN DE LA CARRETERA (ROAD RIBBON - CatmullRomCurve3)
    // ----------------------------------------------------
    const roadWidth = 5.2; // Ancho idóneo para la calzada visual
    const controlPoints: THREE.Vector3[] = [];
    const controlStep = 10; // puntos de control cada 10 unidades para una curva suave
    const halfSize = size / 2;
    const minZ = chunkZ - halfSize;
    const numControlPoints = Math.floor(size / controlStep);

    // Generar puntos de control consultando exactamente el terreno
    for (let i = 0; i <= numControlPoints; i++) {
      const zVal = minZ + i * controlStep;
      const xVal = elevationService.getRoadCenter(zVal);
      // Fallo 2: y = calcularRuidoTerreno(x, z) + 0.1
      const yVal = elevationService.getElevation(xVal, zVal) + 0.1;
      controlPoints.push(new THREE.Vector3(xVal, yVal, zVal));
    }

    // Crear la curva continua de asfalto
    const roadCurve = new THREE.CatmullRomCurve3(controlPoints);

    // Muestrear puntos de la curva para reconstruir la geometría de asfalto con alta definición
    const roadPoints = roadCurve.getPoints(Math.floor(size / 2));

    // Generar la extrusión manual de tira de quads (BufferGeometry)
    const roadGeometry = new THREE.BufferGeometry();
    const verticesList: number[] = [];
    const indicesList: number[] = [];
    const uvsList: number[] = [];

    for (let i = 0; i < roadPoints.length; i++) {
      const p = roadPoints[i];
      
      // Calcular vector de dirección de la tangente de la curva
      let tangent = new THREE.Vector3();
      if (i < roadPoints.length - 1) {
        tangent.copy(roadPoints[i + 1]).sub(p);
      } else if (i > 0) {
        tangent.copy(p).sub(roadPoints[i - 1]);
      } else {
        tangent.set(0, 0, -1);
      }
      tangent.y = 0; // mantener perpendicular horizontal
      tangent.normalize();

      const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Punto izquierdo y derecho del asfalto
      const leftPoint = p.clone().addScaledVector(side, roadWidth / 2);
      const rightPoint = p.clone().addScaledVector(side, -roadWidth / 2);

      verticesList.push(leftPoint.x, leftPoint.y, leftPoint.z);
      verticesList.push(rightPoint.x, rightPoint.y, rightPoint.z);

      // UVs
      const u = i / (roadPoints.length - 1);
      uvsList.push(0, u);
      uvsList.push(1, u);

      if (i < roadPoints.length - 1) {
        const vIdx = i * 2;
        // Triángulo 1
        indicesList.push(vIdx, vIdx + 1, vIdx + 2);
        // Triángulo 2
        indicesList.push(vIdx + 1, vIdx + 3, vIdx + 2);
      }
    }

    roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(verticesList, 3));
    roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvsList, 2));
    roadGeometry.setIndex(indicesList);
    roadGeometry.computeVertexNormals();

    // Material de carril/calzada gris carbón suave / pastel low-poly
    const roadMaterial = new THREE.MeshLambertMaterial({
      color: 0x565c63, // Soft pastel slate-grey
      flatShading: true,
      side: THREE.DoubleSide,
    });

    this.roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
    scene.add(this.roadMesh);

    // ----------------------------------------------------
    // GENERACIÓN DE PINOS DECORATIVOS PROCEDURALES
    // ----------------------------------------------------
    const treeGeoTrunk = new THREE.CylinderGeometry(0.12, 0.16, 0.7, 5);
    const treeGeoFoliage = new THREE.ConeGeometry(0.58, 1.6, 5);
    
    const treeMatTrunk = new THREE.MeshLambertMaterial({ color: 0x8c6d58, flatShading: true });
    const treeMatFoliage = new THREE.MeshLambertMaterial({ color: 0x76947a, flatShading: true }); // Pastel forest green

    // Determinista por coordenadas de sección Z para evitar parpadeos/reseteos
    const seed = Math.abs(Math.sin(chunkZ)) * 1000;

    for (let t = 0; t < treeCount; t++) {
      // Cálculo determinista pseudo-aleatorio basado en la sección Z y el índice de árbol
      const randX = Math.sin(seed + t * 45.7) * (size * 0.44);
      const randZ = chunkZ - halfSize + ((Math.cos(seed + t * 12.3) + 1.0) / 2.0) * size;
      
      const rCenter = elevationService.getRoadCenter(randZ);
      const distToRoad = Math.abs(randX - rCenter);

      // Distancia de salvaguarda prudente para que los pinos no invadan ni tapen la calzada
      if (distToRoad > 9.5) {
        const terrainY = elevationService.getElevation(randX, randZ);
        
        // Crear grupo de pino individual
        const treeGroup = new THREE.Group();
        treeGroup.position.set(randX, terrainY, randZ);

        // Añadir Tronco
        const trunk = new THREE.Mesh(treeGeoTrunk, treeMatTrunk);
        trunk.position.y = 0.35; // Mitad de la altura
        treeGroup.add(trunk);

        // Añadir Follaje
        const foliage = new THREE.Mesh(treeGeoFoliage, treeMatFoliage);
        foliage.position.y = 1.3; // Elevado tras el tronco
        treeGroup.add(foliage);

        scene.add(treeGroup);
        this.decorations.push(treeGroup);
      }
    }

    // Compartir geometries de forma local para evitar loops redundantes de GPU
    // Ojo: Se liberan abajo liberando recursos unificados para evitar leaks

    // ----------------------------------------------------
    // Física del Terreno de Cannon.js
    // ----------------------------------------------------
    if (physicsWorld) {
      // Extraemos los vértices y los índices de triángulos directamente de la geometría unificada de Three.js
      const vertices = Array.from(geometry.attributes.position.array) as number[];
      const indices = geometry.index ? (Array.from(geometry.index.array) as number[]) : [];

      if (indices.length > 0) {
        // Trimesh es el colisionador óptimo para mallas deformadas personalizadas
        const trimeshShape = new CANNON.Trimesh(vertices, indices);
        
        this.collisionBody = new CANNON.Body({
          mass: 0, // Masa de 0 para designar objeto estático inmóvil (suelo)
          material: physicsWorld.groundMaterial,
        });
        
        this.collisionBody.addShape(trimeshShape);
        
        // El cuerpo se posiciona exactamente en su respectiva coordenada Z homóloga a Three.js
        this.collisionBody.position.set(0, 0, chunkZ);
        
        // Coherencia geométrica: rotamos en X por -PI/2
        this.collisionBody.quaternion.setFromAxisAngle(
          new CANNON.Vec3(1, 0, 0),
          -Math.PI / 2
        );

        physicsWorld.addBody(this.collisionBody);
      }
    }
  }

  /**
   * Libera los recursos de WebGL procedimentalmente para evitar fugas de memoria (Memory Leaks)
   */
  public dispose(scene: THREE.Scene, physicsWorld?: PhysicsWorld): void {
    // 1. Remover y liberar mallas principales del terreno
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();

    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((mat) => mat.dispose());
    } else {
      this.mesh.material.dispose();
    }

    // 2. Remover y liberar carretera
    if (this.roadMesh) {
      scene.remove(this.roadMesh);
      this.roadMesh.geometry.dispose();
      if (Array.isArray(this.roadMesh.material)) {
        this.roadMesh.material.forEach((mat) => mat.dispose());
      } else {
        this.roadMesh.material.dispose();
      }
      this.roadMesh = null;
    }

    // 3. Remover y liberar decoraciones de pinos procedimentales
    this.decorations.forEach((treeGroup) => {
      scene.remove(treeGroup);
      treeGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.decorations = [];

    // 4. Retiramos el cuerpo estático de las colisiones físicas de Cannon
    if (this.collisionBody && physicsWorld) {
      physicsWorld.removeBody(this.collisionBody);
      this.collisionBody = null;
    }
  }
}
