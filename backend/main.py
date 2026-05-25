"""
SCFCA FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.v1.routes import health, auth, cases, tickets, documents, audit, chat

app = FastAPI(title="SCFCA - Secure Custody Framework for Cryptocurrency Assets")

app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

# Include API routes
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(cases.router, prefix="/api/v1/cases", tags=["cases"])
app.include_router(tickets.router, prefix="/api/v1/tickets", tags=["tickets"])
app.include_router(documents.router, prefix="/api/v1/documents", tags=["documents"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
