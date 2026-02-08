// ==================== STATE MANAGEMENT ====================

let state = {
    currentScreen: 'home',
    currentSubject: null,
    currentTopic: null,
    currentLesson: null,
    currentStep: 0,
    xp: 0,
    level: 1,
    streak: 3,
    flashcardIndex: 0,
    completedLessons: new Set(),
    exerciseAnswers: [],
    currentLeaderboard: 'xp'
};

// Load from localStorage
function loadState() {
    const saved = localStorage.getItem('kruai-state');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
        state.completedLessons = new Set(parsed.completedLessons || []);
        updateUI();
    }
}

function saveState() {
    const toSave = {
        ...state,
        completedLessons: Array.from(state.completedLessons)
    };
    localStorage.setItem('kruai-state', JSON.stringify(toSave));
}

function updateUI() {
    document.getElementById('xp-display').textContent = state.xp;
    document.getElementById('level-display').textContent = state.level;
    document.getElementById('streak-display').textContent = state.streak + '🔥';
    
    // Check for level up
    const xpForNextLevel = state.level * 100;
    if (state.xp >= xpForNextLevel) {
        state.level++;
        showBadge('🎉', `Level ${state.level}!`);
    }
}

// ==================== NAVIGATION ====================

function showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    // Show selected screen
    document.getElementById(screenName).classList.add('active');
    document.querySelector(`[data-screen="${screenName}"]`)?.classList.add('active');
    
    state.currentScreen = screenName;
    
    // Load screen-specific content
    if (screenName === 'flashcards') {
        loadFlashcards();
    } else if (screenName === 'leaderboard') {
        renderLeaderboard(state.currentLeaderboard);
    } else if (screenName === 'donate') {
        renderDonorLeaderboard();
    }
}

// Nav tab click handlers
document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const screen = tab.dataset.screen;
        showScreen(screen);
    });
});

// ==================== SUBJECT & TOPIC SELECTION ====================

function selectSubject(subjectId) {
    state.currentSubject = subjectId;
    const subject = curriculum[subjectId];
    
    document.getElementById('subject-title').textContent = subject.icon + ' ' + subject.name;
    
    const topicListHtml = Object.entries(subject.topics).map(([topicId, topic]) => {
        const completed = state.completedLessons.has(`${subjectId}-${topicId}`);
        return `
            <div class="topic-item ${completed ? 'completed' : ''}" onclick="selectTopic('${topicId}')">
                <div class="topic-info">
                    <h3>${topic.name}</h3>
                    <div class="topic-meta">
                        <span>📚 ${topic.fundamentals.length} lessons</span>
                        <span>🗂️ ${topic.flashcards.length} flashcards</span>
                    </div>
                </div>
                <div class="topic-status">
                    <div class="status-badge ${completed ? 'completed' : ''}"></div>
                    <span>${completed ? 'Completed' : 'Start'}</span>
                </div>
            </div>
        `;
    }).join('');
    
    document.getElementById('topic-list').innerHTML = topicListHtml;
    showScreen('topic-selection');
}

function selectTopic(topicId) {
    state.currentTopic = topicId;
    state.currentStep = 0;
    state.exerciseAnswers = [];
    
    const topic = curriculum[state.currentSubject].topics[topicId];
    const lessons = Object.values(topic.lessons);
    
    showLesson(lessons[0]);
}

function backToTopics() {
    showScreen('topic-selection');
}

function resumeLesson(subject, topic) {
    selectSubject(subject);
    selectTopic(topic);
}

// ==================== LESSON DISPLAY ====================

function showLesson(lesson) {
    const content = `
        <h1 class="card-title">${lesson.title}</h1>
        <div class="lesson-content">${lesson.content}</div>
    `;
    
    document.getElementById('lesson-content').innerHTML = content;
    showScreen('lesson');
}

