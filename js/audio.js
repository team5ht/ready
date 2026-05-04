// Web Audio / HTMLAudio fallback и последовательности озвучки.
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitWithTimeout(promise, ms, fallbackValue = null) {
  let timer;
  const timeout = new Promise(resolve => {
    timer = setTimeout(() => resolve(fallbackValue), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function initAudioEngine() {
  if (audioEngine.useFallbackAudio) return false;

  if (!AudioContextClass) {
    audioEngine.useFallbackAudio = true;
    console.warn("Web Audio API is not available. Falling back to HTMLAudioElement.");
    return false;
  }

  if (!audioEngine.ctx) {
    audioEngine.ctx = new AudioContextClass();
  }

  try {
    if (audioEngine.ctx.state === "suspended") {
      await audioEngine.ctx.resume();
    }
    return audioEngine.ctx.state === "running" || audioEngine.ctx.state === "interrupted";
  } catch (err) {
    audioEngine.useFallbackAudio = true;
    console.warn("AudioContext resume failed. Falling back to HTMLAudioElement.", err);
    return false;
  }
}

async function unlockAudioEngine() {
  const ready = await initAudioEngine();
  if (!ready || !audioEngine.ctx) return false;

  try {
    const frameCount = Math.max(1, Math.floor(audioEngine.ctx.sampleRate * SILENCE_SECONDS));
    const silentBuffer = audioEngine.ctx.createBuffer(1, frameCount, audioEngine.ctx.sampleRate);
    const source = audioEngine.ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(audioEngine.ctx.destination);
    source.start(0);
    audioEngine.unlocked = true;
    return true;
  } catch (err) {
    console.warn("Audio unlock failed.", err);
    return false;
  }
}

async function fetchAudioBuffer(key, src) {
  if (!audioEngine.ctx) return null;

  try {
    const controller = audioLoadController ? new audioLoadController() : null;
    const fetchOptions = controller ? { cache: "force-cache", signal: controller.signal } : { cache: "force-cache" };
    const timeoutId = controller ? setTimeout(() => controller.abort(), AUDIO_LOAD_TIMEOUT_MS) : null;

    const response = await fetch(src, fetchOptions);
    if (timeoutId) clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const raw = await response.arrayBuffer();
    const decoded = await audioEngine.ctx.decodeAudioData(raw.slice(0));
    audioEngine.buffers.set(key, decoded);
    return decoded;
  } catch (err) {
    console.warn("Web Audio load failed:", key, src, err);
    return null;
  }
}

async function loadAllAudio() {
  if (audioEngine.useFallbackAudio || !audioEngine.ctx) return 0;
  if (audioEngine.loading) return audioEngine.loading;

  const entries = Object.entries(audioMap);
  audioEngine.loading = Promise.all(entries.map(([key, src]) => fetchAudioBuffer(key, src)))
    .then(() => audioEngine.buffers.size)
    .catch(err => {
      console.warn("Audio preload failed.", err);
      return audioEngine.buffers.size;
    });

  return audioEngine.loading;
}

async function prepareAudioEngine() {
  const unlocked = await unlockAudioEngine();
  if (!unlocked) return false;

  await loadAllAudio();
  return audioEngine.buffers.size > 0;
}

function stopActiveAudio() {
  if (audioEngine.currentHtmlAudio) {
    try {
      audioEngine.currentHtmlAudio.pause();
      audioEngine.currentHtmlAudio.currentTime = 0;
    } catch (e) {}
    audioEngine.currentHtmlAudio = null;
  }

  audioEngine.currentSources.forEach(source => {
    try { source.stop(0); } catch (e) {}
  });
  audioEngine.currentSources.clear();
}

function stopAudioSequence() {
  state.sequenceToken++;
  stopActiveAudio();
}

function playHtmlAudio(key) {
  const src = audioMap[key];

  if (!src) {
    console.warn("No audio source for key:", key);
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const audio = new Audio(src);
    audio.preload = "auto";
    audioEngine.currentHtmlAudio = audio;

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallbackTimer);
      if (audioEngine.currentHtmlAudio === audio) audioEngine.currentHtmlAudio = null;
      resolve();
    };

    const fallbackTimer = setTimeout(finish, AUDIO_FALLBACK_TIMEOUT_MS);

    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("pause", finish, { once: true });
    audio.addEventListener("error", () => {
      console.warn("HTMLAudio failed:", key, src);
      finish();
    }, { once: true });

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(err => {
        console.warn("HTMLAudio play blocked/failed:", key, err);
        finish();
      });
    }
  });
}

async function playWebAudio(key) {
  const src = audioMap[key];

  if (!src) {
    console.warn("No audio source for key:", key);
    return;
  }

  if (!audioEngine.ctx || audioEngine.useFallbackAudio) {
    return playHtmlAudio(key);
  }

  try {
    if (audioEngine.ctx.state === "suspended" || audioEngine.ctx.state === "interrupted") {
      await audioEngine.ctx.resume();
    }
  } catch (err) {
    console.warn("AudioContext resume before play failed:", err);
  }

  if (!audioEngine.loading) {
    loadAllAudio();
  }

  await audioEngine.loading;

  let buffer = audioEngine.buffers.get(key);
  if (!buffer) {
    buffer = await fetchAudioBuffer(key, src);
  }

  if (!buffer) {
    return playHtmlAudio(key);
  }

  return new Promise(resolve => {
    const source = audioEngine.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioEngine.ctx.destination);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(fallbackTimer);
      audioEngine.currentSources.delete(source);
      resolve();
    };

    const fallbackTimer = setTimeout(finish, Math.ceil(buffer.duration * 1000) + 700);
    source.onended = finish;
    audioEngine.currentSources.add(source);

    try {
      source.start(0);
    } catch (err) {
      console.warn("Web Audio play failed:", key, err);
      finish();
    }
  });
}

async function playAudio(key) {
  return playWebAudio(key);
}

async function playSequence(keys, pauseMs = 120) {
  stopActiveAudio();
  const token = ++state.sequenceToken;

  for (const key of keys) {
    if (token !== state.sequenceToken) return;
    await playAudio(key);
    if (token !== state.sequenceToken) return;
    await wait(pauseMs);
  }
}

function playTaskAudio(target) {
  return playSequence(["make_syllable", target], 130);
}

function playSuccessAudio(syllable) {
  return playSequence([syllable], 0);
}

function playFinalSuccessAudio() {
  return playSequence(["success"], 0);
}

function playCorrectionAudio(target) {
  return playSequence([target], 0);
}

function playErrorAudio(actual, target) {
  // Оставлено для совместимости старых вызовов: теперь ошибка озвучивает только правильный слог.
  return playCorrectionAudio(target);
}

