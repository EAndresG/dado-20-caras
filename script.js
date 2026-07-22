const die = document.getElementById("die");
const dieNumber = document.getElementById("die-number");
const resultText = document.getElementById("result-text");
const rollBtn = document.getElementById("roll-btn");
const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const closeHistoryBtn = document.getElementById("close-history-btn");
const historyList = document.getElementById("history-list");

let audioContext;
let masterGain;
let history = [];

async function getAudioContext() {
    if (!audioContext) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.2;
        masterGain.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
        await audioContext.resume();
    }

    return audioContext;
}

async function playRollingSound() {
    const ctx = await getAudioContext();
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(180, now);
    oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.35);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.6);
}

async function playResultSound() {
    const ctx = await getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "square";
    osc1.frequency.setValueAtTime(720, now);
    osc1.frequency.exponentialRampToValueAtTime(240, now + 0.3);
    osc2.frequency.setValueAtTime(420, now);
    osc2.frequency.exponentialRampToValueAtTime(160, now + 0.3);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(masterGain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
}

function updateHistory() {
    historyList.innerHTML = "";

    if (history.length === 0) {
        historyList.innerHTML = "<li>No hay tiradas aún.</li>";
        return;
    }

    history.slice().reverse().forEach((entry, index) => {
        const item = document.createElement("li");
        item.innerHTML = `<span>Tirada ${history.length - index}</span><span class="history-number">${entry}</span>`;
        historyList.appendChild(item);
    });
}

function openHistory() {
    updateHistory();
    historyModal.classList.remove("hidden");
}

function closeHistory() {
    historyModal.classList.add("hidden");
}

rollBtn.addEventListener("click", () => {
    if (die.classList.contains("rolling")) return;

    rollBtn.disabled = true;
    die.classList.add("rolling");
    resultText.textContent = "Girando...";
    playRollingSound();

    setTimeout(() => {
        const result = Math.floor(Math.random() * 20) + 1;
        dieNumber.textContent = result;
        resultText.textContent = `¡Salió el ${result}!`;
        die.classList.remove("rolling");
        history.push(result);
        playResultSound();
        rollBtn.disabled = false;
    }, 1400);
});

historyBtn.addEventListener("click", openHistory);
closeHistoryBtn.addEventListener("click", closeHistory);
historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) {
        closeHistory();
    }
});

updateHistory();