function nextStep() {
    const topic = curriculum[state.currentSubject].topics[state.currentTopic];
    const lessons = Object.values(topic.lessons);
    
    state.currentStep++;
    
    if (state.currentStep < lessons.length) {
        // Show next lesson
        showLesson(lessons[state.currentStep]);
    } else if (state.currentStep === lessons.length) {
        // Show flashcards
        showTopicFlashcards();
    } else if (state.currentStep === lessons.length + 1) {
        // Show exercises
        showExercises();
    } else {
        // Complete topic
        completeTopic();
    }
}

function showTopicFlashcards() {
    const topic = curriculum[state.currentSubject].topics[state.currentTopic];
    state.flashcardIndex = 0;
    
    const content = `
        <h1 class="card-title">Review with Flashcards 🗂️</h1>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-md);">
            Let's review what you learned! Click the card to flip it.
        </p>
        <div id="flashcard-review"></div>
    `;
    
    document.getElementById('lesson-content').innerHTML = content;
    renderCurrentFlashcard(topic.flashcards);
}

function renderCurrentFlashcard(flashcards) {
    const card = flashcards[state.flashcardIndex];
    const html = `
        <div class="flashcard-container">
            <div class="flashcard" id="current-flashcard" onclick="this.classList.toggle('flipped')">
                <div class="flashcard-face flashcard-front">
                    <div class="flashcard-text">${card.question}</div>
                    <p style="margin-top: var(--space-md); font-size: 0.9rem; opacity: 0.8;">Tap to see answer</p>
                </div>
                <div class="flashcard-face flashcard-back">
                    <div class="flashcard-text">${card.answer}</div>
                    <p style="margin-top: var(--space-md); font-size: 0.9rem; opacity: 0.8;">Tap to see question</p>
                </div>
            </div>
        </div>
        <p class="text-center" style="margin-top: var(--space-md); color: var(--text-muted); font-family: var(--font-mono);">
            Card ${state.flashcardIndex + 1} of ${flashcards.length}
        </p>
    `;
    
    document.getElementById('flashcard-review').innerHTML = html;
}

function showExercises() {
    const topic = curriculum[state.currentSubject].topics[state.currentTopic];
    state.exerciseAnswers = new Array(topic.exercises.length).fill(null);
    
    const exercisesHtml = topic.exercises.map((ex, idx) => `
        <div class="exercise-question">
            <div class="question-text">Question ${idx + 1}: ${ex.question}</div>
            <div class="options" id="options-${idx}">
                ${ex.options.map((opt, optIdx) => `
                    <div class="option" onclick="selectAnswer(${idx}, ${optIdx})">
                        ${opt}
                    </div>
                `).join('')}
            </div>
            <div class="feedback" id="feedback-${idx}"></div>
        </div>
    `).join('');
    
    const content = `
        <h1 class="card-title">Practice Exercises 📝</h1>
        <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">
            Test your understanding! Select the best answer for each question.
        </p>
        ${exercisesHtml}
    `;
    
    document.getElementById('lesson-content').innerHTML = content;
}

function selectAnswer(exerciseIdx, optionIdx) {
    const topic = curriculum[state.currentSubject].topics[state.currentTopic];
    const exercise = topic.exercises[exerciseIdx];
    
    // Remove previous selections
    document.querySelectorAll(`#options-${exerciseIdx} .option`).forEach(opt => {
        opt.classList.remove('selected', 'correct', 'incorrect');
    });
    
    // Mark selected
    const options = document.querySelectorAll(`#options-${exerciseIdx} .option`);
    options[optionIdx].classList.add('selected');
    
    // Check if correct
    const isCorrect = optionIdx === exercise.correct;
    state.exerciseAnswers[exerciseIdx] = isCorrect;
    
    // Show feedback
    const feedback = document.getElementById(`feedback-${exerciseIdx}`);
    if (isCorrect) {
        options[optionIdx].classList.add('correct');
        feedback.className = 'feedback correct show';
        feedback.innerHTML = `
            <strong>✓ Correct!</strong><br>
            ${exercise.explanation}
        `;
        
        // Award XP
        addXP(10);
    } else {
        options[optionIdx].classList.add('incorrect');
        options[exercise.correct].classList.add('correct');
        feedback.className = 'feedback incorrect show';
        feedback.innerHTML = `
            <strong>✗ Not quite.</strong><br>
            ${exercise.explanation}
        `;
    }
}

