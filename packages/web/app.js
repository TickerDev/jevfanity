const API_BASE = window.JEVFANITY_API_URL || "https://api.jevfanity.app";
const categories = ["profanity", "slur", "harassment", "threat", "sexual"];
const messageInput = document.querySelector("#message");
const levelInput = document.querySelector("#level");
const status = document.querySelector("#status");
const characterCount = document.querySelector("#character-count");
const signal = document.querySelector("#signal");
const resultTitle = document.querySelector("#result-title");
const score = document.querySelector("#score");
const categoryList = document.querySelector("#categories");
const resultNote = document.querySelector("#result-note");

let timer;
let controller;

messageInput.addEventListener("input", () => {
  const text = messageInput.value;
  characterCount.textContent = `${text.length.toLocaleString()} / 10,000`;
  clearTimeout(timer);

  if (controller) controller.abort();
  if (!text.trim()) {
    showIdle();
    return;
  }

  showLoading();
  timer = setTimeout(() => moderate(text, levelInput.value), 600);
});

levelInput.addEventListener("change", () => {
  if (messageInput.value.trim()) {
    clearTimeout(timer);
    if (controller) controller.abort();
    showLoading();
    timer = setTimeout(() => moderate(messageInput.value, levelInput.value), 250);
  }
});

async function moderate(text, level) {
  controller = new AbortController();

  try {
    const response = await fetch(`${API_BASE}/v1/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, level }),
      signal: controller.signal,
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Moderation failed.");
    renderResult(result);
  } catch (error) {
    if (error.name === "AbortError") return;
    showError(error.message);
  }
}

function renderResult(result) {
  const isFlagged = result.flagged;
  signal.dataset.state = isFlagged ? "flagged" : "clear";
  status.dataset.state = isFlagged ? "flagged" : "clear";
  status.textContent = isFlagged ? "Needs a closer look" : "Looks clear";
  resultTitle.textContent = isFlagged ? "Some language was flagged" : "Nothing concerning found";
  score.textContent = `${Math.round(result.score * 100)}%`;
  resultNote.textContent = `${capitalize(result.level)} sensitivity · ${result.flagged_categories.length ? `${result.flagged_categories.length} category flagged` : "No categories flagged"}`;
  categoryList.innerHTML = categories.map((category) => {
    const value = result.categories[category] || 0;
    const flagged = result.flagged_categories.includes(category);
    return `<div class="category-row" data-flagged="${flagged}">
      <span>${category}</span>
      <div class="meter" aria-hidden="true"><div class="meter-fill" style="width: ${Math.round(value * 100)}%"></div></div>
      <span class="category-score">${Math.round(value * 100)}%</span>
    </div>`;
  }).join("");
}

function showIdle() {
  signal.dataset.state = "idle";
  status.dataset.state = "idle";
  status.textContent = "Waiting for text";
  resultTitle.textContent = "Ready when you are";
  score.textContent = "--";
  resultNote.textContent = "Jev evaluates context, not just keywords.";
  categoryList.innerHTML = '<div class="category-row placeholder-row"><span>Type something above to see category scores</span></div>';
}

function showLoading() {
  signal.dataset.state = "loading";
  status.dataset.state = "loading";
  status.textContent = "Checking...";
  resultTitle.textContent = "Reading the room";
}

function showError(message) {
  signal.dataset.state = "flagged";
  status.dataset.state = "flagged";
  status.textContent = "Could not check text";
  resultTitle.textContent = "The checker is taking a pause";
  resultNote.textContent = message;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}