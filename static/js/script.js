
const promptBox = document.getElementById("prompt");
const wordCount = document.getElementById("wordCount");

let generatedQuestions = [];
let quizTimerInterval = null;
let remainingSeconds = 0;
let quizSubmitted = false;

// Word counter
if (promptBox && wordCount) {
    promptBox.addEventListener("input", function () {
        let words = this.value.trim()
            ? this.value.trim().split(/\s+/)
            : [];

        if (words.length > 1000) {
            words = words.slice(0, 1000);
            this.value = words.join(" ");
        }

        wordCount.textContent = words.length;
    });
}

// Safe text insertion into HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function normalizeAnswer(text) {
    return String(text ?? "")
        .toLowerCase()
        .trim()
        .replace(/[.,!?;:]/g, "")
        .replace(/\s+/g, " ");
}

// Answer colors and neutral default option appearance
function addAnswerColorStyles() {
    if (document.getElementById("answerColorStyles")) return;

    const style = document.createElement("style");
    style.id = "answerColorStyles";

    style.textContent = `
        .option:not(.answer-correct):not(.answer-wrong) {
            background-color: transparent !important;
            border-color: #cbd5e1 !important;
            color: inherit !important;
        }

        .option.answer-correct {
            background-color: #dcfce7 !important;
            border: 2px solid #16a34a !important;
            color: #166534 !important;
        }

        .option.answer-wrong {
            background-color: #fee2e2 !important;
            border: 2px solid #dc2626 !important;
            color: #991b1b !important;
        }

        .short-answer.answer-correct {
            border: 2px solid #16a34a !important;
            background-color: #dcfce7 !important;
            color: #166534 !important;
        }

        .short-answer.answer-wrong {
            border: 2px solid #dc2626 !important;
            background-color: #fee2e2 !important;
            color: #991b1b !important;
        }
    `;

    document.head.appendChild(style);
}

