
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
Each question must have exactly 4 different, non-empty options.
The answer must exactly match one of the options.
Do not use null or blank options.
"""

    elif question_type == "truefalse":
        format_instruction = """
Each question must have options ["True", "False"].
The answer must be exactly "True" or "False".
"""

    else:
        format_instruction = """
For short-answer questions, options must be [].
Keep the answer short and clear.
"""

    instruction = f"""
You are an AI quiz generator.

Create exactly {question_count} questions based ONLY on this content:

{prompt}

Question type: {question_type}
Difficulty: {difficulty}

Return ONLY a valid JSON array.
Each object must contain:
"question", "options", "answer", "explanation"

{format_instruction}

Do not use markdown.
Do not write anything before or after the JSON.
"""

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=instruction,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            if not response.text:
                raise ValueError("Gemini returned an empty response.")

            result = response.text.strip()
            questions = json.loads(result)

            if not isinstance(questions, list):
                raise ValueError("Gemini did not return a JSON list.")

            if len(questions) != question_count:
                raise ValueError(
                    f"Expected {question_count} questions, "
                    f"but received {len(questions)}."
                )

            for question in questions:
                if not isinstance(question, dict):
                    raise ValueError("Invalid question format.")

                if question_type == "mcq":
                    options = question.get("options", [])

                    if (
                        not isinstance(options, list)
                        or len(options) != 4
                        or any(
                            not isinstance(option, str)
                            or not option.strip()
                            for option in options
                        )
                        or len(set(option.strip() for option in options)) != 4
                    ):
                        raise ValueError(
                            "Generated MCQ has blank or duplicate options."
                        )

                    if question.get("answer") not in options:
                        raise ValueError(
                            "Correct answer does not match any option."
                        )

                elif question_type == "truefalse":
                    if question.get("options") != ["True", "False"]:
                        raise ValueError(
                            "Invalid True/False options."
                        )

                    if question.get("answer") not in ["True", "False"]:
                        raise ValueError(
                            "Invalid True/False answer."
                        )

                elif question_type == "short":
                    if question.get("options") != []:
                        raise ValueError(
                            "Short-answer options must be empty."
                        )

            return questions

        except Exception as e:
            error_message = str(e).upper()

            is_temporary_error = (
                "503" in error_message
                or "UNAVAILABLE" in error_message
            )

            if is_temporary_error and attempt < 2:
                print(
                    f"Gemini temporarily busy. Retrying... "
                    f"({attempt + 1}/3)"
                )
                time.sleep(5)
            else:
                raise
