"""
Script to check and report users with null company_id
Run this to diagnose company_id issues.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_session_maker
from models.orm import User, Company

async def check_users():
    session_maker = get_session_maker()
    async with session_maker() as db:
        # Get all users
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        print("\n=== User Company ID Report ===\n")
        
        for user in users:
            company_name = "N/A (No Company)"
            if user.company_id:
                company_result = await db.execute(
                    select(Company).where(Company.company_id == user.company_id)
                )
                company = company_result.scalar_one_or_none()
                company_name = company.name if company else "INVALID COMPANY ID"
            
            status = "✓" if user.company_id or user.role == "SUPER_ADMIN" else "✗"
            
            print(f"{status} User: {user.name} ({user.login_id})")
            print(f"   Role: {user.role}")
            print(f"   Company ID: {user.company_id}")
            print(f"   Company: {company_name}")
            print(f"   Active: {user.is_active}")
            print()
        
        # Check for problematic users
        problematic = [u for u in users if not u.company_id and u.role != "SUPER_ADMIN"]
        
        if problematic:
            print("\n⚠️  ISSUE FOUND: The following users have no company_id but are not SUPER_ADMIN:")
            for user in problematic:
                print(f"   - {user.name} ({user.login_id}) - Role: {user.role}")
            print("\nThese users should have a company_id assigned.")
            print("To fix, you can either:")
            print("1. Delete these users and recreate them properly")
            print("2. Use the admin panel to assign them to a company")
        else:
            print("✓ All users have proper company_id configuration!")

if __name__ == "__main__":
    asyncio.run(check_users())
