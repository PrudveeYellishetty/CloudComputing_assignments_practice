const state = {
  bank: [],
  testQuestions: [],
  answers: new Map(),
  currentIndex: 0,
  mode: 'immediate',
  timer: null,
  startTime: null,
  currentRetestIds: []
};

const els = {
  questionCount: document.getElementById('questionCount'),
  revealMode: document.getElementById('revealMode'),
  biasMode: document.getElementById('biasMode'),
  startBtn: document.getElementById('startBtn'),
  retryBtn: document.getElementById('retryBtn'),
  questionGrid: document.getElementById('questionGrid'),
  landingView: document.getElementById('landingView'),
  testView: document.getElementById('testView'),
  resultView: document.getElementById('resultView'),
  questionCounter: document.getElementById('questionCounter'),
  modeChip: document.getElementById('modeChip'),
  timerChip: document.getElementById('timerChip'),
  questionTopic: document.getElementById('questionTopic'),
  questionScore: document.getElementById('questionScore'),
  questionText: document.getElementById('questionText'),
  optionsList: document.getElementById('optionsList'),
  feedbackBox: document.getElementById('feedbackBox'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  submitBtn: document.getElementById('submitBtn'),
  scoreValue: document.getElementById('scoreValue'),
  accuracyValue: document.getElementById('accuracyValue'),
  wrongSummary: document.getElementById('wrongSummary')
};

const STORAGE_KEY = 'nptel-practice-mode';

loadBank();
wireEvents();
restoreSettings();
renderLanding();

async function loadBank() {
  const response = await fetch('/api/questions');
  state.bank = await response.json();
  renderGrid();
  updateRetryState();
}

function wireEvents() {
  els.startBtn.addEventListener('click', () => {
    startTest(createQuestionSet());
  });

  els.retryBtn.addEventListener('click', () => {
    const wrongIds = getWrongQuestionsFromStorage().map((item) => item.id);
    if (!wrongIds.length) {
      return;
    }
    startTest(createQuestionSet(wrongIds, true));
  });

  els.prevBtn.addEventListener('click', () => goToQuestion(state.currentIndex - 1));
  els.nextBtn.addEventListener('click', () => goToQuestion(state.currentIndex + 1));
  els.submitBtn.addEventListener('click', submitTest);

  els.revealMode.addEventListener('change', persistSettings);
  els.biasMode.addEventListener('change', persistSettings);
  els.questionCount.addEventListener('change', persistSettings);
}

function restoreSettings() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  els.revealMode.value = saved.revealMode || 'immediate';
  els.biasMode.value = saved.biasMode || 'low';
  els.questionCount.value = saved.questionCount || 10;
  state.mode = els.revealMode.value;
  updateModeChip();
}

function persistSettings() {
  state.mode = els.revealMode.value;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    revealMode: els.revealMode.value,
    biasMode: els.biasMode.value,
    questionCount: Number(els.questionCount.value || 10)
  }));
  updateModeChip();
}

function updateModeChip() {
  els.modeChip.textContent = `Mode: ${state.mode === 'immediate' ? 'Immediate Reveal' : 'End-of-Test Reveal'}`;
}

function renderLanding() {
  els.landingView.classList.remove('hidden');
  els.testView.classList.add('hidden');
  els.resultView.classList.add('hidden');
  els.questionCounter.textContent = 'Q 0 / 0';
  els.timerChip.textContent = '00:00';
  clearInterval(state.timer);
  state.timer = null;
}

function startTest(questions) {
  if (!questions.length) {
    return;
  }
  state.testQuestions = questions;
  state.answers = new Map();
  state.currentIndex = 0;
  state.startTime = Date.now();
  els.landingView.classList.add('hidden');
  els.resultView.classList.add('hidden');
  els.testView.classList.remove('hidden');
  state.mode = els.revealMode.value;
  updateModeChip();
  renderGrid();
  renderQuestion();
  clearInterval(state.timer);
  state.timer = setInterval(updateTimer, 1000);
  updateTimer();
  recordAskedCounts(questions.map((question) => question.id));
  updateRetryState();
}

