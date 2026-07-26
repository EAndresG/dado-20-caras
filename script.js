const die = document.getElementById("die");
const dieNumber = document.getElementById("die-number");
const resultText = document.getElementById("result-text");
const resultBox = document.querySelector(".result-box");
const rollBtn = document.getElementById("roll-btn");
const nextTurnBtn = document.getElementById("next-turn-btn");
const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const closeHistoryBtn = document.getElementById("close-history-btn");
const historyList = document.getElementById("history-list");
const playerForm = document.getElementById("player-form");
const playerNameInput = document.getElementById("player-name-input");
const playerClassSelect = document.getElementById("player-class-select");
const playerList = document.getElementById("player-list");
const activePlayerLabel = document.getElementById("active-player-label");
const turnHelper = document.getElementById("turn-helper");
const historyPlayerSelect = document.getElementById("history-player-select");
const historyPlayerLabel = document.getElementById("history-player-label");

let audioContext;
let masterGain;
let players = [];
let activePlayerId = null;
const storageKey = "dado-20-caras-state";

function createId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
    const rawState = localStorage.getItem(storageKey);

    if (!rawState) {
        players = [];
        activePlayerId = null;
        return;
    }

    try {
        const parsedState = JSON.parse(rawState);
        players = Array.isArray(parsedState.players) ? parsedState.players : [];
        activePlayerId = parsedState.activePlayerId ?? (players[0] ? players[0].id : null);
    } catch {
        players = [];
        activePlayerId = null;
    }
}

function saveState() {
    localStorage.setItem(storageKey, JSON.stringify({ players, activePlayerId }));
}

function getActivePlayer() {
    return players.find((player) => player.id === activePlayerId) || null;
}

function getPlayerIndex(playerId) {
    return players.findIndex((player) => player.id === playerId);
}

function getNextPlayerId(playerId) {
    if (players.length === 0) {
        return null;
    }

    if (players.length === 1) {
        return players[0].id;
    }

    const currentIndex = getPlayerIndex(playerId);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + 1) % players.length;
    return players[nextIndex].id;
}

function getDefaultHistoryMessage() {
    return "No hay tiradas aún.";
}

function getPlayerTitle(player) {
    return `${player.name} · ${player.className}`;
}

function getPlayerStateLabel(state) {
    switch (state) {
        case "knocked":
            return "Noqueado";
        case "confused":
            return "Confundido";
        case "blocked":
            return "Bloqueado";
        default:
            return "Normal";
    }
}

function canPlayerAct(player) {
    return !player || (player.state !== "knocked" && player.state !== "blocked");
}

function getPlayerStatusTone(state) {
    switch (state) {
        case "knocked":
            return "bad";
        case "confused":
            return "weak";
        case "blocked":
            return "critical";
        default:
            return "neutral";
    }
}

function setPlayerState(playerId, state) {
    const player = players.find((entry) => entry.id === playerId);

    if (!player) {
        return;
    }

    player.state = state;
    saveState();
    renderPlayers();
    if (!historyModal.classList.contains("hidden")) {
        renderHistoryPlayerOptions();
        updateHistory();
    }
}

function getRollOutcome(result) {
    if (result <= 5) {
        return {
            label: "Mala jugada",
            tone: "bad",
            summary: "La fortuna te dio la espalda."
        };
    }

    if (result <= 9) {
        return {
            label: "Jugada floja",
            tone: "weak",
            summary: "No fue buena, pero aún puedes recuperarte."
        };
    }

    if (result <= 13) {
        return {
            label: "Jugada neutra",
            tone: "neutral",
            summary: "Una tirada equilibrada para seguir avanzando."
        };
    }

    if (result <= 17) {
        return {
            label: "Buena jugada",
            tone: "good",
            summary: "La suerte está de tu lado."
        };
    }

    return {
        label: "Jugada épica",
        tone: "critical",
        summary: "Una tirada gloriosa, casi legendaria."
    };
}

function ensureActivePlayer() {
    return getActivePlayer();
}

