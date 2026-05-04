// Конфиг, общее состояние и ссылки на DOM-элементы.
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

const START_BUTTON_ICON = "▶";
const START_BUTTON_LABEL = "Начать";
const START_LOADING_ICON = "⏳";
const START_LOADING_LABEL = "Загрузка";

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
  homeBtn: document.getElementById("homeBtn"),
};

