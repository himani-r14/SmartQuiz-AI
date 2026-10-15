const promptBox = document.getElementById("prompt");
const wordCount = document.getElementById("wordCount");

promptBox.addEventListener("input", function () {

    let words = this.value.trim().split(/\s+/);

    if (this.value.trim() === "") {
        wordCount.textContent = 0;
        return;
    }

    if (words.length > 1000) {
        words = words.slice(0, 1000);
        this.value = words.join(" ");
    }

    wordCount.textContent = words.length;
});


let generatedQuestions = [];
let quizTimerInterval = null;
let remainingSeconds = 0;
let quizSubmitted = false;

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



async function generateQuestions() {

    const prompt = promptBox.value.trim();

    const questionCount =
        document.getElementById("questionCount").value;

    const questionType =
        document.getElementById("questionType").value;

    const difficulty =
        document.getElementById("difficulty").value;


    if (prompt === "") {
        alert("Please enter a prompt first.");
        return;
    }


    const button = document.querySelector(".generate-btn");

    button.disabled = true;
    button.textContent = "Generating...";


    try {

        const response = await fetch("/generate", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                prompt: prompt,
                questionCount: questionCount,
                questionType: questionType,
                difficulty: difficulty

            })

        });


        const data = await response.json();


        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }


        generatedQuestions = data.questions;

        displayQuiz(generatedQuestions);


    } catch (error) {

        alert("Error: " + error.message);

    } finally {

        button.disabled = false;
        button.textContent = "✨ Generate Questions";

    }

}


function displayQuiz(questions) {
addAnswerColorStyles();
    const quizSection =
        document.getElementById("quizSection");

    const quizContainer =
        document.getElementById("quizContainer");

    quizContainer.innerHTML = "";


    questions.forEach((q, index) => {

        const card = document.createElement("div");

        card.className = "question-card";


        let answerHTML = "";


        // MCQ / True-False
        if (q.options && q.options.length > 0) {

            answerHTML = q.options.map(
                (option, optionIndex) => `

                <label class="option">

                    <input
                        type="radio"
                        name="question${index}"
                        value="${optionIndex}"
                    >

                    ${option}

                </label>

            `
            ).join("");

        }


        // Short Answer
        else {

            answerHTML = `

                <input
                    type="text"
                    class="short-answer"
                    id="shortAnswer${index}"
                    placeholder="Type your answer here..."
                >

            `;
        }


        card.innerHTML = `

            <h3>
                Question ${index + 1}: ${q.question}
            </h3>

            ${answerHTML}

        `;


        quizContainer.appendChild(card);
        
card.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener("change", function () {
        const selectedOption = q.options[Number(this.value)];
        const labels = card.querySelectorAll(".option");

        labels.forEach(label => {
            label.classList.remove(
                "answer-correct",
                "answer-wrong"
            );
        });

        const selectedLabel = this.closest(".option");

        
if (
    normalizeAnswer(selectedOption) ===
    normalizeAnswer(q.answer)
) {
    selectedLabel.classList.add("answer-correct");
} else {
    selectedLabel.classList.add("answer-wrong");

    labels.forEach(label => {
        const radio = label.querySelector('input[type="radio"]');

        if (
            radio &&
            normalizeAnswer(q.options[Number(radio.value)]) ===
            normalizeAnswer(q.answer)
        ) {
            label.classList.add("answer-correct");
        }
    });
}

    });
});


    });


    document.getElementById("resultBox").innerHTML = "";


    quizSection.style.display = "block";
    
startQuizTimer(questions.length);

    quizSection.scrollIntoView({
        behavior: "smooth"
    });

}

function addAnswerColorStyles() {
    if (document.getElementById("answerColorStyles")) return;

    const style = document.createElement("style");
    style.id = "answerColorStyles";

    style.textContent = `
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
        }

        .short-answer.answer-wrong {
            border: 2px solid #dc2626 !important;
            background-color: #fee2e2 !important;
        }
    `;

    document.head.appendChild(style);
}

function normalizeAnswer(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[.,!?;:]/g, "")
        .replace(/\s+/g, " ");
}
function submitQuiz() {
    
    if (quizSubmitted) return;

    quizSubmitted = true;
    clearInterval(quizTimerInterval);


    let correct = 0;
    let attempted = 0;

    let reviewHTML = "";

    generatedQuestions.forEach((q, index) => {

        let yourAnswer = "Not Attempted";
        let isCorrect = false;

        // MCQ / True-False
        if (q.options && q.options.length > 0) {

            const selected = document.querySelector(
                `input[name="question${index}"]:checked`
            );

            if (selected) {

                attempted++;

                yourAnswer =
                    q.options[parseInt(selected.value)];

               if (
    normalizeAnswer(yourAnswer) ===
    normalizeAnswer(q.answer)
) {
    correct++;
    isCorrect = true;
}
            }
        }

        // Short Answer
        else {

            const input =
                document.getElementById(`shortAnswer${index}`);

            if (input && input.value.trim() !== "") {

                attempted++;

                yourAnswer = input.value.trim();

                if (
                    normalizeAnswer(yourAnswer) ===
                    normalizeAnswer(q.answer)
                ) {
                    correct++;
                    isCorrect = true;
                }
            }
        }


if (q.options && q.options.length > 0) {
    const inputs = document.querySelectorAll(
        `input[name="question${index}"]`
    );

    inputs.forEach(input => {
        const option = q.options[Number(input.value)];
        const label = input.closest(".option");

        if (label) {
            if (
                normalizeAnswer(option) ===
                normalizeAnswer(q.answer)
            ) {
                label.classList.add("answer-correct");
            } else if (input.checked) {
                label.classList.add("answer-wrong");
            }
        }

        input.disabled = true;
    });
} else {
    const input = document.getElementById(
        `shortAnswer${index}`
    );

    if (input) {
        input.classList.add(
            isCorrect ? "answer-correct" : "answer-wrong"
        );
        input.disabled = true;
    }
}

        const statusClass =
            isCorrect ? "correct" : "wrong";

        const statusIcon =
            isCorrect ? "✅" : "❌";


        reviewHTML += `

            <div class="review-card ${statusClass}">

                <h4>
                    ${statusIcon}
                    Question ${index + 1}: ${q.question}
                </h4>

                <p class="your-answer">
                    <strong>Your Answer:</strong>
                    ${yourAnswer}
                </p>

                <p class="correct-answer">
                    <strong>Correct Answer:</strong>
                    ${q.answer}
                </p>

                <div class="explanation">
                    💡 <strong>Explanation:</strong>
                    ${q.explanation || "No explanation available."}
                </div>

            </div>

        `;
    });


    const total =
        generatedQuestions.length;

    const wrong =
        attempted - correct;

    const percentage =
        total > 0
        ? Math.round((correct / total) * 100)
        : 0;


    document.getElementById("resultBox").innerHTML = `

        <h2>🎯 Quiz Completed!</h2>

        <div class="percentage">
            ${percentage}%
        </div>

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