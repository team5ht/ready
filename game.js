// Генерация заданий, рендер, подсказки и игровая логика.
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

