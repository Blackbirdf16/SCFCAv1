"""
SCFCA FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.v1.routes import health, auth, cases, tickets, documents, audit, chat

app = FastAPI(title="SCFCA - Secure Custody Framework for Cryptocurrency Assets")

SECURITY_HEADERS = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "no-referrer",
	"Permissions-Policy": "geolocation=(), microphone=(), camera=()",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Resource-Policy": "same-origin",
}


@app.middleware("http")
async def add_security_headers(request, call_next):
	response = await call_next(request)
	for header_name, header_value in SECURITY_HEADERS.items():
		if header_name not in response.headers:
			response.headers[header_name] = header_value
	return response


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
