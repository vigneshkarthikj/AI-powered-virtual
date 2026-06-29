import os
import json
import numpy as np
import pypdf
import google.generativeai as genai
from ai import get_gemini_client

EMBEDDING_MODEL = "models/text-embedding-004"

# Set up paths
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
INDEX_DIR = os.path.join(UPLOAD_DIR, "indices")

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(INDEX_DIR, exist_ok=True)

def extract_pdf_text(file_path: str) -> str:
    """
    Extracts plain text from a PDF document.
    """
    text = ""
    try:
        reader = pypdf.PdfReader(file_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
    return text

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list:
    """
    Splits text into overlapping chunks.
    """
    if not text:
        return []
    
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

def generate_embeddings_batch(texts: list) -> list:
    """
    Generates embeddings for a list of texts using Gemini's embedding API.
    """
    if not get_gemini_client():
        return []

    # Gemini API can handle batch embedding generation
    try:
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=texts,
            task_type="retrieval_document"
        )
        return result["embedding"]
    except Exception as e:
        print(f"Error generating embeddings: {e}")
        # Fallback to single requests if batch fails
        embeddings = []
        for text in texts:
            try:
                res = genai.embed_content(
                    model=EMBEDDING_MODEL,
                    content=text,
                    task_type="retrieval_document"
                )
                embeddings.append(res["embedding"])
            except Exception as ex:
                print(f"Single embedding error: {ex}")
                # Append zero vector as fallback
                embeddings.append([0.0] * 768)
        return embeddings

def index_pdf_file(file_id: int, file_path: str) -> bool:
    """
    Processes a PDF file, generates chunks and embeddings, and saves the vector index.
    """
    try:
        # 1. Extract text
        text = extract_pdf_text(file_path)
        if not text.strip():
            print("No text extracted from PDF.")
            return False

        # 2. Chunk text
        chunks = chunk_text(text)
        if not chunks:
            return False

        # 3. Generate embeddings
        # Generate in batches to avoid API timeouts
        batch_size = 20
        embeddings = []
        for i in range(0, len(chunks), batch_size):
            batch_chunks = chunks[i:i + batch_size]
            batch_embeds = generate_embeddings_batch(batch_chunks)
            embeddings.extend(batch_embeds)

        # 4. Save index file (mapping chunks to vector lists)
        index_data = []
        for idx, (chunk, embed) in enumerate(zip(chunks, embeddings)):
            index_data.append({
                "id": idx,
                "text": chunk,
                "embedding": embed
            })

        index_path = os.path.join(INDEX_DIR, f"{file_id}.json")
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(index_data, f, ensure_ascii=False, indent=2)

        return True
    except Exception as e:
        print(f"Failed indexing file {file_id}: {e}")
        return False

def search_index(file_id: int, query: str, top_k: int = 4) -> list:
    """
    Queries the index file using Cosine Similarity via NumPy.
    Returns the top K matching text chunks.
    """
    index_path = os.path.join(INDEX_DIR, f"{file_id}.json")
    if not os.path.exists(index_path):
        print(f"Index for file {file_id} not found.")
        return []

    # 1. Load local index
    with open(index_path, "r", encoding="utf-8") as f:
        index_data = json.load(f)

    if not index_data:
        return []

    # 2. Embed query
    if not get_gemini_client():
        return []

    try:
        res = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=query,
            task_type="retrieval_query"
        )
        query_embedding = np.array(res["embedding"])
    except Exception as e:
        print(f"Error embedding query: {e}")
        return []

    # 3. Calculate Cosine Similarities
    similarities = []
    for chunk in index_data:
        chunk_embedding = np.array(chunk["embedding"])
        
        # Calculate cosine similarity using NumPy
        dot_product = np.dot(query_embedding, chunk_embedding)
        norm_query = np.linalg.norm(query_embedding)
        norm_chunk = np.linalg.norm(chunk_embedding)
        
        score = dot_product / (norm_query * norm_chunk + 1e-9)
        similarities.append((score, chunk["text"]))

    # 4. Sort and pick top K
    similarities.sort(key=lambda x: x[0], reverse=True)
    top_results = [text for score, text in similarities[:top_k]]
    
    return top_results

def query_pdf_rag(file_id: int, file_name: str, question: str) -> str:
    """
    RAG Pipeline: Search context -> Formulate prompt -> Ask Gemini -> Return Answer
    """
    # 1. Search index for top matching text chunks
    context_chunks = search_index(file_id, question, top_k=4)
    if not context_chunks:
        return "Sorry, I could not find any relevant context in the uploaded PDF."

    # 2. Construct context prompt
    context_text = "\n\n".join([f"--- Source Context Chunk {i+1} ---\n{chunk}" for i, chunk in enumerate(context_chunks)])
    
    system_prompt = (
        f"You are an AI-Powered Academic Assistant. You are answering questions based ONLY on the "
        f"provided textbook or notes material from the PDF: '{file_name}'.\n"
        f"Answer the user's question accurately using this context. If the answer is not in the context, "
        f"do your best to answer based on general Computer Science principles, but add a note that the "
        f"information was not directly found in the uploaded document."
    )

    prompt = f"""
    Here is the retrieved context from the PDF '{file_name}':
    
    {context_text}
    
    ---
    User's Question: {question}
    
    Please formulate a detailed response based on the context above.
    """

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_prompt
        )
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Error generating answer from PDF: {str(e)}"
