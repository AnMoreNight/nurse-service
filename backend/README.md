# Nurse Service Backend

FastAPI backend for Nurse Service scheduling system.

## Setup

1. Install dependencies:
```bash
uv sync
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Run migrations:
```bash
alembic upgrade head
```

4. Start server:
```bash
**uvicorn** main:app --reload --host 0.0.0.0 --port 8000
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── controller/          # Business logic
├── db/                  # Database connection & schema
├── middleware/          # Auth middleware
├── models/              # Pydantic models
├── routes/              # API endpoints
├── utils/               # Utilities (JWT, password)
└── main.py             # FastAPI app
```

## Key Features

- JWT authentication with role-based access control
- Multi-tenant architecture with company isolation
- Schedule management with recurring rules
- Shift management with auto-reflection
- CSV export for schedules and shifts
- Drag & drop support via API
- Patient search functionality