function completeTopic() {
    const topicKey = `${state.currentSubject}-${state.currentTopic}`;
    state.completedLessons.add(topicKey);
    
    // Award completion XP
    addXP(50);
    showBadge('🎉', 'Topic Completed!');
    
    saveState();
    setTimeout(() => {
        showScreen('subjects');
    }, 2000);
}

// ==================== FLASHCARDS ====================

function loadFlashcards() {
    const allFlashcards = [];
    
    Object.entries(curriculum).forEach(([subjectId, subject]) => {
        Object.entries(subject.topics).forEach(([topicId, topic]) => {
            topic.flashcards.forEach(card => {
                allFlashcards.push({
                    ...card,
                    subject: subject.name,
                    topic: topic.name
                });
            });
        });
    });
    
    state.flashcardIndex = 0;
    renderFlashcardDeck(allFlashcards);
}

function renderFlashcardDeck(flashcards) {
    if (flashcards.length === 0) {
        document.getElementById('flashcard-deck').innerHTML = '<p>No flashcards yet. Complete some lessons first!</p>';
        return;
    }
    
    const card = flashcards[state.flashcardIndex];
    const html = `
        <div style="margin-bottom: var(--space-md);">
            <span style="font-family: var(--font-mono); color: var(--text-muted); font-size: 0.9rem;">
                ${card.subject} → ${card.topic}
            </span>
        </div>
        <div class="flashcard-container">
            <div class="flashcard" id="main-flashcard" onclick="this.classList.toggle('flipped')">
                <div class="flashcard-face flashcard-front">
                    <div class="flashcard-text">${card.question}</div>
                    <p style="margin-top: var(--space-md); font-size: 0.9rem; opacity: 0.8;">Tap to see answer</p>
                </div>
                <div class="flashcard-face flashcard-back">
                    <div class="flashcard-text">${card.answer}</div>
                    <p style="margin-top: var(--space-md); font-size: 0.9rem; opacity: 0.8;">Tap to see question</p>
                </div>
            </div>
        </div>
        <p class="text-center" style="margin-top: var(--space-md); color: var(--text-muted); font-family: var(--font-mono);">
            Card ${state.flashcardIndex + 1} of ${flashcards.length}
        </p>
    `;
    
    document.getElementById('flashcard-deck').innerHTML = html;
}

function previousFlashcard() {
    const allFlashcards = [];
    Object.values(curriculum).forEach(subject => {
        Object.values(subject.topics).forEach(topic => {
            topic.flashcards.forEach(card => {
                allFlashcards.push({
                    ...card,
                    subject: subject.name,
                    topic: topic.name
                });
            });
        });
    });
    
    if (state.flashcardIndex > 0) {
        state.flashcardIndex--;
        document.getElementById('main-flashcard')?.classList.remove('flipped');
        renderFlashcardDeck(allFlashcards);
    }
}

function nextFlashcard() {
    const allFlashcards = [];
    Object.values(curriculum).forEach(subject => {
        Object.values(subject.topics).forEach(topic => {
            topic.flashcards.forEach(card => {
                allFlashcards.push({
                    ...card,
                    subject: subject.name,
                    topic: topic.name
                });
            });
        });
    });
    
    if (state.flashcardIndex < allFlashcards.length - 1) {
        state.flashcardIndex++;
        document.getElementById('main-flashcard')?.classList.remove('flipped');
        renderFlashcardDeck(allFlashcards);
    }
}

