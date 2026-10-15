import os
import json
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(
    api_key=os.environ.get("GEMINI_API_KEY")
)

def generate_questions(prompt, question_count, question_type, difficulty):

    if question_type == "mcq":
        format_instruction = """
Each question must have exactly 4 options.
The answer must exactly match one option.
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

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=instruction
    )

    result = response.text.strip()

    if result.startswith("```"):
        result = result.replace("```json", "").replace("```", "").strip()

    return json.loads(result)