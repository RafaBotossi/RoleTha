const prizes = [
  "Subir escadas do prédio",
  "Andar no condomínio",
  "Ir pra academia e fazer musculação",
  "Ir pra academia e fazer dança",
  "Jogar vôlei no condomínio",
  "Jogar futevôlei no condomínio",
  "Ir pro crossfit",
];

const wheelLabels = [
  "Escadas",
  "Caminhada",
  "Musculação",
  "Dança",
  "Vôlei",
  "Futevôlei",
  "Crossfit",
];

const labelAdjustments = [
  25,
  30,
  -30,
  -30,
  -40,
  30,
  25,
];

const introScreen = document.querySelector("#introScreen");
const rouletteScreen = document.querySelector("#rouletteScreen");
const logoStart = document.querySelector("#logoStart");
const wheel = document.querySelector("#wheel");
const lever = document.querySelector("#lever");
const spinButton = document.querySelector("#spinButton");
const resultCard = document.querySelector("#resultCard");
const resultText = document.querySelector("#resultText");

const slice = 360 / prizes.length;
let currentRotation = 0;
let isSpinning = false;
let audio;
let pullStart = null;
let pullAmount = 0;

function createWheelLabels() {
  wheelLabels.forEach((label, index) => {
    const angle = -90 + index * slice + slice / 2;
    const radians = angle * Math.PI / 180;
    const distance = 33;
    const x = 50 + Math.cos(radians) * distance + labelAdjustments[index] * 0.3;
    const y = 50 + Math.sin(radians) * distance;
    const labelNode = document.createElement("div");
    labelNode.className = "slice-label";
    labelNode.innerHTML = label;
    labelNode.style.left = `${x}%`;
    labelNode.style.top = `${y}%`;
    labelNode.style.setProperty("--label-rotation", `${readableRotation(angle)}deg`);
    wheel.appendChild(labelNode);
  });
}

function readableRotation(angle) {
  const radialAngle = angle + 90;
  const normalized = ((radialAngle % 360) + 360) % 360;
  return normalized > 100 && normalized < 260 ? radialAngle + 180 : radialAngle;
}

function enterRoulette(event) {
  if (event) {
    event.preventDefault();
  }

  if (!rouletteScreen.hidden) {
    return;
  }

  introScreen.hidden = true;
  rouletteScreen.hidden = false;
  introScreen.style.display = "none";
  rouletteScreen.style.display = "grid";
  document.body.classList.add("roulette-open");
}

function createAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const master = context.createGain();
  const music = context.createGain();
  const tick = context.createGain();

  master.gain.value = 0.28;
  music.gain.value = 0.055;
  tick.gain.value = 0.16;

  music.connect(master);
  tick.connect(master);
  master.connect(context.destination);

  const bass = context.createOscillator();
  const lead = context.createOscillator();
  bass.type = "triangle";
  lead.type = "sine";

  const bassGain = context.createGain();
  const leadGain = context.createGain();
  bassGain.gain.value = 0.24;
  leadGain.gain.value = 0.14;
  bass.connect(bassGain).connect(music);
  lead.connect(leadGain).connect(music);
  bass.start();
  lead.start();

  const notes = [146.83, 174.61, 196, 220, 196, 174.61, 246.94, 220];
  let step = 0;
  const interval = setInterval(() => {
    const now = context.currentTime;
    bass.frequency.setTargetAtTime(notes[step % notes.length] / 2, now, 0.03);
    lead.frequency.setTargetAtTime(notes[(step + 2) % notes.length], now, 0.03);
    step += 1;
  }, 360);

  return { context, tick, interval };
}

async function ensureAudio() {
  if (!audio) {
    audio = createAudio();
  }

  if (audio.context.state === "suspended") {
    await audio.context.resume();
  }
}

function playTick(power = 1) {
  if (!audio) return;
  const { context, tick } = audio;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = 720 + Math.random() * 280;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.13 * power, context.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.07);
  oscillator.connect(gain).connect(tick);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}

