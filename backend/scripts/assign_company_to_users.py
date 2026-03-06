"""
Script to assign company_id to users who are missing it
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from db.database import get_session_maker
from models.orm import User, Company
from uuid import UUID

async def fix_users():
    session_maker = get_session_maker()
    async with session_maker() as db:
        # Get all companies
        result = await db.execute(select(Company))
        companies = result.scalars().all()
        
        if not companies:
            print("❌ No companies found! Create a company first.")
            return
        
        print("\n=== Available Companies ===\n")
        for idx, company in enumerate(companies, 1):
            print(f"{idx}. {company.name} (ID: {company.company_id})")
        
        # Get users without company_id (excluding SUPER_ADMIN)
        result = await db.execute(
            select(User).where(User.company_id.is_(None), User.role != "SUPER_ADMIN")
        )
        problematic_users = result.scalars().all()
        
        if not problematic_users:
            print("\n✓ No users need fixing!")
            return
        
        print("\n=== Users Without Company ===\n")
        for user in problematic_users:
            print(f"- {user.name} ({user.login_id}) - Role: {user.role}")
        
        print("\n" + "="*50)
        print("Enter the company number to assign ALL these users to:")
        print("(or 0 to cancel)")
        print("="*50)
        
        try:
            choice = int(input("\nYour choice: "))
            if choice == 0:
                print("Cancelled.")
                return
            
            if choice < 1 or choice > len(companies):
                print("Invalid choice!")
                return
            
            selected_company = companies[choice - 1]
            
            # Confirm
            print(f"\n⚠️  About to assign {len(problematic_users)} users to: {selected_company.name}")
            confirm = input("Type 'yes' to confirm: ")
            
            if confirm.lower() != 'yes':
                print("Cancelled.")
                return
            
            # Update users
            for user in problematic_users:
                user.company_id = selected_company.company_id
                print(f"  ✓ Assigned {user.name} to {selected_company.name}")
            
            await db.commit()
            
            print(f"\n✅ Successfully assigned {len(problematic_users)} users to {selected_company.name}!")
            print("\nUsers can now log in again and create shifts properly.")
            
        except ValueError:
            print("Invalid input!")
        except KeyboardInterrupt:
            print("\n\nCancelled.")

if __name__ == "__main__":
    asyncio.run(fix_users())
