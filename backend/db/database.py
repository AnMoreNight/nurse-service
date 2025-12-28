from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, Text, ARRAY
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
        _engine = create_async_engine(get_database_url(), echo=False)
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

async def init_db():
    # For SQLAlchemy, we don't need to create tables here as we use Alembic
    pass

async def close_db():
    global _engine
    if _engine:
        await _engine.dispose()
        _engine = None