function renderPlayers() {
    playerList.innerHTML = "";

    if (players.length === 0) {
        playerList.innerHTML = '<p class="empty-state">Aún no hay jugadores. Crea uno para empezar.</p>';
        activePlayerLabel.textContent = "No hay jugador activo";
        turnHelper.textContent = "Crea un jugador para poder lanzar el dado.";
        rollBtn.disabled = true;
        return;
    }

    players.forEach((player) => {
        const card = document.createElement("article");
        card.className = `player-card${player.id === activePlayerId ? " active" : ""}`;
        card.innerHTML = `
            <div class="player-card-main">
                <p class="player-name">${player.name}</p>
                <p class="player-class">${player.className}</p>
                <p class="player-state ${getPlayerStatusTone(player.state)}">Estado: ${getPlayerStateLabel(player.state)}</p>
                <p class="player-meta">${player.history.length} tiradas guardadas</p>
            </div>
            <div class="player-card-actions">
                <button type="button" class="secondary-btn player-select-btn" data-player-id="${player.id}">${player.id === activePlayerId ? "Activo" : "Elegir"}</button>
                <button type="button" class="secondary-btn player-delete-btn" data-player-id="${player.id}">Borrar</button>
                <select class="player-state-select" data-player-id="${player.id}">
                    <option value="normal" ${player.state === "normal" || !player.state ? "selected" : ""}>Normal</option>
                    <option value="knocked" ${player.state === "knocked" ? "selected" : ""}>Noqueado</option>
                    <option value="confused" ${player.state === "confused" ? "selected" : ""}>Confundido</option>
                    <option value="blocked" ${player.state === "blocked" ? "selected" : ""}>Bloqueado</option>
                </select>
            </div>
        `;
        playerList.appendChild(card);
    });

    const activePlayer = getActivePlayer();
    const nextPlayerId = activePlayer ? getNextPlayerId(activePlayer.id) : null;
    const nextPlayer = nextPlayerId ? players.find((player) => player.id === nextPlayerId) : null;

    activePlayerLabel.textContent = activePlayer ? `Turno actual: ${getPlayerTitle(activePlayer)}` : "No hay jugador activo";
    if (!activePlayer) {
        turnHelper.textContent = "Elige un jugador antes de lanzar el dado.";
        rollBtn.disabled = true;
        nextTurnBtn.disabled = true;
        return;
    }

    const currentStateText = activePlayer.state ? getPlayerStateLabel(activePlayer.state) : "Normal";
    if (!canPlayerAct(activePlayer)) {
        turnHelper.textContent = `${getPlayerTitle(activePlayer)} está ${currentStateText.toLowerCase()} y no puede actuar. Usa siguiente turno.`;
    } else if (activePlayer.state === "confused") {
        turnHelper.textContent = `${getPlayerTitle(activePlayer)} está confundido. Puede actuar, pero conviene vigilar su próxima jugada.`;
    } else if (nextPlayer && nextPlayer.id !== activePlayer.id) {
        turnHelper.textContent = `Tras esta tirada, el turno pasará a ${getPlayerTitle(nextPlayer)}.`;
    } else {
        turnHelper.textContent = `Tirando para ${getPlayerTitle(activePlayer)}.`;
    }

    rollBtn.disabled = !canPlayerAct(activePlayer);
    nextTurnBtn.disabled = false;
}

function renderHistoryPlayerOptions() {
    historyPlayerSelect.innerHTML = "";

    if (players.length === 0) {
        historyPlayerSelect.innerHTML = '<option value="">Sin jugadores</option>';
        historyPlayerSelect.disabled = true;
        return;
    }

    historyPlayerSelect.disabled = false;
    players.forEach((player) => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = getPlayerTitle(player);
        historyPlayerSelect.appendChild(option);
    });
}

function renderHistoryForPlayer(playerId) {
    historyList.innerHTML = "";

    const player = players.find((entry) => entry.id === playerId);

    if (!player) {
        historyPlayerLabel.textContent = "";
        historyList.innerHTML = `<li>${getDefaultHistoryMessage()}</li>`;
        return;
    }

    historyPlayerLabel.textContent = getPlayerTitle(player);

    if (player.history.length === 0) {
        historyList.innerHTML = `<li>${getDefaultHistoryMessage()}</li>`;
        return;
    }

    player.history.slice().reverse().forEach((entry, index) => {
        const item = document.createElement("li");
        item.innerHTML = `<span>Tirada ${player.history.length - index} · ${entry.label}</span><span class="history-number">${entry.value}</span>`;
        historyList.appendChild(item);
    });
}

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
    renderHistoryForPlayer(historyPlayerSelect.value || activePlayerId);
}

function openHistory() {
    renderHistoryPlayerOptions();
    updateHistory();
    historyModal.classList.remove("hidden");
}

function closeHistory() {
    historyModal.classList.add("hidden");
}

