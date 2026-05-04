// Кнопки остаются понятными для screen reader и взрослого просмотра DOM,
// но ребёнок видит только крупный символ.
function setIconButton(button, icon, label) {
  button.setAttribute("aria-label", label);
  button.innerHTML = `<span aria-hidden="true">${icon}</span><span class="sr-only">${label}</span>`;
}

// Подключение обработчиков событий и первичная инициализация.
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
  setIconButton(els.startBtn, START_LOADING_ICON, START_LOADING_LABEL);

  await waitWithTimeout(prepareAudioEngine(), AUDIO_LOAD_TIMEOUT_MS + 2000, false);

  setIconButton(els.startBtn, START_BUTTON_ICON, START_BUTTON_LABEL);
  els.startBtn.disabled = false;
  els.startScreen.hidden = true;
  newSession(true);
});

els.continueBtn.addEventListener("click", () => newSession(false));
els.againBtn.addEventListener("click", () => newSession(true));

renderDots();
