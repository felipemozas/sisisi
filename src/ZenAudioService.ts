/**
 * Clase ZenAudioService (Capa de Servicio)
 * Diseñado por un Ingeniero de Audio Técnico especializado en JavaScript y Web Audio API.
 * Gestiona de forma completamente procedural (sin assets externos) un ronroneo de motor
 * híbrido/eléctrico relajante y un sutil silbido de brisa de viento zen, totalmente dinámicos.
 */
export class ZenAudioService {
  private ctx: AudioContext | null = null;
  private primaryOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private mainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windBufferSource: AudioBufferSourceNode | null = null;

  // Variables para suavizar cambios (interpolación linear de audio)
  private targetFreq: number = 32;
  private currentFreq: number = 32;
  private targetGain: number = 0;
  private currentGain: number = 0;
  private targetWindGain: number = 0;
  private currentWindGain: number = 0;

  // Sistema de audio ambiental sutil (Viento costero y pájaros)
  private weather: 'zen' | 'rain' | 'fog' = 'zen';
  private ambientWindGain: GainNode | null = null;
  private ambientWindFilter: BiquadFilterNode | null = null;
  private ambientWindBufferSource: AudioBufferSourceNode | null = null;
  private ambientWindLFO: OscillatorNode | null = null;
  private birdTimeoutId: any = null;

  constructor() {}

  /**
   * Determina si el servicio ya ha sido instanciado por el usuario
   */
  public isInitialized(): boolean {
    return this.ctx !== null;
  }

  /**
   * Inicializa el AudioContext y las fuentes de síntesis tras una interacción explícita del usuario.
   * Esto previene bloqueos por políticas de auto-reproducción de navegadores web modernos.
   */
  public async start(): Promise<void> {
    if (this.ctx) return;

    // Compatibilidad multi-navegador segura
    const globalObj: any = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
    const AudioContextClass = globalObj.AudioContext || globalObj.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('La Web Audio API no está soportada en este navegador.');
      return;
    }

    try {
      this.ctx = new AudioContextClass();

      // 1. Control de volumen del motor principal
      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      // 2. Filtro paso-bajo para garantizar un tono sordo, cálido, pacífico y libre de frecuencias agudas
      this.lowpassFilter = this.ctx.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(110, this.ctx.currentTime);

      // 3. Oscilador Primario (Tipo Sawtooth para implemetar el sonido mecánico de baja frecuencia)
      this.primaryOsc = this.ctx.createOscillator();
      this.primaryOsc.type = 'sawtooth';
      this.primaryOsc.frequency.setValueAtTime(32, this.ctx.currentTime);

      // 4. Oscilador Secundario Sub-Bajo (Onda Sine limpia para dotar al motor de un empuje cinético orgánico y súper relajado)
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.setValueAtTime(16, this.ctx.currentTime);

      // Interconexión del Motor: Osciladores -> Filtro -> Control de Volumen -> Salida de Audio
      this.primaryOsc.connect(this.lowpassFilter);
      this.subOsc.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.mainGain);
      this.mainGain.connect(this.ctx.destination);

      // Arrancar generadores
      this.primaryOsc.start(0);
      this.subOsc.start(0);

      // 5. Generador de Silbido de Viento Procedural en tiempo real (ligado a velocidad)
      this.initProceduralWind();

      // 6. Generador de Viento Costero Ambiental (permanente, con vaivén LFO)
      this.initAmbientCoastalWind();

      // 7. Planificar el primer canto de pájaro
      this.scheduleNextBirdChirp();

