from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from db.db import init_db, close_db
from routes import auth, company, user, patient, schedule, shift, status

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

app = FastAPI(title="Nurse Service API", version="1.0.0", lifespan=lifespan, docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(company.router)
app.include_router(user.router)
app.include_router(patient.router)
app.include_router(schedule.router)
app.include_router(shift.router)
app.include_router(status.router)

@app.get("/")
async def root():
    return {"message": "Nurse Service API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
