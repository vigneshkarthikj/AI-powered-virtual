import os
import json
import shutil
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

import models
import schemas
import auth
import ai
import rag
from scheduler_ga import GeneticScheduler
from database import engine, Base, get_db

# Initialize DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-Powered Virtual Academic Assistant API")

# Configure CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all. In production, restrict.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Upload directory setup
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ----------------- AUTHENTICATION ENDPOINTS -----------------

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = auth.get_password_hash(user_data.password)
    new_user = models.User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hashed_password,
        branch=user_data.branch,
        year=user_data.year
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    # Authenticate credentials
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user or not auth.verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate access token
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/forgot-password")
def forgot_password(forgot_data: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == forgot_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email not found"
        )
    
    if forgot_data.nic_code.strip() != "2620":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid NIC Code. Authorized hardware manufacturing units only (NIC 2620)."
        )
    
    clean_ans = forgot_data.security_answer.strip().lower()
    if "computer" not in clean_ans or "peripheral" not in clean_ans:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect industrial vertical verification answer."
        )
    
    user.hashed_password = auth.get_password_hash(forgot_data.new_password)
    db.commit()
    return {"message": "Password reset successfully! Please sign in with your new credentials."}

@app.get("/api/user/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

# ----------------- DASHBOARD STATISTICS -----------------

@app.get("/api/user/stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    # Get total chat responses
    total_chats = db.query(models.ChatHistory).filter(models.ChatHistory.user_id == current_user.id).count()
    
    # Get total files uploaded
    total_uploads = db.query(models.UploadedFile).filter(models.UploadedFile.user_id == current_user.id).count()
    
    # Get total quizzes taken
    total_quizzes = db.query(models.QuizRecord).filter(models.QuizRecord.user_id == current_user.id).count()
    
    # Calculate average score
    avg_score = 0.0
    if total_quizzes > 0:
        # Avoid dividing by zero and compute percentage average
        quiz_stats = db.query(
            func.sum(models.QuizRecord.score).label("total_score"),
            func.sum(models.QuizRecord.total_questions).label("total_q")
        ).filter(models.QuizRecord.user_id == current_user.id).first()
        
        if quiz_stats and quiz_stats.total_q:
            avg_score = (quiz_stats.total_score / quiz_stats.total_q) * 100.0

    # Fetch recent quizzes
    recent_quizzes = db.query(models.QuizRecord).filter(
        models.QuizRecord.user_id == current_user.id
    ).order_by(models.QuizRecord.taken_at.desc()).limit(5).all()

    # Fetch recent uploads
    recent_files = db.query(models.UploadedFile).filter(
        models.UploadedFile.user_id == current_user.id
    ).order_by(models.UploadedFile.upload_date.desc()).limit(5).all()

    return {
        "total_chats": total_chats,
        "total_uploads": total_uploads,
        "total_quizzes_taken": total_quizzes,
        "average_quiz_score": round(avg_score, 1),
        "recent_quizzes": recent_quizzes,
        "recent_files": recent_files
    }

# ----------------- CHATBOT ENDPOINTS -----------------

@app.post("/api/chat/ask", response_model=schemas.ChatResponse)
def ask_assistant(payload: schemas.ChatAsk, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    session_id = payload.session_id or f"session_{int(datetime.utcnow().timestamp())}"
    
    # Fetch chat session history to pass to Gemini
    past_chats = db.query(models.ChatHistory).filter(
        models.ChatHistory.user_id == current_user.id,
        models.ChatHistory.session_id == session_id
    ).order_by(models.ChatHistory.timestamp.asc()).all()
    
    # Format chat history for Gemini API:
    # Google AI SDK expects history format:
    # [{'role': 'user', 'parts': [text]}, {'role': 'model', 'parts': [text]}]
    gemini_history = []
    for chat in past_chats:
        gemini_history.append({"role": "user", "parts": [chat.question]})
        gemini_history.append({"role": "model", "parts": [chat.answer]})
    
    # User customization system injection
    system_instruction = (
        f"You are an AI-Powered Virtual Academic Assistant. You are currently assisting {current_user.name}, "
        f"a B.Tech CSE student (Branch: {current_user.branch or 'CSE'}, Year: {current_user.year or '2nd'}). "
        f"Keep explanations highly academic, clear, and tailored to computer science and engineering coursework. "
        f"Write source code segments where appropriate using Markdown code syntax blocks, and explain the steps."
    )
    
    # Call Gemini
    response_text = ai.ask_gemini_chatbot(gemini_history, payload.question, system_instruction)
    
    # Log to DB
    new_chat = models.ChatHistory(
        user_id=current_user.id,
        session_id=session_id,
        question=payload.question,
        answer=response_text
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    
    return new_chat

@app.get("/api/chat/history", response_model=List[schemas.ChatResponse])
def get_chat_history(session_id: Optional[str] = None, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    query = db.query(models.ChatHistory).filter(models.ChatHistory.user_id == current_user.id)
    if session_id:
        query = query.filter(models.ChatHistory.session_id == session_id)
    return query.order_by(models.ChatHistory.timestamp.desc()).all()

@app.get("/api/chat/sessions")
def get_chat_sessions(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    # Group chat records by session_id and select the first question as the session title
    sessions = db.query(
        models.ChatHistory.session_id,
        func.max(models.ChatHistory.timestamp).label("last_active"),
        func.min(models.ChatHistory.question).label("title")
    ).filter(
        models.ChatHistory.user_id == current_user.id
    ).group_by(
        models.ChatHistory.session_id
    ).order_by(
        func.max(models.ChatHistory.timestamp).desc()
    ).all()
    
    return [
        {"session_id": s[0], "last_active": s[1], "title": s[2][:40] + "..." if len(s[2]) > 40 else s[2]}
        for s in sessions
    ]

# ----------------- PDF RAG ENDPOINTS -----------------

@app.post("/api/files/upload", response_model=schemas.FileResponse)
def upload_file(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents are supported"
        )
        
    # 1. Save File to DB (to get file ID)
    new_file = models.UploadedFile(
        user_id=current_user.id,
        file_name=file.filename,
        file_path="",  # Save real path shortly
        file_size=0    # Save size shortly
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    
    # 2. Write file to local folder
    file_extension = os.path.splitext(file.filename)[1]
    local_filename = f"{new_file.id}_{int(datetime.utcnow().timestamp())}{file_extension}"
    local_path = os.path.join(UPLOAD_DIR, local_filename)
    
    try:
        with open(local_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        file_size = os.path.getsize(local_path)
        
        # Update path and size in database
        new_file.file_path = local_path
        new_file.file_size = file_size
        db.commit()
        db.refresh(new_file)
    except Exception as e:
        db.delete(new_file)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(e)}"
        )
        
    # 3. Process RAG indexing in the background/foreground
    # In a production app, we should use a background task. For instant testing, we run it synchronously.
    success = rag.index_pdf_file(new_file.id, local_path)
    if not success:
        # File failed vector indexing, let's keep the database row but notify user
        print(f"RAG warning: File ID {new_file.id} index failed.")
        
    return new_file

@app.get("/api/files", response_model=List[schemas.FileResponse])
def get_uploaded_files(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.UploadedFile).filter(models.UploadedFile.user_id == current_user.id).order_by(models.UploadedFile.upload_date.desc()).all()

@app.delete("/api/files/{file_id}")
def delete_file(file_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_file = db.query(models.UploadedFile).filter(
        models.UploadedFile.id == file_id,
        models.UploadedFile.user_id == current_user.id
    ).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Remove files
    try:
        if os.path.exists(db_file.file_path):
            os.remove(db_file.file_path)
        index_path = os.path.join(rag.INDEX_DIR, f"{file_id}.json")
        if os.path.exists(index_path):
            os.remove(index_path)
    except Exception as e:
        print(f"Error deleting local assets: {e}")
        
    db.delete(db_file)
    db.commit()
    return {"message": "File deleted successfully"}

@app.post("/api/files/ask")
def ask_pdf(payload: schemas.RagAsk, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    # Verify file ownership
    db_file = db.query(models.UploadedFile).filter(
        models.UploadedFile.id == payload.file_id,
        models.UploadedFile.user_id == current_user.id
    ).first()
    
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file not found"
        )
        
    answer = rag.query_pdf_rag(db_file.id, db_file.file_name, payload.question)
    return {"answer": answer}

# ----------------- QUIZ GENERATION ENDPOINTS -----------------

@app.post("/api/quiz/generate", response_model=List[schemas.QuizQuestion])
def get_quiz_questions(payload: schemas.QuizGenerateRequest, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    context_text = None
    
    # If a file ID is supplied, extract text from the PDF as context for custom quizzes
    if payload.file_id:
        db_file = db.query(models.UploadedFile).filter(
            models.UploadedFile.id == payload.file_id,
            models.UploadedFile.user_id == current_user.id
        ).first()
        if db_file:
            context_text = rag.extract_pdf_text(db_file.file_path)
            
    questions = ai.generate_quiz(payload.topic, payload.num_questions, context_text)
    
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate quiz. Check API configurations."
        )
        
    return questions

@app.post("/api/quiz/record", response_model=schemas.QuizRecordResponse)
def record_quiz_score(payload: schemas.QuizRecordCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    record = models.QuizRecord(
        user_id=current_user.id,
        topic=payload.topic,
        score=payload.score,
        total_questions=payload.total_questions
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/api/quiz/history", response_model=List[schemas.QuizRecordResponse])
def get_quiz_history(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return db.query(models.QuizRecord).filter(models.QuizRecord.user_id == current_user.id).order_by(models.QuizRecord.taken_at.desc()).all()

# ----------------- SUMMARIZATION & RECOMMENDATIONS -----------------

@app.post("/api/summarize")
def summarize_pdf(payload: schemas.SummarizeRequest, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_file = db.query(models.UploadedFile).filter(
        models.UploadedFile.id == payload.file_id,
        models.UploadedFile.user_id == current_user.id
    ).first()
    
    if not db_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
        
    text = rag.extract_pdf_text(db_file.file_path)
    if not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract readable text from this PDF file"
        )
        
    summary = ai.summarize_notes(text, payload.detail_level)
    return {"summary": summary}

@app.get("/api/recommendations")
def get_topic_recommendations(topic: str, current_user: models.User = Depends(auth.get_current_user)):
    if not topic.strip():
        raise HTTPException(status_code=400, detail="Topic string cannot be empty")
    recommendations = ai.recommend_resources(topic)
    return {"topic": topic, "recommendations": recommendations}

# ----------------- STUDY PLANNER ENDPOINTS -----------------

@app.post("/api/planner")
def build_study_plan(payload: schemas.PlannerRequest, current_user: models.User = Depends(auth.get_current_user)):
    plan = ai.generate_study_plan(
        exam_name=payload.exam_name,
        days_left=payload.days_left,
        subjects=payload.subjects,
        hours_per_day=payload.hours_per_day
    )
    return {"study_plan": plan}

@app.get("/api/planner/subjects")
def get_planner_subjects(current_user: models.User = Depends(auth.get_current_user)):
    subjects_file = os.path.join(os.path.dirname(__file__), "data", "hardware_subjects.json")
    try:
        with open(subjects_file, "r") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load subjects dataset: {str(e)}")

@app.post("/api/planner/optimize")
def optimize_study_plan(payload: schemas.PlannerRequest, current_user: models.User = Depends(auth.get_current_user)):
    subjects_file = os.path.join(os.path.dirname(__file__), "data", "hardware_subjects.json")
    try:
        with open(subjects_file, "r") as f:
            all_subjects = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load subjects dataset: {str(e)}")
        
    selected_subjects = [s for s in all_subjects if s["name"] in payload.subjects]
    
    scheduler = GeneticScheduler(
        selected_subjects=selected_subjects,
        days_left=payload.days_left,
        hours_per_day=payload.hours_per_day
    )
    result = scheduler.run()
    return result