function createQuestionSet(forcedIds = [], isRetest = false) {
  const desiredCount = Math.max(1, Number(els.questionCount.value || 10));
  const source = forcedIds.length
    ? state.bank.filter((question) => forcedIds.includes(question.id))
    : [...state.bank];

  if (!source.length) {
    return [];
  }

  const pool = [...source];
  const selected = [];
  const seen = new Set();
  const targetCount = Math.min(desiredCount, pool.length);

  while (selected.length < targetCount && pool.length) {
    const index = pickWeightedIndex(pool, els.biasMode.value === 'low' && !isRetest);
    const [question] = pool.splice(index, 1);
    if (seen.has(question.id)) {
      continue;
    }
    seen.add(question.id);
    selected.push(question);
  }

  return selected;
}

function pickWeightedIndex(pool, preferLowAsked) {
  if (!preferLowAsked) {
    return Math.floor(Math.random() * pool.length);
  }

  const weights = pool.map((question) => 1 / (Number(question.asked_count || 0) + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let pick = Math.random() * total;

  for (let index = 0; index < pool.length; index += 1) {
    pick -= weights[index];
    if (pick <= 0) {
      return index;
    }
  }

  return pool.length - 1;
}

function renderGrid() {
  els.questionGrid.innerHTML = '';
  const total = state.testQuestions.length || state.bank.length;
  const questions = state.testQuestions.length ? state.testQuestions : state.bank.slice(0, Math.min(total, 10));

  questions.forEach((question, index) => {
    const button = document.createElement('button');
    button.className = 'grid-btn';
    button.textContent = index + 1;
    button.addEventListener('click', () => goToQuestion(index));
    button.dataset.index = index;
    els.questionGrid.appendChild(button);
  });

  updateGridState();
}

function renderQuestion() {
  const question = state.testQuestions[state.currentIndex];
  if (!question) {
    return;
  }

  els.questionCounter.textContent = `Q ${state.currentIndex + 1} / ${state.testQuestions.length}`;
  els.questionTopic.textContent = `Question ${state.currentIndex + 1}`;
  els.questionScore.textContent = question.marks ? `${question.marks} marks` : '1 mark';
  els.questionText.textContent = question.question;
  els.optionsList.innerHTML = '';
  els.feedbackBox.classList.add('hidden');
  els.feedbackBox.innerHTML = '';

  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'option';
    label.innerHTML = `
      <input type="radio" name="answer" value="${index}" />
      <div>
        <strong>${String.fromCharCode(65 + index)}.</strong> ${option}
      </div>
    `;
    label.addEventListener('click', () => handleAnswer(index));
    els.optionsList.appendChild(label);
  });

  const savedAnswer = state.answers.get(question.id);
  if (savedAnswer !== undefined) {
    const radio = els.optionsList.querySelector(`input[value="${savedAnswer}"]`);
    if (radio) {
      radio.checked = true;
    }
    lockCurrentQuestionOptions();
  }

  if (state.mode === 'immediate' && state.answers.has(question.id)) {
    showFeedback(question, state.answers.get(question.id));
  }

  els.prevBtn.disabled = state.currentIndex === 0;
  els.nextBtn.disabled = state.currentIndex === state.testQuestions.length - 1;
  updateGridState();
}

function handleAnswer(optionIndex) {
  const question = state.testQuestions[state.currentIndex];
  if (state.answers.has(question.id)) {
    return;
  }
  state.answers.set(question.id, optionIndex);
  updateGridState();
  lockCurrentQuestionOptions();
  if (state.mode === 'immediate') {
    showFeedback(question, optionIndex);
  }
}

function lockCurrentQuestionOptions() {
  [...els.optionsList.children].forEach((node) => {
    node.classList.add('locked');
    const input = node.querySelector('input');
    if (input) {
      input.disabled = true;
    }
  });
}

