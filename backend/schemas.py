from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

# User schemas
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    branch: Optional[str] = None
    year: Optional[int] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str
    nic_code: str
    manufacturing_unit: str
    security_answer: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    branch: Optional[str] = None
    year: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Chat schemas
class ChatAsk(BaseModel):
    question: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    id: int
    session_id: str
    question: str
    answer: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Uploaded File schemas
class FileResponse(BaseModel):
    id: int
    file_name: str
    file_size: int
    upload_date: datetime

    class Config:
        from_attributes = True

# RAG Chat schema
class RagAsk(BaseModel):
    file_id: int
    question: str

# Quiz schemas
class QuizQuestion(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str # matches one of the option strings
    explanation: str

class QuizGenerateRequest(BaseModel):
    topic: str
    num_questions: int = Field(default=5, ge=1, le=10)
    file_id: Optional[int] = None # Generate quiz from a uploaded PDF directly if provided!

class QuizRecordCreate(BaseModel):
    topic: str
    score: int
    total_questions: int

class QuizRecordResponse(BaseModel):
    id: int
    topic: str
    score: int
    total_questions: int
    taken_at: datetime

    class Config:
        from_attributes = True

# Notes Summarization schemas
class SummarizeRequest(BaseModel):
    file_id: int
    detail_level: str = "medium" # short, medium, detailed

# Study Planner schemas
class PlannerRequest(BaseModel):
    exam_name: str
    days_left: int = Field(..., ge=1)
    subjects: List[str]
    hours_per_day: float = Field(..., ge=0.5, le=24.0)

# Dashboard statistics schema
class DashboardStats(BaseModel):
    total_chats: int
    total_uploads: int
    total_quizzes_taken: int
    average_quiz_score: float
    recent_quizzes: List[QuizRecordResponse]
    recent_files: List[FileResponse]
