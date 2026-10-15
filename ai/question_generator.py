import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY is not loaded from .env")

client = genai.Client(api_key=api_key)


def generate_questions(prompt, question_count, question_type, difficulty):

    if question_type == "mcq":

        format_instruction = """
For each question use this format:

{
    "question": "Question text",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Correct option",
    "explanation": "Short explanation"
}

Rules:
- Each question must have exactly 4 options.
- The answer must exactly match one of the options.
- Never leave an option blank.
- Every option must contain meaningful text.
- Do not use empty strings.
- All 4 options must be different.
- Do not use null as an option.
- Do not use whitespace-only options.
"""

    elif question_type == "truefalse":

        format_instruction = """
For each question use this format:

{
    "question": "Statement",
    "options": ["True", "False"],
    "answer": "True",
    "explanation": "Short explanation"
}

Rules:
- The answer must be exactly "True" or "False".
- Options must always be exactly ["True", "False"].
"""

    else:

        format_instruction = """
For each question use this format:

{
    "question": "Question text",
    "options": [],
    "answer": "Correct short answer",
    "explanation": "Short explanation"
}

Rules:
- Do not provide multiple-choice options.
- Keep the answer short and clear.
"""

    instruction = f"""
You are an AI quiz generator.

Create exactly {question_count} questions based ONLY on this content:

{prompt}

Question type: {question_type}
Difficulty: {difficulty}

Return ONLY a JSON array.

{format_instruction}

General rules:
- Generate exactly {question_count} questions.
- Keep questions clear and educational.
- Questions must be based on the supplied content.
"""

    for attempt in range(3):

        try:

            response = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=instruction,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text.strip()

            questions = json.loads(result)

            # Safety check for MCQ blank options
            if question_type == "mcq":

                for question in questions:

                    options = question.get("options", [])

                    # Make sure there are exactly 4 non-empty options
                    if (
                        len(options) != 4
                        or any(
                            not isinstance(option, str)
                            or not option.strip()
                            for option in options
                        )
                        or len(set(option.strip() for option in options)) != 4
                    ):
                        raise ValueError(
                            "Gemini generated an invalid MCQ with blank or duplicate options."
                        )

                    # Make sure the correct answer exists in options
                    if question.get("answer") not in options:
                        raise ValueError(
                            "Gemini generated an MCQ where the answer does not match an option."
                        )

            return questions

        except Exception as e:

            if "503" in str(e) and attempt < 2:

                print(
                    f"Gemini temporarily busy. Retrying... ({attempt + 1}/3)"
                )

                time.sleep(5)

            else:
                raise