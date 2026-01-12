"""Create test users: SuperAdmin, CompanyAdmin, and NormalUser"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from models.orm import Company, User
from utils.utils import hash_password
from dotenv import load_dotenv
import os

load_dotenv()

async def create_users():
    database_url = os.getenv('DATABASE_URL', '').replace('postgres://', 'postgresql+asyncpg://').replace('postgresql://', 'postgresql+asyncpg://')
    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with async_session() as session:
        # Create company
        company = Company(name="Test Nursing Agency")
        session.add(company)
        await session.flush()
        
        # Create SuperAdmin
        super_admin = User(
            company_id=company.company_id,
            email="superadmin@test.com",
            password_hash=hash_password("Admin@123"),
            role="SUPER_ADMIN",
            name="Super Admin",
            is_active=True
        )
        session.add(super_admin)
        
        # Create CompanyAdmin
        company_admin = User(
            company_id=company.company_id,
            email="admin@test.com",
            password_hash=hash_password("Admin@123"),
            role="COMPANY_ADMIN",
            name="Company Admin",
            is_active=True
        )
        session.add(company_admin)
        
        # Create NormalUser
        normal_user = User(
            company_id=company.company_id,
            email="user@test.com",
            password_hash=hash_password("User@123"),
            role="NORMAL_USER",
            name="Normal User",
            profession="Nurse",
            display_color="blue",
            is_active=True
        )
        session.add(normal_user)
        
        await session.commit()
        await session.refresh(company)
        await session.refresh(super_admin)
        await session.refresh(company_admin)
        await session.refresh(normal_user)
        
        print("✅ Users created successfully!")
        print(f"\nCompany: {company.name}")
        print(f"  ID: {company.company_id}")
        print(f"\n1. SuperAdmin:")
        print(f"   Email: superadmin@test.com")
        print(f"   Password: Admin@123")
        print(f"\n2. CompanyAdmin:")
        print(f"   Email: admin@test.com")
        print(f"   Password: Admin@123")
        print(f"\n3. NormalUser:")
        print(f"   Email: user@test.com")
        print(f"   Password: User@123")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create_users())
