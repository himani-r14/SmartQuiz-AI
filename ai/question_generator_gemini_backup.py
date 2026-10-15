from google import genai
from google.genai import types
import json
import os
import time

client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)


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
- Exactly 4 options.
- The answer must exactly match one option.
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
- Answer must be exactly "True" or "False".
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

    # Retry automatically if Gemini temporarily returns 503
    for attempt in range(3):

        try:

            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=instruction,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text.strip()

            return json.loads(result)

        except Exception as e:

            if "503" in str(e) and attempt < 2:
                print(f"Gemini temporarily busy. Retrying... ({attempt + 1}/3)")
                time.sleep(5)
            else:
                raise e