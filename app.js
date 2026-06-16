// Application State
const state = {
  subject: '',
  duration: 50, // in minutes
  keywords: [], // Array of { id, word, desc }
  questions: [], // Array of { id, text, score, type, minChar, maxChar, keywords: [] }
  answers: {}, // map of questionId -> studentAnswer
  timeRemaining: 0, // seconds
  timerInterval: null,
  timeSpent: 0, // seconds
  isExamRunning: false
};

// Answer Length Configs
const LIMITS = {
  'short': { name: '단답형', min: 50, max: 150, desc: '한두 단어에서 문장, 100자 내외' },
  'short-desc': { name: '짧은 서술형', min: 300, max: 500, desc: '300-500자' },
  'long-desc': { name: '긴 서술형', min: 500, max: 1000, desc: '500-1000자' },
  'essay': { name: '논술형', min: 1000, max: 3000, desc: '1000자 이상' }
};

// DOM Elements
const stepper = document.getElementById('stepper');
const keywordContainer = document.getElementById('keyword-list-container');
const btnAddKeyword = document.getElementById('btn-add-keyword');
const questionCountInput = document.getElementById('question-count');
const questionConfigContainer = document.getElementById('question-config-container');
const generatedQuestionsContainer = document.getElementById('generated-questions-container');
const examQuestionsSheet = document.getElementById('exam-questions-sheet');
const timerDigits = document.getElementById('timer-digits');
const timerProgressBar = document.getElementById('timer-progress-bar');
const timesUpModal = document.getElementById('times-up-modal');
const detailedGradingContainer = document.getElementById('detailed-grading-container');

// Core Step Screens
const screens = {
  1: document.getElementById('step1-screen'),
  2: document.getElementById('step2-screen'),
  3: document.getElementById('step3-screen'),
  4: document.getElementById('step4-screen'),
  5: document.getElementById('step5-screen')
};

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  initKeywordRows();
  setupEventListeners();
});

// Step Navigation Helper
function showScreen(stepNum) {
  // Hide all screens
  Object.values(screens).forEach(screen => screen.classList.add('hidden'));
  
  // Show target screen
  screens[stepNum].classList.remove('hidden');
  
  // Update stepper UI
  const steps = stepper.querySelectorAll('.step');
  steps.forEach(step => {
    const sVal = parseInt(step.getAttribute('data-step'));
    if (sVal === stepNum) {
      step.className = 'step active';
    } else if (sVal < stepNum) {
      step.className = 'step completed';
    } else {
      step.className = 'step';
    }
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ==========================================================================
   STEP 1: Basic Info & Keywords
   ========================================================================== */

function initKeywordRows() {
  keywordContainer.innerHTML = '';
  // Start with 3 empty rows by default
  addKeywordRow('', '');
  addKeywordRow('', '');
  addKeywordRow('', '');
}

let keywordRowCounter = 0;
function addKeywordRow(word = '', desc = '') {
  const rowId = `k-row-${keywordRowCounter++}`;
  const row = document.createElement('div');
  row.className = 'keyword-row';
  row.id = rowId;
  
  row.innerHTML = `
    <input type="text" class="keyword-word" placeholder="키워드 (예: 칸트, 중용)" value="${word}" required>
    <input type="text" class="keyword-desc" placeholder="핵심 요약 내용 (예: 의무론, 정언명령, 선의지)" value="${desc}" required>
    <button type="button" class="btn-delete-row" onclick="deleteKeywordRow('${rowId}')" title="삭제">❌</button>
  `;
  
  keywordContainer.appendChild(row);
  
  // Add auto-add feature when pressing enter on the description input
  const descInput = row.querySelector('.keyword-desc');
  descInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeywordRow('', '');
      // Focus on the new keyword input
      setTimeout(() => {
        const lastRow = keywordContainer.lastElementChild;
        if (lastRow) lastRow.querySelector('.keyword-word').focus();
      }, 50);
    }
  });
}

function deleteKeywordRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) {
    row.remove();
  }
}

// Adjust Time Helpers
function adjustTime(amount) {
  const timeInput = document.getElementById('exam-duration');
  let val = parseInt(timeInput.value) || 50;
  val = Math.max(1, Math.min(180, val + amount));
  timeInput.value = val;
}

// Read keywords from DOM
function getKeywordsFromDOM() {
  const rows = keywordContainer.querySelectorAll('.keyword-row');
  const list = [];
  rows.forEach((row, idx) => {
    const word = row.querySelector('.keyword-word').value.trim();
    const desc = row.querySelector('.keyword-desc').value.trim();
    if (word) {
      list.push({ id: idx, word, desc });
    }
  });
  return list;
}

// Validation Step 1
function validateAndSaveStep1() {
  const subjectInput = document.getElementById('subject-name').value.trim();
  const timeInput = parseInt(document.getElementById('exam-duration').value);
  const keywordsList = getKeywordsFromDOM();

  if (!subjectInput) {
    alert('과목명을 입력해 주세요.');
    document.getElementById('subject-name').focus();
    return false;
  }
  if (!timeInput || timeInput < 1) {
    alert('올바른 시험 시간을 입력해 주세요.');
    document.getElementById('exam-duration').focus();
    return false;
  }
  if (keywordsList.length === 0) {
    alert('최소 1개 이상의 키워드를 입력해 주세요.');
    return false;
  }

  // Save to state
  state.subject = subjectInput;
  state.duration = timeInput;
  state.keywords = keywordsList;
  return true;
}

/* ==========================================================================
   STEP 2: Question Config (Num of Questions & Details)
   ========================================================================== */

function adjustQuestionCount(amount) {
  let val = parseInt(questionCountInput.value) || 3;
  val = Math.max(1, Math.min(10, val + amount));
  questionCountInput.value = val;
  renderQuestionConfigRows(val);
}

function renderQuestionConfigRows(count) {
  questionConfigContainer.innerHTML = '';
  for (let i = 1; i <= count; i++) {
    const configRow = document.createElement('div');
    configRow.className = 'question-config-row';
    configRow.innerHTML = `
      <div class="q-label">${i}번 문항</div>
      <div>
        <select class="q-type-select" data-index="${i}">
          <option value="short">단답형 (~100자)</option>
          <option value="short-desc" selected>짧은 서술형 (300-500자)</option>
          <option value="long-desc">긴 서술형 (500-1000자)</option>
          <option value="essay">논술형 (1000자 이상)</option>
        </select>
      </div>
      <div>
        <input type="number" class="q-score-input" placeholder="배점 (미입력 시 균등 배분)" min="1" max="100">
      </div>
    `;
    questionConfigContainer.appendChild(configRow);
  }
}

// Save Step 2 & Generate Questions
function processStep2AndGenerate() {
  const rows = questionConfigContainer.querySelectorAll('.question-config-row');
  const count = rows.length;
  
  // Calculate Scores
  let customScores = [];
  let totalCustomScore = 0;
  let customScoresCount = 0;
  
  rows.forEach(row => {
    const scoreVal = parseInt(row.querySelector('.q-score-input').value);
    if (!isNaN(scoreVal) && scoreVal > 0) {
      customScores.push(scoreVal);
      totalCustomScore += scoreVal;
      customScoresCount++;
    } else {
      customScores.push(null);
    }
  });

  // Assign scores
  let scores = [];
  if (customScoresCount === count) {
    // If all scores are specified, use them
    scores = customScores;
  } else {
    // Distribute 100 points
    const baseScore = Math.floor(100 / count);
    const remainder = 100 % count;
    for (let i = 0; i < count; i++) {
      // Put the remainder in the first question
      scores.push(baseScore + (i === 0 ? remainder : 0));
    }
  }

  // Build temporary questions state
  state.questions = [];
  rows.forEach((row, index) => {
    const type = row.querySelector('.q-type-select').value;
    const score = scores[index];
    const limits = LIMITS[type];
    
    state.questions.push({
      id: index + 1,
      text: '', // To be generated
      score: score,
      type: type,
      minChar: limits.min,
      maxChar: limits.max,
      keywords: [] // To be assigned by generator
    });
  });

  // Run the Heuristic Question Generator!
  generateQuestionsHeuristic();
  
  // Render generated questions for editing (Step 3)
  renderGeneratedQuestionsReview();
  showScreen(3);
}

