// Main Entry Point for Zen Infinite Driving Game
import { ZenEngine } from './src/ZenEngine.ts';
import { FirebaseService } from './src/FirebaseService.ts';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  if (!container) {
    console.error('El contenedor #canvas-container no se encontró en el DOM.');
    return;
  }

  // UI Interactive Element Selection
  const telemetrySpeed = document.getElementById('telemetry-speed');
  const telemetrySpeedBar = document.getElementById('telemetry-speed-bar');
  const telemetryDistance = document.getElementById('telemetry-distance');
  const telemetryHighscore = document.getElementById('telemetry-highscore');
  const statusTag = document.getElementById('status-tag');

  // Weather toggle elements
  const btnWeatherZen = document.getElementById('btn-weather-zen');
  const btnWeatherRain = document.getElementById('btn-weather-rain');
  const btnWeatherFog = document.getElementById('btn-weather-fog');

  // Firebase elements
  const loginOverlay = document.getElementById('login-overlay');
  const btnLogin = document.getElementById('btn-login');
  const loginLoading = document.getElementById('login-loading');
  const userChip = document.getElementById('user-chip');
  const userDisplay = document.getElementById('user-display');
  const btnLogout = document.getElementById('btn-logout');

  // Instanciador OOP del Motor de Render con Three.js
  const engine = new ZenEngine(container);

  // Instanciador de Servicio Firebase OOP
  const firebaseService = new FirebaseService();

  let engineStarted = false;
  let currentUser = null;
  let currentHighScore = 0.0;
  let saveTimeout = null;

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

  // Escuchar el evento de redimensionado dinámico
  window.addEventListener('resize', () => {
    engine.handleResize(window.innerWidth, window.innerHeight);
  });

  // Guardado de High Score optimizado (Debounced a 2 segundos de inactividad)
  function saveHighScoreDebounced(userId, email, score) {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      try {
        await firebaseService.saveUserHighScore(userId, email, score);
        console.log('Récord guardado con éxito en Firebase Cosmos:', score.toFixed(2));
      } catch (error) {
        console.error('Error al guardar el récord en Firebase:', error);
      }
    }, 2000); // 2 segundos de calma antes de impactar la base de datos
  }

  // Reactividad al Estado de Autenticación de Firebase
  firebaseService.onAuthStateChange(async (user) => {
    currentUser = user;
    if (user) {
      // 1. Ocultar Overlay de Login con animación
      if (loginOverlay) {
        loginOverlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
          loginOverlay.classList.add('hidden');
        }, 700);
      }

      // 2. Mostrar la tarjeta de información del usuario
      if (userChip && userDisplay) {
        userChip.classList.remove('hidden');
        userChip.classList.add('flex');
        userDisplay.textContent = user.displayName || user.email;
      }

      // 3. Cargar el High Score actual del jugador
      try {
        currentHighScore = await firebaseService.getUserHighScore(user.uid);
        if (telemetryHighscore) {
          telemetryHighscore.textContent = `${currentHighScore.toFixed(2).padStart(6, '0')} KM`;
        }
      } catch (err) {
        console.error('Error cargando high score inicial:', err);
        currentHighScore = 0.0;
        if (telemetryHighscore) {
          telemetryHighscore.textContent = '000.00 KM';
        }
      }

      // 4. Iniciar la simulación del mundo si no se ha hecho aún
      if (!engineStarted) {
        engine.start();
        updateTelemetry();
        engineStarted = true;
      } else {
        engine.start(); // Reanudar simulación si venía de un logout
      }
    } else {
      // Usuario deslogueado: mostrar login y pausar simulación
      if (loginOverlay) {
        loginOverlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
      }
      if (btnLogin) {
        btnLogin.classList.remove('hidden');
      }
      if (loginLoading) {
        loginLoading.classList.add('hidden');
      }
      if (userChip) {
        userChip.classList.add('hidden');
        userChip.classList.remove('flex');
      }
      if (telemetryHighscore) {
        telemetryHighscore.textContent = '000.00 KM';
      }

      engine.stop();
    }
  });

  // Evento de Login con Google (Popup amigable con iFrame de Vista Previa)
  if (btnLogin) {
    btnLogin.addEventListener('click', async () => {
      btnLogin.classList.add('hidden');
      if (loginLoading) {
        loginLoading.classList.remove('hidden');
      }
      try {
        await firebaseService.signInWithGoogle();
      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        btnLogin.classList.remove('hidden');
        if (loginLoading) {
          loginLoading.classList.add('hidden');
        }
      }
    });
  }

  // Evento de Cierre de Sesión (Logout)
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (confirm('¿Deseas cerrar tu sesión actual?')) {
        try {
          if (saveTimeout) {
            clearTimeout(saveTimeout);
          }
          await firebaseService.signOut();
          
          // Reiniciar progreso local de forma limpia para el siguiente usuario
          engine.distance = 0;
          if (engine.vehicle) {
            const startX = engine.elevationService.getRoadCenter(0);
            const startY = engine.elevationService.getElevation(startX, 0) + 1.2;
            engine.vehicle.chassisBody.position.set(startX, startY, 0);
            engine.vehicle.chassisBody.velocity.set(0, 0, 0);
            engine.vehicle.chassisBody.angularVelocity.set(0, 0, 0);
            engine.vehicle.chassisBody.quaternion.set(0, 0, 0, 1);
          }
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
        }
      }
    });
  }

  function setWeatherUI(activeWeather) {
    const buttons = [
      { id: 'zen', btn: btnWeatherZen },
      { id: 'rain', btn: btnWeatherRain },
      { id: 'fog', btn: btnWeatherFog }
    ];

    buttons.forEach(({ id, btn }) => {
      if (!btn) return;
      if (id === activeWeather) {
        btn.className = 'px-3.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-300 bg-[#2C2C2C] text-[#F4F1EA] hover:scale-105 cursor-pointer';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all duration-300 text-[#2C2C2C]/60 hover:text-[#2C2C2C] hover:scale-105 cursor-pointer';
      }
    });

    if (statusTag) {
      if (activeWeather === 'zen') {
        statusTag.textContent = 'Zen Cruising';
        statusTag.className = 'bg-[#34d399] text-[#0d0d1a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-300';
      } else if (activeWeather === 'rain') {
        statusTag.textContent = 'Rainy Drive';
        statusTag.className = 'bg-[#60a5fa] text-[#0d0d1a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-300';
      } else if (activeWeather === 'fog') {
        statusTag.textContent = 'Morning Fog';
        statusTag.className = 'bg-[#94a3b8] text-[#0d0d1a] px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all duration-300';
      }
    }
  }

  if (btnWeatherZen) {
    btnWeatherZen.addEventListener('click', () => {
      engine.setWeather('zen');
      setWeatherUI('zen');
    });
  }

  if (btnWeatherRain) {
    btnWeatherRain.addEventListener('click', () => {
      engine.setWeather('rain');
      setWeatherUI('rain');
    });
  }

  if (btnWeatherFog) {
    btnWeatherFog.addEventListener('click', () => {
      engine.setWeather('fog');
      setWeatherUI('fog');
    });
  }

  // Establecer el clima Zen de forma predeterminada al iniciar
  engine.setWeather('zen');
  setWeatherUI('zen');

  // Periodic Telemetry Update loop matching requestAnimationFrame smoothness
  function updateTelemetry() {
    if (!currentUser) return; // Detener actualizaciones visuales si no hay usuario activo

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

    // Evaluar y guardar nuevo récord si se supera el score histórico del jugador
    if (engine.distance > currentHighScore) {
      currentHighScore = engine.distance;
      if (telemetryHighscore) {
        telemetryHighscore.textContent = `${currentHighScore.toFixed(2).padStart(6, '0')} KM`;
      }
      saveHighScoreDebounced(currentUser.uid, currentUser.email || `${currentUser.uid}@anon.com`, currentHighScore);
    }

    requestAnimationFrame(updateTelemetry);
  }
});