function addPlayer(name, className) {
    const normalizedName = name.trim();

    if (!normalizedName) {
        return;
    }

    const player = {
        id: createId(),
        name: normalizedName,
        className,
        state: "normal",
        history: []
    };

    players.push(player);
    if (!activePlayerId) {
        activePlayerId = player.id;
    }
    saveState();
    renderPlayers();
    renderHistoryPlayerOptions();
    historyPlayerSelect.value = activePlayerId || player.id;
    updateHistory();
}

function removePlayer(playerId) {
    players = players.filter((player) => player.id !== playerId);

    if (activePlayerId === playerId) {
        activePlayerId = players[0] ? players[0].id : null;
    }

    saveState();
    renderPlayers();
    renderHistoryPlayerOptions();
    historyPlayerSelect.value = activePlayerId || "";
    updateHistory();
}

function setActivePlayer(playerId) {
    activePlayerId = playerId;
    saveState();
    renderPlayers();
    historyPlayerSelect.value = playerId;
    updateHistory();
}

function advanceTurn(currentPlayerId) {
    if (players.length === 0) {
        return;
    }

    let nextPlayerId = getNextPlayerId(currentPlayerId);
    let attempts = 0;

    while (nextPlayerId && attempts < players.length) {
        const nextPlayer = players.find((player) => player.id === nextPlayerId);

        if (nextPlayer && canPlayerAct(nextPlayer)) {
            activePlayerId = nextPlayerId;
            saveState();
            return;
        }

        nextPlayerId = getNextPlayerId(nextPlayerId);
        attempts += 1;
    }

    activePlayerId = currentPlayerId;
    saveState();
}

function skipToNextPlayableTurn() {
    const activePlayer = getActivePlayer();

    if (!activePlayer) {
        return;
    }

    advanceTurn(activePlayer.id);
    renderPlayers();
    renderHistoryPlayerOptions();
    historyPlayerSelect.value = activePlayerId || "";
    updateHistory();
}

playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPlayer(playerNameInput.value, playerClassSelect.value);
    playerNameInput.value = "";
    playerNameInput.focus();
});

playerList.addEventListener("click", (event) => {
    const selectButton = event.target.closest(".player-select-btn");
    const deleteButton = event.target.closest(".player-delete-btn");

    if (selectButton) {
        setActivePlayer(selectButton.dataset.playerId);
        return;
    }

    if (deleteButton) {
        removePlayer(deleteButton.dataset.playerId);
        return;
    }

});

playerList.addEventListener("change", (event) => {
    const stateSelect = event.target.closest(".player-state-select");

    if (stateSelect) {
        setPlayerState(stateSelect.dataset.playerId, stateSelect.value);
    }
});

historyPlayerSelect.addEventListener("change", () => {
    updateHistory();
});

nextTurnBtn.addEventListener("click", () => {
    skipToNextPlayableTurn();
});

rollBtn.addEventListener("click", () => {
    const activePlayer = ensureActivePlayer();

    if (!activePlayer || die.classList.contains("rolling") || !canPlayerAct(activePlayer)) return;

    rollBtn.disabled = true;
    die.classList.add("rolling");
    resultBox.className = "result-box";
    resultText.textContent = `Girando para ${getPlayerTitle(activePlayer)}...`;
    playRollingSound();

    setTimeout(() => {
        const result = Math.floor(Math.random() * 20) + 1;
        const outcome = getRollOutcome(result);
        dieNumber.textContent = result;
        resultText.textContent = `${getPlayerTitle(activePlayer)} sacó ${result}. ${outcome.label}. ${outcome.summary}`;
        resultBox.classList.add(outcome.tone);
        die.classList.remove("rolling");
        activePlayer.history.push({ value: result, label: outcome.label, tone: outcome.tone });
        advanceTurn(activePlayer.id);
        saveState();
        playResultSound();
        rollBtn.disabled = false;
        renderPlayers();
        if (historyModal && !historyModal.classList.contains("hidden")) {
            updateHistory();
        }
    }, 1400);
});

historyBtn.addEventListener("click", openHistory);
closeHistoryBtn.addEventListener("click", closeHistory);
historyModal.addEventListener("click", (event) => {
    if (event.target === historyModal) {
        closeHistory();
    }
});

loadState();

if (players.length === 0) {
    addPlayer("Jugador 1", "Guerrero");
} else {
    players = players.map((player) => ({
        ...player,
        state: player.state || "normal"
    }));
    renderPlayers();
    renderHistoryPlayerOptions();
    historyPlayerSelect.value = activePlayerId || players[0].id;
    updateHistory();
}