/* ==========================================================================
   QUESTION GENERATOR (HEURISTIC)
   ========================================================================== */

function generateQuestionsHeuristic() {
  const keywords = [...state.keywords];
  const numQuestions = state.questions.length;
  
  // Helper to chunk or distribute keywords
  // We want to make sure every question gets at least one primary keyword
  // and we try to group related keywords if possible.
  const questionKeywordBuckets = Array.from({ length: numQuestions }, () => []);
  
  // Distribute all keywords cyclically
  keywords.forEach((keyword, idx) => {
    const targetQIndex = idx % numQuestions;
    questionKeywordBuckets[targetQIndex].push(keyword);
  });
  
  // If we have very few keywords, fill up with random ones to make questions more interesting
  questionKeywordBuckets.forEach((bucket, qIdx) => {
    if (bucket.length === 0 && keywords.length > 0) {
      // Pick a random keyword
      const randomK = keywords[Math.floor(Math.random() * keywords.length)];
      bucket.push(randomK);
    }
  });

  // Generate question titles based on templates
  state.questions.forEach((q, idx) => {
    const bucket = questionKeywordBuckets[idx];
    const assignedWordList = bucket.map(k => k.word);
    q.keywords = assignedWordList; // assign initial keywords list (only the words)
    
    // Choose template based on question type and number of keywords
    let text = '';
    const limits = LIMITS[q.type];
    
    if (bucket.length === 1) {
      const k1 = bucket[0];
      if (q.type === 'short') {
        text = `"${k1.word}"의 개념에 대해 간략히 설명하고, 그 핵심 내용을 한 문장으로 제시하시오.`;
      } else if (q.type === 'short-desc') {
        text = `"${k1.word}"에 대해 설명하고, 이것이 나타내는 중요 의미(${k1.desc})를 기술하시오.`;
      } else {
        text = `"${k1.word}"의 주요 사상적 배경을 밝히고, 이것이 가지는 의의를 상세히 설명하시오.`;
      }
    } else if (bucket.length === 2) {
      const k1 = bucket[0];
      const k2 = bucket[1];
      if (q.type === 'short') {
        text = `"${k1.word}"와 "${k2.word}"의 연관 관계를 핵심 키워드를 활용해 요약 서술하시오.`;
      } else if (q.type === 'short-desc') {
        text = `"${k1.word}"와 "${k2.word}"의 핵심적인 사상적 공통점 혹은 차이점에 대해 기술하시오.`;
      } else {
        text = `"${k1.word}"의 이론적 배경과 "${k2.word}"의 세부 내용(${k2.desc})을 연결하여 비판적으로 비교 대조해 서술하시오.`;
      }
    } else if (bucket.length >= 3) {
      const k1 = bucket[0];
      const k2 = bucket[1];
      const k3 = bucket[2];
      if (q.type === 'short') {
        text = `"${k1.word}", "${k2.word}", "${k3.word}"의 중심 내용을 결합하여 간략히 서술하시오.`;
      } else if (q.type === 'short-desc') {
        text = `"${k1.word}"와 "${k2.word}"에 대해 서술하고, 이를 "${k3.word}"의 시각에서 한계점을 짚어 설명하시오.`;
      } else {
        text = `"${k1.word}", "${k2.word}"에 대한 학술적 논의를 비교하고, 이를 바탕으로 "${k3.word}"가 지니는 성과에 대해 종합적으로 논술하시오.`;
      }
    } else {
      // Fallback if no keywords (unlikely but safe)
      text = `시험 범위의 핵심 주제에 관한 자신의 견해를 논리적으로 서술하시오.`;
    }
    
    q.text = text;
  });
}