function showFeedback(question, selectedIndex) {
  const correctIndex = question.answer_index;
  const isCorrect = selectedIndex === correctIndex;
  const selectedText = question.options[selectedIndex] || 'No selection';
  const correctText = question.options[correctIndex];

  els.feedbackBox.classList.remove('hidden');
  els.feedbackBox.innerHTML = `
    <strong>${isCorrect ? 'Correct' : 'Incorrect'}</strong>
    <div>Your answer: ${selectedText}</div>
    <div>Correct answer: ${correctText}</div>
    ${question.explanation ? `<div>Explanation: ${question.explanation}</div>` : ''}
  `;

  [...els.optionsList.children].forEach((node, index) => {
    node.classList.remove('correct', 'wrong');
    if (index === correctIndex) {
      node.classList.add('correct');
    }
    if (index === selectedIndex && !isCorrect) {
      node.classList.add('wrong');
    }
  });
}

function goToQuestion(index) {
  if (index < 0 || index >= state.testQuestions.length) {
    return;
  }
  state.currentIndex = index;
  renderQuestion();
}

function submitTest() {
  clearInterval(state.timer);
  const wrongQuestions = [];
  let score = 0;

  state.testQuestions.forEach((question) => {
    const selected = state.answers.get(question.id);
    const isCorrect = selected === question.answer_index;
    if (isCorrect) {
      score += question.marks || 1;
    } else {
      wrongQuestions.push({
        id: question.id,
        question: question.question,
        selected: selected,
        correct: question.answer_index,
        options: question.options,
        explanation: question.explanation || ''
      });
    }
  });

  localStorage.setItem('nptel-wrong-questions', JSON.stringify(wrongQuestions));

  els.scoreValue.textContent = `${score} / ${state.testQuestions.reduce((sum, question) => sum + (question.marks || 1), 0)}`;
  const accuracy = state.testQuestions.length
    ? Math.round(((state.testQuestions.length - wrongQuestions.length) / state.testQuestions.length) * 100)
    : 0;
  els.accuracyValue.textContent = `${accuracy}%`;
  els.wrongSummary.innerHTML = wrongQuestions.length
    ? wrongQuestions.map((item, index) => renderWrongItem(item, index)).join('')
    : '<div class="wrong-item"><h3>No wrong answers</h3><p>All questions were answered correctly.</p></div>';

  if (state.mode === 'end') {
    [...els.optionsList.children].forEach((node, index) => {
      const currentQuestion = state.testQuestions[state.currentIndex];
      if (!currentQuestion) {
        return;
      }
      if (index === currentQuestion.answer_index) {
        node.classList.add('correct');
      }
    });
  }

  els.testView.classList.add('hidden');
  els.resultView.classList.remove('hidden');
  updateRetryState();
}

function renderWrongItem(item, index) {
  const selectedText = item.selected === undefined || item.selected === null ? 'Not answered' : item.options[item.selected];
  const correctText = item.options[item.correct];
  return `
    <div class="wrong-item">
      <h3>Question ${index + 1}</h3>
      <p>${item.question}</p>
      <p><strong>Your answer:</strong> ${selectedText}</p>
      <p><strong>Correct answer:</strong> ${correctText}</p>
      ${item.explanation ? `<p><strong>Explanation:</strong> ${item.explanation}</p>` : ''}
    </div>
  `;
}

function updateGridState() {
  [...els.questionGrid.children].forEach((button, index) => {
    const question = state.testQuestions[index];
    if (!question) {
      return;
    }
    button.classList.toggle('current', index === state.currentIndex);
    button.classList.toggle('answered', state.answers.has(question.id));
    button.classList.toggle('wrong', false);
  });
}

function updateTimer() {
  if (!state.startTime) {
    return;
  }
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  els.timerChip.textContent = `${minutes}:${seconds}`;
}

function getWrongQuestionsFromStorage() {
  return JSON.parse(localStorage.getItem('nptel-wrong-questions') || '[]');
}

function updateRetryState() {
  els.retryBtn.disabled = getWrongQuestionsFromStorage().length === 0;
}

async function recordAskedCounts(ids) {
  try {
    await fetch('/api/record-asked', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });
    const response = await fetch('/api/questions');
    state.bank = await response.json();
    renderGrid();
  } catch (error) {
    console.error('Failed to record asked counts', error);
  }
}
