// Main Entry Point for Zen Infinite Driving Game
import { ZenEngine } from './src/ZenEngine.ts';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (!container) {
    console.error('El contenedor #canvas-container no se encontró en el DOM.');
    return;
  }

  // Instanciador OOP del Motor de Render con Three.js
  const engine = new ZenEngine(container);

  // Inicialización de audio autogestionada sin overlays molestos en el primer gesto de interacción
  const unlockAudio = async () => {
    if (engine.audioService && !engine.audioService.isInitialized()) {
      await engine.audioService.start();
    }
    // Remover listeners una vez activados
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Iniciar la animación y el bucle de renderizado optimizado
  engine.start();

  // Escuchar el evento de redimensionado dinámico
  window.addEventListener('resize', () => {
    engine.handleResize(window.innerWidth, window.innerHeight);
  });

  // UI Interactive Element Selection
  const btnToggleEngine = document.getElementById('btn-toggle-engine');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleLabel = document.getElementById('toggle-label');
  const telemetrySpeed = document.getElementById('telemetry-speed');
  const telemetrySpeedBar = document.getElementById('telemetry-speed-bar');
  const telemetryDistance = document.getElementById('telemetry-distance');
  const statusTag = document.getElementById('status-tag');

  if (btnToggleEngine) {
    btnToggleEngine.addEventListener('click', () => {
      engine.isRunning = !engine.isRunning;

      if (engine.isRunning) {
        // Toggle to active running state
        if (toggleIcon) {
          toggleIcon.innerHTML = `
            <div class="flex gap-1.5 justify-center items-center">
              <div class="w-[5px] h-[15px] bg-[#2C2C2C] rounded-sm"></div>
              <div class="w-[5px] h-[15px] bg-[#2C2C2C] rounded-sm"></div>
            </div>
          `;
        }
        if (toggleLabel) {
          toggleLabel.textContent = 'Halt Engine';
        }
        if (statusTag) {
          statusTag.textContent = 'Zen Cruising';
          statusTag.className = "bg-[#34d399] text-[#0d0d1a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-300";
        }
      } else {
        // Toggle to idle state
        if (toggleIcon) {
          toggleIcon.innerHTML = `
            <div class="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-[#2C2C2C] border-b-[8px] border-b-transparent ml-1"></div>
          `;
        }
        if (toggleLabel) {
          toggleLabel.textContent = 'Initialize Engine';
        }
        if (statusTag) {
          statusTag.textContent = 'System Ready';
          statusTag.className = "bg-[#2C2C2C] text-[#F4F1EA] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-300";
        }
      }
    });
  }

  // Periodic Telemetry Update loop matching requestAnimationFrame smoothness
  function updateTelemetry() {
    // Round speed to display as safe integers
    const speedInt = Math.floor(engine.speed);
    if (telemetrySpeed) {
      telemetrySpeed.textContent = speedInt.toString().padStart(2, '0');
    }

    // Dynamic telemetry speed line bar width calculation (Cruising max is 90)
    if (telemetrySpeedBar) {
      const percentage = Math.min((engine.speed / 90) * 100, 100);
      telemetrySpeedBar.style.width = `${percentage}%`;
    }

    // Round distance telemetry to neat high precision decimal format
    if (telemetryDistance) {
      telemetryDistance.textContent = `${engine.distance.toFixed(2).padStart(6, '0')} KM`;
    }

    requestAnimationFrame(updateTelemetry);
  }

  updateTelemetry();
});
