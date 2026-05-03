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
