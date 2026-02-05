from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text, ARRAY, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
from dotenv import load_dotenv
import uuid
import os

# Load environment variables
load_dotenv()

class Base(DeclarativeBase):
    pass

# Lazy initialization
_engine = None
_async_session_maker = None

def get_database_url():
    """Get and convert the database URL for async SQLAlchemy."""
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise ValueError("DATABASE_URL environment variable is not set")
    # Convert postgres:// to postgresql+asyncpg:// for async support
    return url.replace("postgres://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")

def get_engine():
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_database_url(),
            echo=False,
            pool_pre_ping=True,  # Verify connections before using
            pool_size=10,  # Number of connections to maintain
            max_overflow=20,  # Additional connections when needed
            pool_recycle=3600,  # Recycle connections after 1 hour
            pool_timeout=30,  # Timeout for getting connection from pool
        )
    return _engine

def get_session_maker():
    global _async_session_maker
    if _async_session_maker is None:
        _async_session_maker = async_sessionmaker(get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _async_session_maker

async def get_db() -> AsyncSession:
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_db_with_rls(company_id: str = None, user_role: str = None):
    """
    Get a database session with RLS context set.
    This should be used for all tenant-scoped operations.
    """
    session_maker = get_session_maker()
    async with session_maker() as session:
        try:
            # Set RLS context variables using parameterized queries
            if company_id:
                await session.execute(text("SELECT set_config('app.company_id', :company_id, true)"), {"company_id": company_id})
            if user_role:
                await session.execute(text("SELECT set_config('app.user_role', :user_role, true)"), {"user_role": user_role})
            yield session
        finally:
            await session.close()

async def set_rls_context(session: AsyncSession, company_id: str = None, user_role: str = None):
    """
    Set RLS context on an existing session.
    Call this at the start of each request after authentication.
    """
    if company_id:
        await session.execute(text("SELECT set_config('app.company_id', :company_id, true)"), {"company_id": company_id})
    if user_role:
        await session.execute(text("SELECT set_config('app.user_role', :user_role, true)"), {"user_role": user_role})

async def init_db():
    # For SQLAlchemy, we don't need to create tables here as we use Alembic
    pass

async def close_db():
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None
