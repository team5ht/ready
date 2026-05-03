// Drag/touch/pointer-логика карточки с согласной.
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

