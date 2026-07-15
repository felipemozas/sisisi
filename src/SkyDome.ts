import * as THREE from 'three';

/**
 * Servicio Procedimental SkyDome (Capa de Servicio - OOP)
 * Dibuja un cielo celeste con nubes que se mueven lentamente usando shaders de WebGL directos (GLSL).
 * Sin depender de texturas o imágenes externas, asegurando un rendimiento excelente.
 */
export class SkyDome {
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;

  constructor(scene: THREE.Scene) {
    // 1. Geometría esférica invertida para verse desde adentro
    const geometry = new THREE.SphereGeometry(450, 32, 32);

    // 2. Definición del ShaderMaterial personalizado con uniforms
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false, // El skydome es el fondo absoluto, no debe interferir con la profundidad
      uniforms: {
        u_time: { value: 0 },
        u_skyColor: { value: new THREE.Color(0xb2d9ea) },      // Celeste brillante zenit
        u_horizonColor: { value: new THREE.Color(0xf2f8fc) },  // Blanco/Celeste claro horizonte
        u_cloudSpeed: { value: 0.015 },
        u_weatherFactor: { value: 0.0 }                       // Factor de clima (0.0 = zen/despejado, 1.0 = lluvia/niebla)
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        uniform float u_time;
        uniform vec3 u_skyColor;
        uniform vec3 u_horizonColor;
        uniform float u_cloudSpeed;
        uniform float u_weatherFactor;

        // Ruido pseudo-aleatorio basado en hash
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        // Ruido bilinear de 2D
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        // Fractal Brownian Motion (FBM) para detalle de nubes
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          vec2 shift = vec2(100.0);
          // Matriz de rotación para reducir efectos de alineación de ejes
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = rot * p * 2.1 + shift;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          // Dirección normalizada del píxel en el domo
          vec3 dir = normalize(vWorldPosition);
          
          // Altitud proyectada (0.0 en el horizonte, 1.0 en la cumbre)
          float h = clamp(dir.y, 0.0, 1.0);
          
          // Degradado base del cielo interpolado según la altitud
          vec3 skyBase = mix(u_horizonColor, u_skyColor, h);
          
          // Coordenadas esféricas de proyección para las nubes en el plano superior
          vec2 cloudUV = dir.xz / (dir.y + 0.12);
          
          // Desplazamiento temporal para emular el viento procedimental
          vec2 wind = vec2(1.0, 0.3) * (u_time * u_cloudSpeed);
          
          // Mezcla de capas (FBM de múltiples frecuencias)
          float n1 = fbm(cloudUV * 0.45 + wind);
          float n2 = fbm(cloudUV * 1.0 - wind * 0.6);
          float combinedNoise = mix(n1, n2, 0.32);
          
          // Cobertura dinámica de nubes basada en el clima
          float coverage = mix(0.40, 0.62, u_weatherFactor);
          float sharpness = 0.18;
          
          float cloudAlpha = smoothstep(coverage, coverage + sharpness, combinedNoise);
          
          // Desvanecer nubes al acercarse al horizonte absoluto para un fundido fluido
          cloudAlpha *= smoothstep(0.0, 0.22, dir.y);
          
          // Coloración de las nubes (blancas/cálidas)
          vec3 cloudColor = vec3(0.97, 0.98, 1.0);
          
          // Sombreado de volumen sutil en la base
          cloudColor = mix(cloudColor * 0.88, cloudColor, h);
          
          // Oscurecer nubes en climas tormentosos (rain) o densos (fog)
          vec3 stormyCloudColor = vec3(0.38, 0.42, 0.48);
          cloudColor = mix(cloudColor, stormyCloudColor, u_weatherFactor * 0.55);
          
          // Composición final
          vec3 finalColor = mix(skyBase, cloudColor, cloudAlpha);
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    // 3. Crear la malla e incorporarla a la escena de Three.js
    this.mesh = new THREE.Mesh(geometry, this.material);
    scene.add(this.mesh);
  }

  /**
   * Actualiza el tiempo interno y las propiedades visuales del Skydome
   * @param deltaTime Tiempo transcurrido en el frame
   * @param carPosition Posición del vehículo (para seguirlo y simular horizonte infinito)
   * @param weather Clima actual
   * @param dayNightProgress Progreso del ciclo día-noche (0.0 a 1.0)
   */
  public update(
    deltaTime: number,
    carPosition: THREE.Vector3,
    weather: 'zen' | 'rain' | 'fog',
    dayNightProgress: number
  ): void {
    // 1. Sincronizar el skydome con la posición del auto
    this.mesh.position.copy(carPosition);

    // 2. Incrementar el reloj de animación procedural
    this.material.uniforms.u_time.value += deltaTime;

    // 3. Ajustar el factor climático del shader
    let targetWeatherFactor = 0.0;
    if (weather === 'rain') {
      targetWeatherFactor = 0.8;
    } else if (weather === 'fog') {
      targetWeatherFactor = 0.45;
    }

    // Suavizar transición del factor de clima en el shader
    this.material.uniforms.u_weatherFactor.value += (targetWeatherFactor - this.material.uniforms.u_weatherFactor.value) * 0.05;
  }

  /**
   * Establece dinámicamente los colores de cielo y horizonte
   */
  public setColors(skyColor: THREE.Color, horizonColor: THREE.Color): void {
    this.material.uniforms.u_skyColor.value.copy(skyColor);
    this.material.uniforms.u_horizonColor.value.copy(horizonColor);
  }

  /**
   * Destruye recursos para evitar fugas de memoria
   */
  public destroy(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