// Quiz timer: 30 seconds per question
function startQuizTimer(questionCount) {
    clearInterval(quizTimerInterval);

    quizSubmitted = false;
    remainingSeconds = questionCount * 30;

    let timer = document.getElementById("quizTimer");

    if (!timer) {
        timer = document.createElement("div");
        timer.id = "quizTimer";
        document.body.appendChild(timer);
    }

    timer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        background: #1e293b;
        color: white;
        padding: 12px 18px;
        border-radius: 12px;
        font-size: 18px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;

    function updateTimer() {
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;

        timer.textContent =
            `⏱️ ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

        timer.style.background =
            remainingSeconds <= 10 ? "#dc2626" : "#1e293b";
    }

    updateTimer();

    quizTimerInterval = setInterval(() => {
        if (remainingSeconds > 0) {
            remainingSeconds--;
            updateTimer();
        } else {
            clearInterval(quizTimerInterval);
            submitQuiz();
        }
    }, 1000);
}

// Generate quiz
async function generateQuestions() {
    const prompt = promptBox?.value.trim() || "";

    const questionCount = Number(
        document.getElementById("questionCount")?.value || 10
    );

    const questionType =
        document.getElementById("questionType")?.value || "mcq";

    const difficulty =
        document.getElementById("difficulty")?.value || "medium";

    if (!prompt) {
        alert("Please enter a topic or study material first.");
        return;
    }

    if (!Number.isInteger(questionCount) ||
        questionCount < 1 || questionCount > 50) {
        alert("Please select between 1 and 50 questions.");
        return;
    }

    const button = document.querySelector(".generate-btn");

    if (!button) {
        alert("Generate button was not found.");
        return;
    }

    button.disabled = true;
    button.textContent = "Generating...";

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt,
                questionCount,
                questionType,
                difficulty
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Quiz generation failed.");
        }

        if (!Array.isArray(data.questions) ||
            data.questions.length === 0) {
            throw new Error("The server returned no questions.");
        }

        // Validate questions before displaying them
        data.questions.forEach((q, index) => {
            if (!q || typeof q.question !== "string" ||
                !q.question.trim() ||
                typeof q.answer !== "string" ||
                !q.answer.trim()) {
                throw new Error(
                    `Question ${index + 1} has missing question or answer text.`
                );
            }

            if (!Array.isArray(q.options)) {
                throw new Error(
                    `Question ${index + 1} has invalid options.`
                );
            }

            if (questionType === "mcq" &&
                (q.options.length !== 4 ||
                 q.options.some(option =>
                    typeof option !== "string" || !option.trim()
                 ) ||
                 new Set(q.options.map(normalizeAnswer)).size !== 4)) {
                throw new Error(
                    `Question ${index + 1} must have 4 unique options.`
                );
            }

            if (questionType === "truefalse" &&
                (q.options.length !== 2 ||
                 !q.options.includes("True") ||
                 !q.options.includes("False"))) {
                throw new Error(
                    `Question ${index + 1} has invalid True/False options.`
                );
            }

            if (questionType === "short" && q.options.length !== 0) {
                throw new Error(
                    `Question ${index + 1} has invalid short-answer options.`
                );
            }

            if (questionType !== "short" &&
                !q.options.some(option =>
                    normalizeAnswer(option) === normalizeAnswer(q.answer)
                )) {
                throw new Error(
                    `Question ${index + 1} has an answer missing from its options.`
                );
            }
        });

        generatedQuestions = data.questions.map(q => ({
            ...q,
            options: [...q.options]
        }));

        // Shuffle MCQ options while keeping answer text unchanged.
        // Fisher-Yates shuffle.
        if (questionType === "mcq") {
            generatedQuestions.forEach(q => {
                for (let i = q.options.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [q.options[i], q.options[j]] =
                        [q.options[j], q.options[i]];
                }
            });
        }

        displayQuiz(generatedQuestions);

    } catch (error) {
        console.error("Quiz generation error:", error);
        alert("Error: " + error.message);
    } finally {
        button.disabled = false;
        button.textContent = "✨ Generate Questions";
    }
}

// Display quiz
function displayQuiz(questions) {
    addAnswerColorStyles();

    const quizSection = document.getElementById("quizSection");
    const quizContainer = document.getElementById("quizContainer");
    const resultBox = document.getElementById("resultBox");

    if (!quizSection || !quizContainer || !resultBox) {
        alert("Quiz page elements are missing. Check index.html.");
        return;
    }

    clearInterval(quizTimerInterval);
    quizSubmitted = false;

    quizContainer.innerHTML = "";
    resultBox.innerHTML = "";

    questions.forEach((q, index) => {
        const card = document.createElement("div");
        card.className = "question-card";

        let answerHTML = "";

        if (q.options.length > 0) {
            answerHTML = q.options.map((option, optionIndex) => `
                <label class="option">
                    <input
                        type="radio"
                        name="question${index}"
                        value="${optionIndex}"
                    >
                    <span>${escapeHTML(option)}</span>
                </label>
            `).join("");
        } else {
            answerHTML = `
                <input
                    type="text"
                    class="short-answer"
                    id="shortAnswer${index}"
                    placeholder="Type your answer here..."
                    autocomplete="off"
                >
            `;
        }

        card.innerHTML = `
            <h3>Question ${index + 1}: ${escapeHTML(q.question)}</h3>
            ${answerHTML}
        `;

        quizContainer.appendChild(card);

        card.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener("change", function () {
                if (quizSubmitted) return;

                const selectedOption = q.options[Number(this.value)];
                const labels = card.querySelectorAll(".option");

                labels.forEach(label => {
                    label.classList.remove(
                        "answer-correct",
                        "answer-wrong"
                    );
                });

                const selectedLabel = this.closest(".option");

                if (normalizeAnswer(selectedOption) ===
                    normalizeAnswer(q.answer)) {
                    selectedLabel.classList.add("answer-correct");
                } else {
                    selectedLabel.classList.add("answer-wrong");

                    labels.forEach(label => {
                        const radio = label.querySelector(
                            'input[type="radio"]'
                        );

                        if (radio &&
                            normalizeAnswer(
                                q.options[Number(radio.value)]
                            ) === normalizeAnswer(q.answer)) {
                            label.classList.add("answer-correct");
                        }
                    });
                }
            });
        });
    });

    quizSection.style.display = "block";

    startQuizTimer(questions.length);

    quizSection.scrollIntoView({
        behavior: "smooth"
    });
}

// Submit quiz and show results
function submitQuiz() {
    if (quizSubmitted || generatedQuestions.length === 0) return;

    quizSubmitted = true;
    clearInterval(quizTimerInterval);

    let correct = 0;
    let attempted = 0;
    let reviewHTML = "";

    generatedQuestions.forEach((q, index) => {
        let yourAnswer = "Not Attempted";
        let isCorrect = false;

        if (q.options.length > 0) {
            const selected = document.querySelector(
                `input[name="question${index}"]:checked`
            );

            if (selected) {
                attempted++;
                yourAnswer = q.options[Number(selected.value)];

                isCorrect =
                    normalizeAnswer(yourAnswer) ===
                    normalizeAnswer(q.answer);

                if (isCorrect) correct++;
            }

            document.querySelectorAll(
                `input[name="question${index}"]`
            ).forEach(input => {
                const option = q.options[Number(input.value)];
                const label = input.closest(".option");

                if (label) {
                    label.classList.remove(
                        "answer-correct",
                        "answer-wrong"
                    );

                    if (normalizeAnswer(option) ===
                        normalizeAnswer(q.answer)) {
                        label.classList.add("answer-correct");
                    } else if (input.checked) {
                        label.classList.add("answer-wrong");
                    }
                }

                input.disabled = true;
            });

        } else {
            const input = document.getElementById(`shortAnswer${index}`);

            if (input && input.value.trim()) {
                attempted++;
                yourAnswer = input.value.trim();

                isCorrect =
                    normalizeAnswer(yourAnswer) ===
                    normalizeAnswer(q.answer);

                if (isCorrect) correct++;
            }

            if (input) {
                input.classList.add(
                    isCorrect ? "answer-correct" : "answer-wrong"
                );
                input.disabled = true;
            }
        }

        const statusClass = isCorrect ? "correct" : "wrong";
        const statusIcon = isCorrect ? "✅" : "❌";

        reviewHTML += `
            <div class="review-card ${statusClass}">
                <h4>
                    ${statusIcon}
                    Question ${index + 1}: ${escapeHTML(q.question)}
                </h4>

                <p class="your-answer">
                    <strong>Your Answer:</strong>
                    ${escapeHTML(yourAnswer)}
                </p>

                <p class="correct-answer">
                    <strong>Correct Answer:</strong>
                    ${escapeHTML(q.answer)}
                </p>

                <div class="explanation">
                    💡 <strong>Explanation:</strong>
                    ${escapeHTML(q.explanation || "No explanation available.")}
                </div>
            </div>
        `;
    });

    const total = generatedQuestions.length;
    const wrong = attempted - correct;
    const percentage = total > 0
        ? Math.round((correct / total) * 100)
        : 0;

    const resultBox = document.getElementById("resultBox");

    resultBox.innerHTML = `
        <h2>🎯 Quiz Completed!</h2>

        <div class="percentage">${percentage}%</div>

        <div class="result-stats">
            <div class="result-card">
                <span class="value">${total}</span>
                <span class="label">Total Questions</span>
            </div>

            <div class="result-card">
                <span class="value">${attempted}</span>
                <span class="label">Attempted</span>
            </div>

            <div class="result-card">
                <span class="value">${correct}</span>
                <span class="label">Correct</span>
            </div>

            <div class="result-card">
                <span class="value">${wrong}</span>
                <span class="label">Wrong</span>
            </div>

            <div class="result-card">
                <span class="value">${correct} / ${total}</span>
                <span class="label">Score</span>
            </div>
        </div>

        <div class="review-section">
            <h3>📋 Question-wise Review</h3>
            ${reviewHTML}
        </div>
    `;
}
