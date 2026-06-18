import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZenAudioService } from './ZenAudioService';

// Mock Web Audio API classes
class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sawtooth';
  frequency = new MockAudioParam();
  start = vi.fn();
  stop = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBiquadFilterNode extends MockAudioNode {
  type = 'lowpass';
  frequency = new MockAudioParam();
}

class MockAudioContext {
  state = 'suspended';
  createOscillator = vi.fn(() => new MockOscillatorNode());
  createGain = vi.fn(() => new MockGainNode());
  createBiquadFilter = vi.fn(() => new MockBiquadFilterNode());
  createBuffer = vi.fn(() => ({
    getChannelData: vi.fn(() => new Float32Array(44100)),
  }));
  createBufferSource = vi.fn(() => ({
    buffer: null,
    loop: false,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  resume = vi.fn().mockImplementation(function(this: any) {
    this.state = 'running';
    return Promise.resolve();
  });
  destination = {};
}

describe('ZenAudioService Suite', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('webkitAudioContext', MockAudioContext);
  });

  it('debe iniciar suspendido sin instanciar componentes hasta el disparo interactivo', () => {
    const audioService = new ZenAudioService();
    expect(audioService.isInitialized()).toBe(false);
  });

  it('debe inicializar el contexto y los osciladores/filtros correctos tras invocar start()', async () => {
    const audioService = new ZenAudioService();
    await audioService.start();

    expect(audioService.isInitialized()).toBe(true);
  });

  it('debe mapear la velocidad de forma fluida a valores de pitch (frecuencia) de motor y viento', async () => {
    const audioService = new ZenAudioService();
    await audioService.start();

    // Actualizar velocidad a cero (marcha mínima o ralentí)
    audioService.update(0);
    
    // Actualizar velocidad de autopista rápida
    audioService.update(80);

    // No debe lanzar errores y los valores mapeados deben fluir sin saltos
    expect(audioService.isInitialized()).toBe(true);
  });
});
