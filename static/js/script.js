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

    });


    document.getElementById("resultBox").innerHTML = "";


    quizSection.style.display = "block";


    quizSection.scrollIntoView({
        behavior: "smooth"
    });

}
function normalizeAnswer(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[.,!?;:]/g, "")
        .replace(/\s+/g, " ");
}
function submitQuiz() {

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