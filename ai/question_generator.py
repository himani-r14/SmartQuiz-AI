import ollama
import json


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

Return ONLY valid JSON.
Do not use markdown.
Do not write anything before or after the JSON.

Return a JSON array.

{format_instruction}

General rules:
- Generate exactly {question_count} questions.
- Keep questions clear and educational.
- Questions must be based on the supplied content.
"""


    response = ollama.chat(
        model="qwen2.5:3b",
        messages=[
            {
                "role": "user",
                "content": instruction
            }
        ]
    )


    result = response["message"]["content"].strip()


    if result.startswith("```"):
        result = result.replace("```json", "").replace("```", "").strip()


    return json.loads(result)