/* ==========================================================================
   STEP 3: Review & Edit Generated Questions
   ========================================================================== */

function renderGeneratedQuestionsReview() {
  generatedQuestionsContainer.innerHTML = '';
  
  state.questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-review-card';
    card.dataset.id = q.id;
    
    // Create checkboxes for ALL available keywords so user can customize
    let checkboxesHtml = '';
    state.keywords.forEach(keyword => {
      const isChecked = q.keywords.includes(keyword.word) ? 'checked' : '';
      checkboxesHtml += `
        <label class="checkbox-chip">
          <input type="checkbox" class="q-keyword-cb" value="${keyword.word}" ${isChecked} data-qid="${q.id}">
          <span class="chip-label">${keyword.word}</span>
        </label>
      `;
    });

    card.innerHTML = `
      <div class="q-header-meta">
        <span class="exam-q-num">${q.id}번 문항</span>
        <div class="q-badge-info">
          <span class="badge info-badge">${LIMITS[q.type].name}</span>
          <span class="badge success-badge">${q.score}점</span>
        </div>
      </div>
      <div class="form-group">
        <label for="q-text-${q.id}">질문 편집</label>
        <input type="text" id="q-text-${q.id}" class="q-text-edit-input" value="${q.text}" placeholder="문제를 직접 편집하세요.">
      </div>
      <div class="keyword-selector-group">
        <p>채점에 반영할 필수 키워드 선택 (중복 선택 가능)</p>
        <div class="checkbox-grid">
          ${checkboxesHtml}
        </div>
      </div>
    `;
    generatedQuestionsContainer.appendChild(card);
  });
}

// Read finalized questions from Step 3
function saveStep3Config() {
  const cards = generatedQuestionsContainer.querySelectorAll('.question-review-card');
  cards.forEach((card, idx) => {
    const qId = parseInt(card.dataset.id);
    const qText = card.querySelector('.q-text-edit-input').value.trim();
    
    // Read checked keywords
    const checkedBoxes = card.querySelectorAll('.q-keyword-cb:checked');
    const checkedKeywords = Array.from(checkedBoxes).map(cb => cb.value);
    
    const question = state.questions.find(q => q.id === qId);
    if (question) {
      question.text = qText || `${qId}번 문제입니다.`;
      question.keywords = checkedKeywords;
    }
  });
}

/* ==========================================================================
   STEP 4: Exam Mode & Countdown Timer
   ========================================================================== */

function startExamSimulator() {
  saveStep3Config();
  
  // Set up Live Exam state
  state.answers = {};
  state.timeRemaining = state.duration * 60;
  state.timeSpent = 0;
  state.isExamRunning = true;
  
  // UI setups
  document.getElementById('exam-current-subject').textContent = state.subject;
  updateExamProgressCounter();
  
  renderExamQuestionsSheet();
  startTimer();
  
  showScreen(4);
}