      // Asegurar reanudación en caso de estar inicialmente suspendido
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch (e) {
      console.error('Error al inicializar el motor de audio procedural:', e);
    }
  }

  /**
   * Inicializa un búfer de ruido blanco con un filtro pasa-bajos cerrado para simular la brisa del viento
   */
  private initProceduralWind(): void {
    if (!this.ctx) return;

    try {
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 2.5; // 2.5 segundos de ruido aleatorio no repetitivo
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2.0 - 1.0;
      }

      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      // Un filtro paso-bajo cerrado convierte el silbido estático en una brisa atmosférica reconfortante
      const windBreezeFilter = this.ctx.createBiquadFilter();
      windBreezeFilter.type = 'lowpass';
      windBreezeFilter.frequency.setValueAtTime(260, this.ctx.currentTime);

      this.windBufferSource = this.ctx.createBufferSource();
      this.windBufferSource.buffer = buffer;
      this.windBufferSource.loop = true;

      // Conexiones: Ruido -> Filtro Aire -> Control de Aire -> Salida de Audio general
      this.windBufferSource.connect(windBreezeFilter);
      windBreezeFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);

      this.windBufferSource.start(0);
    } catch (e) {
      console.error('Imposible sintetizar la brisa de viento procedural:', e);
    }
  }

  /**
   * Inicializa el oleaje y viento costero ambiental continuo usando LFO
   */
  private initAmbientCoastalWind(): void {
    if (!this.ctx) return;

    try {
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 4.0; // 4 segundos de ruido blanco
      const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2.0 - 1.0;
      }

      this.ambientWindGain = this.ctx.createGain();
      // En modo Zen la intensidad inicial es ligeramente mayor (0.045) para mayor paz
      const initialVol = this.weather === 'zen' ? 0.045 : 0.025;
      this.ambientWindGain.gain.setValueAtTime(initialVol, this.ctx.currentTime);

      this.ambientWindFilter = this.ctx.createBiquadFilter();
      this.ambientWindFilter.type = 'lowpass';
      this.ambientWindFilter.frequency.setValueAtTime(200, this.ctx.currentTime);
      this.ambientWindFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      // LFO para oscilar lentamente el filtro simulando el vaivén de las olas
      this.ambientWindLFO = this.ctx.createOscillator();
      this.ambientWindLFO.type = 'sine';
      this.ambientWindLFO.frequency.setValueAtTime(0.06, this.ctx.currentTime); // ~16.6s por ola

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(110, this.ctx.currentTime); // Oscilación de +- 110Hz

      this.ambientWindBufferSource = this.ctx.createBufferSource();
      this.ambientWindBufferSource.buffer = buffer;
      this.ambientWindBufferSource.loop = true;

      // Conexiones
      this.ambientWindLFO.connect(lfoGain);
      lfoGain.connect(this.ambientWindFilter.frequency);

      this.ambientWindBufferSource.connect(this.ambientWindFilter);
      this.ambientWindFilter.connect(this.ambientWindGain);
      this.ambientWindGain.connect(this.ctx.destination);

      this.ambientWindLFO.start(0);
      this.ambientWindBufferSource.start(0);
    } catch (e) {
      console.error('No se pudo iniciar el viento ambiental costero:', e);
    }
  }

  /**
   * Planifica el siguiente canto de pájaro de forma asíncrona y aleatoria
   */
  private scheduleNextBirdChirp(): void {
    if (!this.ctx) return;

    if (this.birdTimeoutId) {
      clearTimeout(this.birdTimeoutId);
    }

    // Definición de retardos basados en el modo del clima
    // Zen: Muy frecuentes (3.5 - 7 segundos) para sumergir al jugador
    // Fog: Dispersos y pausados (8 - 15 segundos)
    // Rain: Silencio total (los pájaros se resguardan)
    let minDelay = 3500;
    let maxDelay = 7000;

    if (this.weather === 'fog') {
      minDelay = 8000;
      maxDelay = 15000;
    } else if (this.weather === 'rain') {
      return; // Fin de la planificación durante la lluvia
    }

    const delay = minDelay + Math.random() * (maxDelay - minDelay);

    this.birdTimeoutId = setTimeout(() => {
      this.playBirdChirp();
      this.scheduleNextBirdChirp();
    }, delay);
  }

  /**
   * Sintetiza trinos de pájaros de forma completamente procedural
   */
  private playBirdChirp(): void {
    if (!this.ctx || this.ctx.state === 'suspended' || this.weather === 'rain') return;

    try {
      const now = this.ctx.currentTime;
      // Ráfaga natural de 1 a 3 trinos cortos continuos
      const trills = Math.floor(Math.random() * 3) + 1;
      let timeOffset = 0;

      for (let j = 0; j < trills; j++) {
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = 'sine';
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        const duration = 0.08 + Math.random() * 0.06; // 80ms - 140ms
        const startTime = now + timeOffset;
        const endTime = startTime + duration;

        // Frecuencias agudas y agradables de pajarillos silvestres
        const baseFreq = 2300 + Math.random() * 600; 
        const peakFreq = baseFreq + 1100 + Math.random() * 900; 

        // Volumen súper sutil para que de verdad sea relajante y de fondo
        // El modo Zen tiene una intensidad sutilmente mayor (0.02) vs Fog (0.01) para mayor riqueza
        const maxVol = this.weather === 'zen' ? 0.022 : 0.011;

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(maxVol, startTime + duration * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

        const chirpStyle = Math.random();
        if (chirpStyle < 0.45) {
          // Barrido ascendente
          osc.frequency.setValueAtTime(baseFreq, startTime);
          osc.frequency.exponentialRampToValueAtTime(peakFreq, endTime);
        } else if (chirpStyle < 0.8) {
          // Barrido descendente (silbido dulce)
          osc.frequency.setValueAtTime(peakFreq, startTime);
          osc.frequency.exponentialRampToValueAtTime(baseFreq, endTime);
        } else {
          // Inflexión (gorjeo rápido que sube y baja)
          osc.frequency.setValueAtTime(baseFreq, startTime);
          osc.frequency.linearRampToValueAtTime(peakFreq, startTime + duration * 0.4);
          osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, endTime);
        }

        osc.start(startTime);
        osc.stop(endTime);

        timeOffset += duration + 0.08 + Math.random() * 0.12;
      }
    } catch (e) {
      console.error('Error al sintetizar el canto procedural del ave:', e);
    }
  }

  /**
   * Cambia el clima en el servicio de audio adaptando la brisa costera y programando los pájaros
   */
  public setWeather(weather: 'zen' | 'rain' | 'fog'): void {
    const prevWeather = this.weather;
    this.weather = weather;

    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Actualización de ganancia del viento ambiental continuo con rampa lineal suave de 1.5s
    if (this.ambientWindGain) {
      let targetVol = 0.025;
      if (weather === 'zen') {
        targetVol = 0.045; // El modo zen tiene viento costero más presente y profundo
      } else if (weather === 'rain') {
        targetVol = 0.015; // Menor viento costero puro (se mezcla con la tormenta)
      } else if (weather === 'fog') {
        targetVol = 0.025; // Brisa fresca pero mansa de niebla
      }
      this.ambientWindGain.gain.cancelScheduledValues(now);
      this.ambientWindGain.gain.linearRampToValueAtTime(targetVol, now + 1.5);
    }

    // Gestión del temporizador y presencia de pájaros
    if (weather === 'rain') {
      if (this.birdTimeoutId) {
        clearTimeout(this.birdTimeoutId);
        this.birdTimeoutId = null;
      }
    } else {
      if (prevWeather === 'rain' && !this.birdTimeoutId) {
        this.scheduleNextBirdChirp();
      } else {
        // Volver a planificar con los nuevos tiempos del modo actual
        this.scheduleNextBirdChirp();
      }
    }
  }

  /**
   * Actualiza los parámetros de tono (frecuencia), filtro y ganancia de forma fluida
   * basándose de manera continua en la velocidad cinemática del vehículo.
   */
  public update(speed: number): void {
    if (!this.ctx || !this.mainGain || !this.primaryOsc || !this.subOsc || !this.lowpassFilter) {
      return;
    }

    // Asegurar valor absoluto en caso de retrocesos bruscos
    const absSpeed = Math.abs(speed);

    // Mapeo dinámico de RPM simuladas (Ralentí: 800 RPM, Velocidad Crucero: 4200 RPM)
    const rpm = 800 + Math.min(absSpeed / 90.0, 1.2) * 3400;

    // Pitch: Frecuencia aumenta de forma cómoda y muy progresiva
    this.targetFreq = 26 + (rpm / 4200) * 44; // De 26Hz a 70Hz (tonos bajos reconfortantes)

    // Ajuste de filtro para dar mayor claridad mecánica a grandes velocidades
    const filterCutoff = 100 + (rpm / 4200) * 140;

    // Ganancia de motor: sutil aumento de volumen al acelerar sin ser invasiva (0.015 a 0.16)
    this.targetGain = 0.015 + Math.min(absSpeed / 90.0, 1.0) * 0.145;

    // Doble interpolación lineal para prevenir saturaciones y "clips"
    this.currentFreq += (this.targetFreq - this.currentFreq) * 0.08;
    this.currentGain += (this.targetGain - this.currentGain) * 0.08;

    this.primaryOsc.frequency.setValueAtTime(this.currentFreq, this.ctx.currentTime);
    this.subOsc.frequency.setValueAtTime(this.currentFreq * 0.5, this.ctx.currentTime); // Una octava por debajo para solidez
    this.lowpassFilter.frequency.setValueAtTime(filterCutoff, this.ctx.currentTime);
    this.mainGain.gain.setValueAtTime(this.currentGain, this.ctx.currentTime);

    // Ajuste del generador de brisa atmosférica (viento sutil a velocidades > 12)
    if (this.windGain) {
      if (absSpeed > 12.0) {
        this.targetWindGain = Math.min((absSpeed - 12.0) / 78.0, 1.0) * 0.055;
      } else {
        this.targetWindGain = 0.0;
      }
      this.currentWindGain += (this.targetWindGain - this.currentWindGain) * 0.04;
      this.windGain.gain.setValueAtTime(this.currentWindGain, this.ctx.currentTime);
    }
  }

  /**
   * Libera permanentemente los recursos de audio para prevenir memory leaks
   */
  public stop(): void {
    if (this.birdTimeoutId) {
      clearTimeout(this.birdTimeoutId);
      this.birdTimeoutId = null;
    }

    if (this.ctx) {
      try {
        if (this.primaryOsc) {
          this.primaryOsc.stop();
        }
        if (this.subOsc) {
          this.subOsc.stop();
        }
        if (this.windBufferSource) {
          this.windBufferSource.stop();
        }
        if (this.ambientWindBufferSource) {
          this.ambientWindBufferSource.stop();
        }
        if (this.ambientWindLFO) {
          this.ambientWindLFO.stop();
        }
      } catch (err) {}

      this.ctx.close();
      this.ctx = null;
      this.primaryOsc = null;
      this.subOsc = null;
      this.lowpassFilter = null;
      this.mainGain = null;
      this.windGain = null;
      this.windBufferSource = null;
      this.ambientWindGain = null;
      this.ambientWindFilter = null;
      this.ambientWindBufferSource = null;
      this.ambientWindLFO = null;
    }
  }
}