// ==================== AI COACH ====================

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.innerHTML += `
        <div class="chat-message user">
            <div class="message-avatar user">👤</div>
            <div class="message-content">${message}</div>
        </div>
    `;
    
    input.value = '';
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Show loading
    chatContainer.innerHTML += `
        <div class="chat-message ai" id="ai-loading">
            <div class="message-avatar ai">🤖</div>
            <div class="message-content">
                <div class="spinner" style="width: 20px; height: 20px; margin: 0;"></div>
            </div>
        </div>
    `;
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                messages: [
                    { 
                        role: "user", 
                        content: `You are a helpful study coach for Grade 12 students in Cambodia preparing for their Bac II exams. The student is learning about: Math (Limits, Probability) and Biology (Human Body, Human Brain). 

Answer their question clearly and encouragingly. Use simple language and examples. Break down complex concepts step-by-step.

Student's question: ${message}` 
                    }
                ],
            })
        });
        
        const data = await response.json();
        const aiResponse = data.content[0].text;
        
        // Remove loading
        document.getElementById('ai-loading').remove();
        
        // Add AI response
        chatContainer.innerHTML += `
            <div class="chat-message ai">
                <div class="message-avatar ai">🤖</div>
                <div class="message-content">${aiResponse}</div>
            </div>
        `;
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('ai-loading').remove();
        chatContainer.innerHTML += `
            <div class="chat-message ai">
                <div class="message-avatar ai">🤖</div>
                <div class="message-content">
                    I apologize, but I'm having trouble connecting right now. Please try asking your question again, or review the lesson content in the Subjects section!
                </div>
            </div>
        `;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// ==================== LEADERBOARD (FAKE) ====================

function switchLeaderboard(type) {
    state.currentLeaderboard = type;
    
    // Update tabs
    document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderLeaderboard(type);
}

function renderLeaderboard(type) {
    const data = fakeLeaderboardData[type];
    
    const html = data.map(item => {
        let rankClass = '';
        if (item.rank === 1) rankClass = 'gold';
        else if (item.rank === 2) rankClass = 'silver';
        else if (item.rank === 3) rankClass = 'bronze';
        
        return `
            <div class="leaderboard-item">
                <div class="lb-rank ${rankClass}">#${item.rank}</div>
                <div class="lb-avatar">${item.avatar}</div>
                <div class="lb-info">
                    <div class="lb-name">${item.name}</div>
                    <div class="lb-school">${item.school}</div>
                </div>
                <div class="lb-score">${item.score}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('leaderboard-content').innerHTML = html;
}

// ==================== DONATIONS (FAKE) ====================

function renderDonorLeaderboard() {
    const html = fakeDonorData.map(item => `
        <div class="donor-item">
            <div class="donor-info">
                <span class="donor-rank">${item.rank}.</span>
                <span class="donor-name">${item.name}</span>
            </div>
            <div class="donor-amount">${item.amount}</div>
        </div>
    `).join('');
    
    document.getElementById('donor-leaderboard').innerHTML = html;
}

function showDonationMessage(method) {
    const messages = {
        'ABA Bank': '🏦 ABA Bank donation feature is coming soon! We\'re working with banks to set up secure payment processing. Thank you for your interest in supporting students!',
        'Watch Ads': '📺 Watch ads to donate feature is coming soon! We\'re partnering with advertisers to make this possible. Every view will help a student in need!'
    };
    
    alert(messages[method]);
}

// ==================== GAMIFICATION ====================

function addXP(amount) {
    state.xp += amount;
    saveState();
    updateUI();
    
    // Show XP gain animation
    const xpEl = document.createElement('div');
    xpEl.className = 'xp-gain';
    xpEl.textContent = `+${amount} XP`;
    document.body.appendChild(xpEl);
    
    setTimeout(() => xpEl.remove(), 1500);
}

function showBadge(icon, title) {
    const badgeEl = document.createElement('div');
    badgeEl.className = 'badge-unlock';
    badgeEl.innerHTML = `
        <div class="badge-icon">${icon}</div>
        <div class="badge-title">${title}</div>
    `;
    document.body.appendChild(badgeEl);
    
    setTimeout(() => badgeEl.remove(), 2000);
}

// ==================== INIT ====================

window.addEventListener('DOMContentLoaded', () => {
    loadState();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.log('Service worker registration failed:', err);
        });
    }
});

// Auto-save every 30 seconds
setInterval(saveState, 30000);
