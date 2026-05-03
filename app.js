(() => {
  const consonants = ["М", "Б", "П", "Л", "С"];
  const vowels = ["А", "О", "У", "И"];
  const sessionLength = 7;

  // Файлы должны лежать рядом с HTML в папке audio/
  // Пример: index.html + audio/ma.mp3
  const audioMap = {
    make_syllable: "audio/make_syllable.mp3",
    need: "audio/need.mp3",
    success: "audio/success.mp3",

    "МА": "audio/ma.mp3",
    "МО": "audio/mo.mp3",
    "МУ": "audio/mu.mp3",
    "МИ": "audio/mi.mp3",

    "БА": "audio/ba.mp3",
    "БО": "audio/bo.mp3",
    "БУ": "audio/bu.mp3",
    "БИ": "audio/bi.mp3",

    "ПА": "audio/pa.mp3",
    "ПО": "audio/po.mp3",
    "ПУ": "audio/pu.mp3",
    "ПИ": "audio/pi.mp3",

    "ЛА": "audio/la.mp3",
    "ЛО": "audio/lo.mp3",
    "ЛУ": "audio/lu.mp3",
    "ЛИ": "audio/li.mp3",

    "СА": "audio/sa.mp3",
    "СО": "audio/so.mp3",
    "СУ": "audio/su.mp3",
    "СИ": "audio/si.mp3"
  };

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  const audioEngine = {
    ctx: null,
    buffers: new Map(),
    loading: null,
    currentSources: new Set(),
    currentHtmlAudio: null,
    unlocked: false,
    useFallbackAudio: false,
  };

  const START_BUTTON_TEXT = "▶ Начать";

  const START_LOADING_TEXT = "Загрузка…";

  const SILENCE_SECONDS = 0.03;

  const AUDIO_FALLBACK_TIMEOUT_MS = 5000;

  const AUDIO_LOAD_TIMEOUT_MS = 12000;

  const audioLoadController = typeof AbortController !== "undefined" ? AbortController : null;

  const state = {
    score: 0,
    step: 0,
    task: null,
    locked: false,
    drag: null,
    lastTaskKey: null,
    sequenceToken: 0,
    hintTimer: null,
  };

  const els = {
    screen: document.getElementById("screen"),
    speakBtn: document.getElementById("speakBtn"),
    dots: document.getElementById("dots"),
    score: document.getElementById("score"),
    prompt: document.getElementById("prompt"),
    hintToggle: document.getElementById("hintToggle"),
    hintAnswer: document.getElementById("hintAnswer"),
    sourceWrap: document.getElementById("sourceWrap"),
    sourceLetter: document.getElementById("sourceLetter"),
    options: document.getElementById("options"),
    resultCard: document.getElementById("resultCard"),
    resultSyllable: document.getElementById("resultSyllable"),
    resultText: document.getElementById("resultText"),
    starBurst: document.getElementById("starBurst"),
    startScreen: document.getElementById("startScreen"),
    startBtn: document.getElementById("startBtn"),
    miniPause: document.getElementById("miniPause"),
    pauseScore: document.getElementById("pauseScore"),
    continueBtn: document.getElementById("continueBtn"),
    againBtn: document.getElementById("againBtn"),
  };

  function shuffle(array) {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickDifferent(list, except) {
    const filtered = list.filter(x => x !== except);
    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  function generateTask() {
    let consonant, correct, wrong, key;

    // Небольшая защита от полного повтора предыдущего задания
    for (let i = 0; i < 10; i++) {
      consonant = consonants[Math.floor(Math.random() * consonants.length)];
      correct = vowels[Math.floor(Math.random() * vowels.length)];
      wrong = pickDifferent(vowels, correct);
      key = consonant + correct + wrong;
      if (key !== state.lastTaskKey) break;
    }

    state.lastTaskKey = key;

    // Иногда 3 варианта, чаще 2.
    let options = [correct, wrong];
    if (Math.random() < 0.25) {
      const remaining = vowels.filter(v => v !== correct && v !== wrong);
      const third = remaining[Math.floor(Math.random() * remaining.length)];
      options.push(third);
    }

    return {
      consonant,
      correct,
      target: consonant + correct,
      options: shuffle(options)
    };
  }

  function renderDots() {
    els.dots.innerHTML = "";
    for (let i = 0; i < sessionLength; i++) {
      const dot = document.createElement("div");
      dot.className = "dot" + (i < state.step ? " done" : "");
      els.dots.appendChild(dot);
    }
  }


  function resetHint(target) {
    if (state.hintTimer) clearTimeout(state.hintTimer);
    state.hintTimer = null;
    els.hintAnswer.hidden = true;
    els.hintAnswer.classList.remove("flash");
    els.hintAnswer.textContent = target;
    els.hintToggle.classList.remove("hint-active");
    els.hintToggle.setAttribute("aria-expanded", "false");
    clearHintHighlight();
  }

  function clearHintHighlight() {
    els.options.querySelectorAll(".hint-hot").forEach(o => o.classList.remove("hint-hot"));
  }

  function hideHint() {
    if (state.hintTimer) clearTimeout(state.hintTimer);
    state.hintTimer = null;
    els.hintAnswer.hidden = true;
    els.hintAnswer.classList.remove("flash");
    els.hintToggle.classList.remove("hint-active");
    els.hintToggle.setAttribute("aria-expanded", "false");
    clearHintHighlight();
  }

  function showHint() {
    if (!state.task || state.locked) return;

    if (state.hintTimer) clearTimeout(state.hintTimer);
    clearHintHighlight();

    els.hintAnswer.textContent = state.task.target;
    els.hintAnswer.hidden = false;
    els.hintAnswer.classList.remove("flash");
    void els.hintAnswer.offsetWidth;
    els.hintAnswer.classList.add("flash");
    els.hintToggle.classList.add("hint-active");
    els.hintToggle.setAttribute("aria-expanded", "true");

    const correctOption = els.options.querySelector(`.option[data-vowel="${state.task.correct}"]`);
    if (correctOption) correctOption.classList.add("hint-hot");

    state.hintTimer = setTimeout(hideHint, 1350);
  }

  function renderTask(task) {
    state.task = task;
    state.locked = false;

    resetHint(task.target);
    els.sourceLetter.textContent = task.consonant;
    resetSourcePosition();

    els.options.className = "options" + (task.options.length === 3 ? " three" : "");
    els.options.innerHTML = "";
    task.options.forEach(vowel => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.type = "button";
      btn.textContent = vowel;
      btn.dataset.vowel = vowel;
      btn.addEventListener("click", () => choose(vowel));
      els.options.appendChild(btn);
    });

    els.resultCard.classList.remove("show");
    els.starBurst.classList.remove("show");
    renderDots();
    playTaskAudio(task.target);
  }


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

  function playErrorAudio(actual, target) {
    // "МИ. Нужно МА."
    return playSequence([actual, "need", target], 170);
  }

  function coloredSyllable(consonant, vowel) {
    const optionIndex = state.task.options.indexOf(vowel);
    const cls = optionIndex === 0 ? "v1" : optionIndex === 1 ? "v2" : "v3";
    return `<span class="c">${consonant}</span><span class="${cls}">${vowel}</span>`;
  }

  async function choose(vowel) {
    if (state.locked) return;
    state.locked = true;
    stopAudioSequence();
    hideHint();

    clearHotOptions();

    const syllable = state.task.consonant + vowel;
    const target = state.task.target;
    const isCorrect = vowel === state.task.correct;

    els.resultSyllable.innerHTML = coloredSyllable(state.task.consonant, vowel);
    els.resultCard.classList.add("show");

    if (isCorrect) {
      els.resultText.className = "result-text good";
      els.resultText.textContent = syllable;
      state.score += 1;
      state.step += 1;
      els.score.textContent = state.score;
      burst();

      // Ждём фактического окончания файла слога.
      await playSuccessAudio(syllable);
      await wait(250);

      if (state.step >= sessionLength) {
        showPause();
        await playFinalSuccessAudio();
      } else {
        renderTask(generateTask());
      }
    } else {
      els.resultText.className = "result-text bad";
      els.resultText.textContent = `Нужно ${target}`;
      els.screen.classList.add("shake");

      // Ждём полную цепочку: [ошибочный слог] → [need] → [цель].
      // Никаких фиксированных 1500 мс.
      await playErrorAudio(syllable, target);
      await wait(250);

      els.screen.classList.remove("shake");
      els.resultCard.classList.remove("show");
      resetSourcePosition();
      state.locked = false;

      // Повтор задания начинается только после полного окончания ошибки.
      await playTaskAudio(target);
    }
  }

  function burst() {
    els.starBurst.innerHTML = "";
    const positions = [
      [20, 24], [72, 20], [18, 58], [78, 56], [48, 16], [52, 64]
    ];
    positions.forEach(([x, y], i) => {
      const star = document.createElement("div");
      star.className = "burst-star";
      star.textContent = "⭐";
      star.style.left = `${x}%`;
      star.style.top = `${y}%`;
      star.style.animationDelay = `${i * 45}ms`;
      els.starBurst.appendChild(star);
    });
    els.starBurst.classList.add("show");
    setTimeout(() => els.starBurst.classList.remove("show"), 750);
  }

  function showPause() {
    renderDots();
    els.pauseScore.textContent = state.score;
    els.miniPause.hidden = false;
  }

  function newSession(resetScore = false) {
    stopAudioSequence();

    if (resetScore) state.score = 0;
    state.step = 0;
    els.score.textContent = state.score;
    els.miniPause.hidden = true;
    renderTask(generateTask());
  }

  function resetSourcePosition() {
    els.sourceLetter.style.transform = "";
    els.sourceLetter.classList.remove("dragging");
    els.sourceWrap.classList.remove("dragging");
  }

  function clearHotOptions() {
    els.options.querySelectorAll(".option").forEach(o => o.classList.remove("hot", "hint-hot"));
  }

  function optionAtPoint(x, y) {
    const options = [...els.options.querySelectorAll(".option")];
    return options.find(el => {
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
  }

  function getClientPoint(e) {
    const touch = e.changedTouches && e.changedTouches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function beginDrag(x, y, pointerId = "touch") {
    if (state.locked) return;

    const r = els.sourceLetter.getBoundingClientRect();
    state.drag = {
      pointerId,
      startX: x,
      startY: y,
      baseLeft: r.left,
      baseTop: r.top,
    };

    els.sourceLetter.classList.add("dragging");
    els.sourceWrap.classList.add("dragging");
  }

  function moveDrag(x, y, pointerId = "touch") {
    if (!state.drag || state.drag.pointerId !== pointerId || state.locked) return;

    const dx = x - state.drag.startX;
    const dy = y - state.drag.startY;

    els.sourceLetter.style.transform = `translate(${dx}px, ${dy}px) scale(1.05)`;

    clearHotOptions();
    const hot = optionAtPoint(x, y);
    if (hot) hot.classList.add("hot");
  }

  function endDrag(x, y, pointerId = "touch") {
    if (!state.drag || state.drag.pointerId !== pointerId || state.locked) return;

    const target = optionAtPoint(x, y);
    state.drag = null;
    els.sourceLetter.classList.remove("dragging");

    if (target) {
      // Важно: на iOS Safari этот вызов происходит прямо внутри touchend.
      // Так audio.play() чаще считается результатом пользовательского действия.
      choose(target.dataset.vowel);
    } else {
      resetSourcePosition();
      clearHotOptions();
    }
  }

  function onPointerDown(e) {
    // На iOS Safari есть отдельные touch handlers ниже.
    // Чтобы не было двойной обработки, pointer-ветку используем в основном для мыши/стилуса/desktop.
    if (e.pointerType === "touch") return;
    if (state.locked) return;
    e.preventDefault();

    beginDrag(e.clientX, e.clientY, e.pointerId);
    els.sourceLetter.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (e.pointerType === "touch") return;
    if (!state.drag || state.drag.pointerId !== e.pointerId || state.locked) return;
    e.preventDefault();

    moveDrag(e.clientX, e.clientY, e.pointerId);
  }

  function onPointerUp(e) {
    if (e.pointerType === "touch") return;
    if (!state.drag || state.drag.pointerId !== e.pointerId || state.locked) return;
    e.preventDefault();

    endDrag(e.clientX, e.clientY, e.pointerId);
  }

  function onTouchStart(e) {
    if (state.locked) return;
    e.preventDefault();

    const p = getClientPoint(e);
    beginDrag(p.x, p.y, "touch");
  }

  function onTouchMove(e) {
    if (!state.drag || state.drag.pointerId !== "touch" || state.locked) return;
    e.preventDefault();

    const p = getClientPoint(e);
    moveDrag(p.x, p.y, "touch");
  }

  function onTouchEnd(e) {
    if (!state.drag || state.drag.pointerId !== "touch" || state.locked) return;
    e.preventDefault();

    const p = getClientPoint(e);
    endDrag(p.x, p.y, "touch");
  }

  els.sourceLetter.addEventListener("pointerdown", onPointerDown);
  els.sourceLetter.addEventListener("pointermove", onPointerMove);
  els.sourceLetter.addEventListener("pointerup", onPointerUp);
  els.sourceLetter.addEventListener("pointercancel", onPointerUp);

  // iOS Safari надёжнее считает touchend прямым пользовательским действием для аудио.
  els.sourceLetter.addEventListener("touchstart", onTouchStart, { passive: false });
  els.sourceLetter.addEventListener("touchmove", onTouchMove, { passive: false });
  els.sourceLetter.addEventListener("touchend", onTouchEnd, { passive: false });
  els.sourceLetter.addEventListener("touchcancel", onTouchEnd, { passive: false });

  els.speakBtn.addEventListener("click", () => {
    if (state.locked || !state.task || !els.miniPause.hidden) return;

    stopAudioSequence();
    playTaskAudio(state.task.target);
  });

  els.hintToggle.addEventListener("click", () => {
    showHint();
  });

  els.startBtn.addEventListener("click", async () => {
    if (els.startBtn.disabled) return;

    els.startBtn.disabled = true;
    els.startBtn.textContent = START_LOADING_TEXT;

    await waitWithTimeout(prepareAudioEngine(), AUDIO_LOAD_TIMEOUT_MS + 2000, false);

    els.startBtn.textContent = START_BUTTON_TEXT;
    els.startBtn.disabled = false;
    els.startScreen.hidden = true;
    newSession(true);
  });

  els.continueBtn.addEventListener("click", () => newSession(false));
  els.againBtn.addEventListener("click", () => newSession(true));

  renderDots();
})();
