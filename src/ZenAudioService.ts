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

      // 5. Generador de Silbido de Viento Procedural en tiempo real
      this.initProceduralWind();

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
      } catch (err) {}

      this.ctx.close();
      this.ctx = null;
      this.primaryOsc = null;
      this.subOsc = null;
      this.lowpassFilter = null;
      this.mainGain = null;
      this.windGain = null;
      this.windBufferSource = null;
    }
  }
}
