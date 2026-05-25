FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
RUN groupadd --system scfca && useradd --system --gid scfca --home-dir /app --shell /usr/sbin/nologin scfca

COPY --chown=scfca:scfca backend ./backend
COPY --chown=scfca:scfca scripts ./scripts

USER scfca

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
