from flask import Flask, render_template, request, jsonify
from ai.question_generator import generate_questions

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()

        prompt = data.get("prompt", "").strip()
        question_count = int(data.get("questionCount", 10))
        question_type = data.get("questionType", "mcq")
        difficulty = data.get("difficulty", "medium")

        if not prompt:
            return jsonify({
                "error": "Please enter a prompt."
            }), 400

        if question_count < 1 or question_count > 50:
            return jsonify({
                "error": "Question count must be between 1 and 50."
            }), 400

        questions = generate_questions(
            prompt,
            question_count,
            question_type,
            difficulty
        )

        return jsonify({
            "questions": questions
        })

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(debug=True)