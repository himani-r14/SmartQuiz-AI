
import os
import json
import time
import random

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY is missing. Check your .env file "
        "or Render environment variables."
    )

client = genai.Client(api_key=api_key)


def generate_questions(prompt, question_count, question_type, difficulty):
    if question_type not in ("mcq", "truefalse", "short"):
        raise ValueError(f"Invalid question type: {question_type}")

    if not isinstance(question_count, int) or not 1 <= question_count <= 50:
        raise ValueError("Question count must be between 1 and 50.")

    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Please enter a topic or study material.")

    if question_type == "mcq":
        format_instruction = """
Each question must have exactly 4 different, non-empty options.
The answer must exactly match one option.
"""
    elif question_type == "truefalse":
        format_instruction = """
Each question must have options ["True", "False"].
The answer must be exactly "True" or "False".
"""
    else:
        format_instruction = """
Each question must have options [].
The answer must be a short, clear text answer.
"""

    instruction = f"""
You are an AI quiz generator.

Create exactly {question_count} questions based ONLY on this content:
{prompt}

Question type: {question_type}
Difficulty: {difficulty}

Return ONLY a valid JSON array.
Every object must contain:
"question", "options", "answer", "explanation"

{format_instruction}

Do not add Markdown or text outside the JSON.
"""

    last_error = None

    for attempt in range(3):
        try:
            response = client.models.generate_content(
               model="gemini-3.5-flash-lite",
                contents=instruction,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )

            if not response.text:
                raise ValueError("Gemini returned an empty response.")

            questions = json.loads(response.text.strip())

            if not isinstance(questions, list):
                raise ValueError("Gemini did not return a JSON array.")

            if len(questions) != question_count:
                raise ValueError(
                    f"Expected {question_count} questions, "
                    f"but received {len(questions)}."
                )

            for question in questions:
                if not isinstance(question, dict):
                    raise ValueError("Invalid question format.")

                for field in ("question", "options", "answer", "explanation"):
                    if field not in question:
                        raise ValueError(f"Missing field: {field}")

                if not isinstance(question["question"], str) or not question["question"].strip():
                    raise ValueError("Question text is empty.")

                if not isinstance(question["answer"], str) or not question["answer"].strip():
                    raise ValueError("Answer is empty or invalid.")

                if not isinstance(question["explanation"], str):
                    raise ValueError("Explanation must be text.")

                options = question["options"]

                if question_type == "mcq":
                    if (
                        not isinstance(options, list)
                        or len(options) != 4
                        or any(
                            not isinstance(option, str) or not option.strip()
                            for option in options
                        )
                        or len(set(option.strip() for option in options)) != 4
                    ):
                        raise ValueError(
                            "MCQ must have exactly 4 unique, non-empty options."
                        )

                    if question["answer"] not in options:
                        raise ValueError("Correct answer must match an option.")

                elif question_type == "truefalse":
                    if options != ["True", "False"]:
                        raise ValueError("Invalid True/False options.")

                    if question["answer"] not in ("True", "False"):
                        raise ValueError("Invalid True/False answer.")

                elif question_type == "short":
                    if options != []:
                        raise ValueError("Short-answer options must be [].")

            # Shuffle only MCQ options; keep the correct answer unchanged.
            if question_type == "mcq":
                for question in questions:
                    random.shuffle(question["options"])

            return questions

        except Exception as error:
            last_error = error
            message = str(error).upper()

            temporary_error = any(
                marker in message
                for marker in (
                    "503",
                    "UNAVAILABLE",
                    "429",
                    "RESOURCE_EXHAUSTED",
                    "500",
                    "INTERNAL",
                    "TIMEOUT",
                    "TIMED OUT",
                )
            )

            if temporary_error and attempt < 2:
                wait_seconds = 3 * (attempt + 1)
                print(
                    f"Temporary Gemini error. Retrying in "
                    f"{wait_seconds} seconds "
                    f"(attempt {attempt + 2}/3)."
                )
                time.sleep(wait_seconds)
                continue

            raise RuntimeError(
                f"Quiz generation failed: {error}"
            ) from error

    raise RuntimeError(
        f"Quiz generation failed after retries: {last_error}"
    ) from last_error