function renderExamQuestionsSheet() {
  examQuestionsSheet.innerHTML = '';
  
  state.questions.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'exam-question-card';
    card.id = `exam-q-card-${q.id}`;
    
    const limits = LIMITS[q.type];
    
    card.innerHTML = `
      <div class="exam-q-header">
        <div class="exam-q-title-area">
          <span class="exam-q-num">Q${q.id}. (${q.score}점)</span>
          <h3 class="exam-q-title">${q.text}</h3>
        </div>
        <div class="exam-q-meta">
          <span class="badge info-badge">${limits.name} (${limits.min}~${limits.max}자)</span>
        </div>
      </div>
      
      <div class="exam-q-textarea-wrapper">
        <textarea class="exam-q-textarea" data-qid="${q.id}" placeholder="이곳에 답안을 서술형으로 작성해 주세요."></textarea>
      </div>
      
      <div class="exam-q-footer-status">
        <!-- Live character gauge -->
        <div class="char-gauge-wrapper">
          <div class="char-gauge-header">
            <span>목표: ${limits.min}자 이상</span>
            <span class="char-count-display"><span id="char-count-${q.id}">0</span>자</span>
          </div>
          <div class="char-gauge-track">
            <div class="char-gauge-fill under" id="char-gauge-fill-${q.id}" style="width: 0%"></div>
          </div>
        </div>
        
        <!-- Live Keyword status badge -->
        <div id="live-keyword-status-${q.id}" class="badge danger-badge exam-live-keyword-badge">
          ⚠️ 필수 키워드 미포함 (0점 방지용)
        </div>
      </div>
    `;
    
    examQuestionsSheet.appendChild(card);
    
    // Add real-time text handlers
    const textarea = card.querySelector('.exam-q-textarea');
    textarea.addEventListener('input', (e) => {
      handleAnswerInput(q.id, e.target.value);
    });
  });
}

function handleAnswerInput(qid, value) {
  state.answers[qid] = value;
  const len = value.length;
  
  // Update character count
  document.getElementById(`char-count-${qid}`).textContent = len;
  
  // Update gauge bar
  const q = state.questions.find(item => item.id === qid);
  const min = q.minChar;
  const max = q.maxChar;
  const fill = document.getElementById(`char-gauge-fill-${qid}`);
  
  let percentage = 0;
  if (len < min) {
    percentage = (len / min) * 70; // 0 to 70% before meeting min
    fill.className = 'char-gauge-fill under';
  } else if (len >= min && len <= max) {
    percentage = 70 + ((len - min) / (max - min)) * 30; // 70 to 100% in optimal range
    fill.className = 'char-gauge-fill valid';
  } else {
    percentage = 100;
    fill.className = 'char-gauge-fill over';
  }
  fill.style.width = `${Math.min(100, percentage)}%`;
  
  // Update Keyword Presence Indicator
  const liveKwBadge = document.getElementById(`live-keyword-status-${qid}`);
  const hasKeyword = q.keywords.length === 0 || q.keywords.some(kw => {
    // case-insensitive substring match
    return value.toLowerCase().includes(kw.toLowerCase());
  });
  
  if (hasKeyword) {
    liveKwBadge.className = 'badge success-badge exam-live-keyword-badge';
    liveKwBadge.innerHTML = '✅ 필수 키워드 매칭 완료';
  } else {
    liveKwBadge.className = 'badge danger-badge exam-live-keyword-badge';
    liveKwBadge.innerHTML = '⚠️ 필수 키워드 미포함 (0점 방지용)';
  }
  
  updateExamProgressCounter();
}

function updateExamProgressCounter() {
  const total = state.questions.length;
  let filledCount = 0;
  state.questions.forEach(q => {
    const answer = state.answers[q.id] || '';
    if (answer.trim().length > 0) {
      filledCount++;
    }
  });
  document.getElementById('exam-progress-counter').textContent = `${filledCount} / ${total} 문항 작성완료`;
}

// Timer Logic
function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  const totalSeconds = state.duration * 60;
  updateTimerUI();
  
  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    state.timeSpent++;
    
    updateTimerUI();
    
    // Warning state when time is low (< 10% or < 60s)
    const stickyBar = document.querySelector('.sticky-timer-bar');
    if (state.timeRemaining <= 60 || state.timeRemaining < (totalSeconds * 0.1)) {
      stickyBar.classList.add('timer-warning');
    } else {
      stickyBar.classList.remove('timer-warning');
    }
    
    if (state.timeRemaining <= 0) {
      endExamDueToTimeout();
    }
  }, 1000);
}

