import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

# Load env variables
load_dotenv()
print("GEMINI_API_KEY:", os.getenv("GEMINI_API_KEY"))
print("Current working directory:", os.getcwd())

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# We use gemini-1.5-flash for speed and lower latency, ideal for interactive academic helper tasks
DEFAULT_MODEL = "gemini-1.5-flash"

def get_gemini_client():
    if not api_key:
        # Check env again in case it was set dynamically after startup
        env_key = os.getenv("GEMINI_API_KEY")
        if env_key:
            genai.configure(api_key=env_key)
            return True
        return False
    return True

def ask_gemini_chatbot(history: list, user_question: str, system_instruction: str = None) -> str:
    """
    history: List of dicts with role and content:
             [{'role': 'user', 'parts': ['...']}, {'role': 'model', 'parts': ['...']}]
    """
    if not get_gemini_client():
        return "⚠️ Gemini API Key not configured. Please add `GEMINI_API_KEY=your_key` to `backend/.env`."

    system_prompt = system_instruction or (
        "You are an AI-Powered Virtual Academic Assistant. You help university students, "
        "particularly B.Tech Computer Science and Engineering students, by explaining complex academic "
        "concepts, code, databases, and mathematics. Answer thoroughly, write clear code samples when relevant "
        "using markdown blocks, and format explanations with bold headers."
    )

    try:
        model = genai.GenerativeModel(
            model_name=DEFAULT_MODEL,
            system_instruction=system_prompt
        )
        
        chat = model.start_chat(history=history)
        response = chat.send_message(user_question)
        return response.text
    except Exception as e:
        return f"Error communicating with Gemini: {str(e)}"

def generate_quiz(topic: str, num_questions: int = 5, context_text: str = None) -> list:
    """
    Generates a list of quiz questions in JSON format.
    """
    if not get_gemini_client():
        return []

    prompt = f"""
    You are an academic examiner. Generate a quiz about: '{topic}'.
    The quiz should contain exactly {num_questions} multiple choice questions.
    
    Format the output as a JSON array of objects. Each object MUST have this exact structure:
    {{
        "question_text": "Write the MCQ question here",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": "Option B", // Must EXACTLY match one of the items in the options array
        "explanation": "Provide a detailed explanation of why this answer is correct."
    }}
    """
    
    if context_text:
        prompt += f"\nGenerate the questions based on the following material:\n{context_text[:12000]}"

    try:
        model = genai.GenerativeModel(DEFAULT_MODEL)
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        questions = json.loads(response.text)
        # Handle wrapping if Gemini returns a dictionary key containing the array
        if isinstance(questions, dict):
            for val in questions.values():
                if isinstance(val, list):
                    questions = val
                    break
        return questions
    except Exception as e:
        print(f"Error generating quiz: {e}")
        return []

def summarize_notes(text: str, detail_level: str = "medium") -> str:
    """
    Summarizes notes or textbooks.
    """
    if not get_gemini_client():
        return "⚠️ Gemini API Key not configured. Please add `GEMINI_API_KEY=your_key` to `backend/.env`."

    detail_prompts = {
        "short": "Provide a high-level summary of the key concepts. Use bullet points and keep it under 300 words.",
        "medium": "Provide a detailed summary. Include key concepts, bulleted points, definitions of important terms, and a list of key take-aways. Keep it under 800 words.",
        "detailed": "Provide an extensive summary. Break down into sections based on the notes content, write definitions, document key equations, and create a text-based ASCII 'Mind Map' outline to visualize the relationships."
    }
    
    prompt = f"""
    You are a university teaching assistant. Summarize the following study material.
    
    Instructions:
    {detail_prompts.get(detail_level, detail_prompts['medium'])}
    
    Format using clean, modern markdown with emojis, bold subheaders, and blockquotes for formulas or crucial definitions.
    
    ---
    Study Material:
    {text[:25000]}
    """

    try:
        model = genai.GenerativeModel(DEFAULT_MODEL)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating summary: {str(e)}"

def generate_study_plan(exam_name: str, days_left: int, subjects: list, hours_per_day: float) -> str:
    """
    Generates a structured calendar study plan.
    """
    if not get_gemini_client():
        return "⚠️ Gemini API Key not configured. Please add `GEMINI_API_KEY=your_key` to `backend/.env`."

    prompt = f"""
    You are an expert academic advisor. Help me build a study planner.
    
    Details:
    - Target Exam: {exam_name}
    - Time Available: {days_left} Days
    - Subjects to cover: {', '.join(subjects)}
    - Daily Study Time: {hours_per_day} hours/day
    
    Create a day-by-day, highly structured study timeline.
    Instructions:
    1. Distribute the subjects evenly based on their size and study hours.
    2. Incorporate 'Revision Days' and 'Practice Test Days' (especially in the final 20% of the timeline).
    3. For each day, specify exactly:
       - Which subject and sub-topic to cover.
       - Recommended activity (e.g. read notes, solve problems, practice active recall).
       - Estimated hours.
    4. Format the output in clean, readable Markdown with a clear progress tracker, daily check-lists, and a summary table at the top.
    """

    try:
        model = genai.GenerativeModel(DEFAULT_MODEL)
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating study plan: {str(e)}"

def recommend_resources(topic: str) -> list:
    """
    Recommends YouTube topics and website article references based on a topic query.
    """
    if not get_gemini_client():
        return []

    prompt = f"""
    Suggest high-quality educational learning resources for the university level topic: '{topic}'.
    
    Return a JSON array of objects. Provide exactly 6 resources (2 YouTube video searches, 2 textbooks/articles, 2 practice sites).
    For each resource, use this exact JSON format:
    {{
        "title": "Title of the resource (e.g., 'MIT 6.006: Introduction to Algorithms')",
        "type": "video" | "article" | "practice",
        "description": "Brief 1-2 sentence description explaining what this resource covers and why it's useful.",
        "search_query": "A search query string to help the user find it (e.g., 'MIT introduction to algorithms lecture 1 youtube')"
    }}
    """

    try:
        model = genai.GenerativeModel(DEFAULT_MODEL)
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error recommending resources: {e}")
        return []