function playWin() {
  if (!audio) return;
  const { context } = audio;
  const gain = context.createGain();
  gain.gain.value = 0.18;
  gain.connect(context.destination);

  [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, context.currentTime + index * 0.1);
    envelope.gain.exponentialRampToValueAtTime(0.2, context.currentTime + index * 0.1 + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.1 + 0.28);
    oscillator.connect(envelope).connect(gain);
    oscillator.start(context.currentTime + index * 0.1);
    oscillator.stop(context.currentTime + index * 0.1 + 0.32);
  });
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function selectedIndexFromRotation(rotation) {
  const normalized = ((rotation % 360) + 360) % 360;
  const pointerAngle = (360 - normalized) % 360;
  return Math.floor(pointerAngle / slice) % prizes.length;
}

async function spin() {
  if (isSpinning) return;

  await ensureAudio();
  isSpinning = true;
  wheel.classList.add("spinning");
  spinButton.disabled = true;
  lever.disabled = true;
  resultCard.classList.remove("reveal");
  resultText.textContent = "Rodando...";

  const targetIndex = Math.floor(Math.random() * prizes.length);
  const sliceCenter = targetIndex * slice + slice / 2;
  const desiredRotation = (360 - sliceCenter) % 360;
  const currentNormalized = ((currentRotation % 360) + 360) % 360;
  const travel = ((desiredRotation - currentNormalized + 360) % 360) + (6 + Math.floor(Math.random() * 3)) * 360;
  const targetRotation = currentRotation + travel;
  const startRotation = currentRotation;
  const duration = 5200 + Math.random() * 900;
  const start = performance.now();
  let lastTick = startRotation;

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = easeOutCubic(progress);
    currentRotation = startRotation + (targetRotation - startRotation) * eased;
    wheel.style.transform = `rotate(${currentRotation}deg)`;

    if (Math.abs(currentRotation - lastTick) > slice / 4) {
      playTick(Math.max(0.18, 1 - progress * 0.72));
      lastTick = currentRotation;
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }

    currentRotation = targetRotation % 360;
    wheel.style.transform = `rotate(${currentRotation}deg)`;
    finishSpin(selectedIndexFromRotation(currentRotation));
  }

  requestAnimationFrame(frame);
}

function finishSpin(index) {
  wheel.classList.remove("spinning");
  spinButton.disabled = false;
  lever.disabled = false;
  resultText.textContent = prizes[index];
  resultCard.classList.add("reveal");
  playWin();
  playTick(1);
  isSpinning = false;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function maxPullDistance() {
  return isMobileLayout() ? Math.min(210, window.innerWidth * 0.46) : Math.min(245, window.innerHeight * 0.36);
}

function setPull(amount) {
  pullAmount = Math.max(0, Math.min(amount, maxPullDistance()));
  lever.style.setProperty("--pull", `${pullAmount}px`);
}

function releaseLever() {
  lever.classList.add("returning");
  const shouldSpin = pullAmount > maxPullDistance() * 0.55;
  setPull(0);
  window.setTimeout(() => lever.classList.remove("returning"), 430);
  if (shouldSpin) spin();
}

logoStart.addEventListener("click", enterRoulette);
logoStart.addEventListener("pointerup", enterRoulette);
introScreen.addEventListener("click", enterRoulette);
introScreen.addEventListener("touchend", enterRoulette, { passive: false });

lever.addEventListener("pointerdown", (event) => {
  if (isSpinning) return;
  lever.setPointerCapture(event.pointerId);
  pullStart = {
    x: event.clientX,
    y: event.clientY,
    horizontal: isMobileLayout(),
  };
});

lever.addEventListener("pointermove", (event) => {
  if (!pullStart || isSpinning) return;
  const distance = pullStart.horizontal ? event.clientX - pullStart.x : event.clientY - pullStart.y;
  setPull(distance);
});

lever.addEventListener("pointerup", () => {
  if (!pullStart) return;
  pullStart = null;
  releaseLever();
});

lever.addEventListener("pointercancel", () => {
  pullStart = null;
  releaseLever();
});

spinButton.addEventListener("click", spin);
createWheelLabels();