function updateTimerUI() {
  const totalSeconds = state.duration * 60;
  const pct = (state.timeRemaining / totalSeconds) * 100;
  timerProgressBar.style.width = `${pct}%`;
  
  const hrs = Math.floor(state.timeRemaining / 3600);
  const mins = Math.floor((state.timeRemaining % 3600) / 60);
  const secs = state.timeRemaining % 60;
  
  let formatted = '';
  if (hrs > 0) {
    formatted = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  timerDigits.textContent = formatted;
}

function endExamDueToTimeout() {
  clearInterval(state.timerInterval);
  state.isExamRunning = false;
  
  // Disable textareas
  const textareas = examQuestionsSheet.querySelectorAll('.exam-q-textarea');
  textareas.forEach(ta => ta.disabled = true);
  
  // Show time's up modal
  timesUpModal.classList.remove('hidden');
}

/* ==========================================================================
   STEP 5: GRADING & REPORT DASHBOARD
   ========================================================================== */

function submitExam() {
  // Clear timer
  clearInterval(state.timerInterval);
  state.isExamRunning = false;
  
  // Run grading calculations
  const report = gradeExam();
  
  // Render results screen
  renderReportDashboard(report);
  
  showScreen(5);
}

function gradeExam() {
  const questionGrades = [];
  let totalScore = 0;
  let totalMaxScore = 0;
  let totalKeywordsMatched = 0;
  let totalKeywordsAssigned = 0;
  let lengthCompliedCount = 0;
  
  state.questions.forEach(q => {
    const answer = (state.answers[q.id] || '').trim();
    const len = answer.length;
    const assignedKeywords = q.keywords;
    
    let isIrrelevant = false;
    let scoreObtained = 0;
    let feedbackRubric = [];
    let matchedKeywords = [];
    let missedKeywords = [];
    
    totalMaxScore += q.score;
    totalKeywordsAssigned += assignedKeywords.length;
    
    // Check if relevant
    const matchedList = [];
    assignedKeywords.forEach(kw => {
      // Substring match
      if (answer.toLowerCase().includes(kw.toLowerCase())) {
        matchedList.push(kw);
      }
    });
    
    matchedKeywords = matchedList;
    missedKeywords = assignedKeywords.filter(kw => !matchedList.includes(kw));
    totalKeywordsMatched += matchedKeywords.length;
    
    // Zero-Score Rule: No keywords matched (Only if question has assigned keywords)
    if (assignedKeywords.length > 0 && matchedKeywords.length === 0) {
      isIrrelevant = true;
      scoreObtained = 0;
      feedbackRubric.push({
        type: 'critical',
        text: '❌ 무관한 답안 감점 100%: 문제와 관련된 핵심 키워드가 전혀 언급되지 않았습니다.'
      });
    } else {
      // Calculate Content Score (70%)
      let contentScore = 0;
      if (assignedKeywords.length > 0) {
        const keywordRatio = matchedKeywords.length / assignedKeywords.length;
        contentScore = 0.70 * q.score * keywordRatio;
        
        feedbackRubric.push({
          type: 'plus',
          text: `키워드 반영 (${matchedKeywords.length}/${assignedKeywords.length}개): +${contentScore.toFixed(1)}점`
        });
      } else {
        // Fallback if no keywords assigned
        contentScore = 0.70 * q.score;
        feedbackRubric.push({
          type: 'plus',
          text: `키워드 설정 없음: 기본 기본 점수 부여 +${contentScore.toFixed(1)}점`
        });
      }
      
      // Calculate Length Score (30%)
      let lengthScore = 0;
      const minChar = q.minChar;
      
      if (len >= minChar) {
        lengthScore = 0.30 * q.score;
        lengthCompliedCount++;
        feedbackRubric.push({
          type: 'plus',
          text: `글자수 조건 만족 (${len}자 작성 / ${minChar}자 이상): +${lengthScore.toFixed(1)}점`
        });
      } else {
        const lengthRatio = len / minChar;
        lengthScore = 0.30 * q.score * lengthRatio;
        const penalty = (0.30 * q.score) - lengthScore;
        
        feedbackRubric.push({
          type: 'minus',
          text: `글자수 미달 감점 (${len}자 작성 / ${minChar}자 이상): -${penalty.toFixed(1)}점`
        });
      }
      
      scoreObtained = Math.round(contentScore + lengthScore);
    }
    
    totalScore += scoreObtained;
    
    questionGrades.push({
      id: q.id,
      text: q.text,
      score: q.score,
      scoreObtained: scoreObtained,
      type: q.type,
      minChar: q.minChar,
      answer: answer,
      isIrrelevant: isIrrelevant,
      matchedKeywords: matchedKeywords,
      missedKeywords: missedKeywords,
      feedbackRubric: feedbackRubric
    });
  });

  // Calculate grade text
  let grade = 'F';
  const pct = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;
  if (pct >= 90) grade = '최우수 (A+)';
  else if (pct >= 80) grade = '우수 (A)';
  else if (pct >= 70) grade = '보통 (B)';
  else if (pct >= 60) grade = '통과 (C)';
  else grade = '재도전 필요 (F)';

  return {
    totalScore,
    totalMaxScore,
    grade,
    timeSpent: state.timeSpent,
    totalKeywordsMatched,
    totalKeywordsAssigned,
    lengthCompliedCount,
    questionGrades
  };
}

function renderReportDashboard(report) {
  // Fill Dashboard Metrics
  document.getElementById('total-score-obtained').textContent = report.totalScore;
  document.getElementById('total-grade-badge').textContent = report.grade;
  document.getElementById('report-subject').textContent = state.subject;
  
  // Format Time Spent
  const spentMins = Math.floor(report.timeSpent / 60);
  const spentSecs = report.timeSpent % 60;
  document.getElementById('report-time-spent').textContent = `${spentMins}분 ${spentSecs}초 / ${state.duration}분`;
  
  // Keyword Ratio
  const kwRatio = report.totalKeywordsAssigned > 0 
    ? Math.round((report.totalKeywordsMatched / report.totalKeywordsAssigned) * 100) 
    : 100;
  document.getElementById('report-keyword-ratio').textContent = `${kwRatio}% (${report.totalKeywordsMatched}/${report.totalKeywordsAssigned}개)`;
  
  // Length Compliance
  document.getElementById('report-length-compliance').textContent = `${report.lengthCompliedCount} / ${state.questions.length}문항 만족`;

  // Render detail cards
  detailedGradingContainer.innerHTML = '';
  
  report.questionGrades.forEach(g => {
    const card = document.createElement('div');
    card.className = `grading-card ${g.isIrrelevant ? 'failed-critical' : ''}`;
    
    // Build keywords list HTML
    let matchedBadges = g.matchedKeywords.map(kw => `<span class="mini-badge matched">✓ ${kw}</span>`).join(' ');
    let missedBadges = g.missedKeywords.map(kw => `<span class="mini-badge missed">✗ ${kw}</span>`).join(' ');
    
    // Build Rubric list
    let rubricHtml = '';
    g.feedbackRubric.forEach(r => {
      let icon = '✏️';
      if (r.type === 'plus') icon = '✅';
      else if (r.type === 'minus') icon = '⚠️';
      else if (r.type === 'critical') icon = '🚨';
      
      rubricHtml += `
        <div class="rubric-item ${r.type}">
          <span class="rubric-icon">${icon}</span>
          <span>${r.text}</span>
        </div>
      `;
    });
    
    // Add Recommendations from Dictionary
    let recommendationHtml = '';
    if (g.missedKeywords.length > 0) {
      let items = '';
      g.missedKeywords.forEach(kw => {
        // find explanation in dictionary
        const dictEntry = state.keywords.find(k => k.word.toLowerCase() === kw.toLowerCase());
        const descText = dictEntry ? dictEntry.desc : '요약 정보 없음';
        items += `<div class="study-suggestion-item">💡 <strong>${kw}</strong>: ${descText}</div>`;
      });
      
      recommendationHtml = `
        <div class="study-suggestion-box">
          <h4>개념 복습 추천</h4>
          <div class="study-suggestion-list">
            ${items}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="grading-card-header">
        <div class="exam-q-title-area">
          <span class="exam-q-num">${g.id}번 문항 (${LIMITS[g.type].name})</span>
          <h4 class="grading-q-title">${g.text}</h4>
        </div>
        <div class="grading-score-badge">
          <span class="q-score-num">${g.scoreObtained}</span>
          <span class="q-score-max">/ ${g.score}점</span>
        </div>
      </div>
      
      <div>
        <label>작성한 답안 (총 ${g.answer.length}자)</label>
        <div class="student-answer-box ${g.answer.length === 0 ? 'empty-answer' : ''}">${g.answer || '작성된 답안이 없습니다.'}</div>
      </div>
      
      <div class="grading-feedback-box">
        <div class="feedback-column">
          <h4>핵심 키워드 채점</h4>
          <div class="mini-badge-list">
            ${matchedBadges || '<span class="text-muted">일치 키워드 없음</span>'}
            ${missedBadges}
          </div>
        </div>
        <div class="feedback-column">
          <h4>감점 및 세부 내역</h4>
          <div class="rubric-text-list">
            ${rubricHtml}
          </div>
        </div>
      </div>
      
      ${recommendationHtml}
    `;
    
    detailedGradingContainer.appendChild(card);
  });
}

/* ==========================================================================
   EVENT LISTENERS & BINDINGS
   ========================================================================= */

function setupEventListeners() {
  // Add Keyword Button
  btnAddKeyword.addEventListener('click', () => {
    addKeywordRow('', '');
  });
  
  // Step 1 to Step 2
  document.getElementById('btn-goto-step2').addEventListener('click', () => {
    if (validateAndSaveStep1()) {
      renderQuestionConfigRows(parseInt(questionCountInput.value));
      showScreen(2);
    }
  });
  
  // Step 2 to Step 1
  document.getElementById('btn-back-to-step1').addEventListener('click', () => {
    showScreen(1);
  });
  
  // Step 2 to Step 3
  document.getElementById('btn-goto-step3').addEventListener('click', () => {
    processStep2AndGenerate();
  });
  
  // Step 3 to Step 2
  document.getElementById('btn-back-to-step2').addEventListener('click', () => {
    showScreen(2);
  });
  
  // Step 3 to Step 4 (Start Exam)
  document.getElementById('btn-start-exam').addEventListener('click', () => {
    if (confirm('모의시험을 시작하시겠습니까? 시작 즉시 타이머가 카운트다운을 시작합니다.')) {
      startExamSimulator();
    }
  });
  
  // Step 4 Submit
  document.getElementById('btn-submit-exam').addEventListener('click', () => {
    if (confirm('답안을 제출하시겠습니까? 제출 완료 후 즉시 채점과 피드백 대시보드로 이동합니다.')) {
      submitExam();
    }
  });
  
  // Close Timeout Modal
  document.getElementById('btn-close-modal-and-grade').addEventListener('click', () => {
    timesUpModal.classList.add('hidden');
    submitExam();
  });
  
  // Restart Exam (Step 5)
  document.getElementById('btn-restart-exam').addEventListener('click', () => {
    if (confirm('동일한 시험 설정(과목, 키워드, 문항 세팅)으로 모의시험을 다시 치르시겠습니까?')) {
      startExamSimulator();
    }
  });
  
  // New Exam (Step 5)
  document.getElementById('btn-new-exam').addEventListener('click', () => {
    if (confirm('기존 입력을 모두 초기화하고 완전히 새로운 모의시험을 설정하시겠습니까?')) {
      document.getElementById('subject-name').value = '';
      document.getElementById('exam-duration').value = '50';
      questionCountInput.value = '3';
      initKeywordRows();
      showScreen(1);
    }
  });
}
