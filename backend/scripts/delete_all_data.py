"""
Delete all data from the database (keeps schema intact)
WARNING: This will delete ALL data from ALL tables!
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from dotenv import load_dotenv
import os

load_dotenv()

async def delete_all_data():
    database_url = os.getenv("DATABASE_URL", "").replace("postgres://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")
    
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        return
    
    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            # Delete in correct order to respect foreign keys
            tables_order = [
                'schedule_assignments',
                'schedules',
                'shifts',
                'weekly_off_rules',
                'password_reset_tokens',
                'user_invitations',
                'audit_logs',
                'recurring_rules',
                'schedule_statuses',
                'patients',
                'company_settings',
                'users',
                'companies'
            ]
            
            print(f"🗑️  Deleting data from {len(tables_order)} tables...")
            
            for table in tables_order:
                await session.execute(text(f"DELETE FROM {table};"))
                print(f"  ✓ Cleared: {table}")
            
            await session.commit()
            print("\n✅ All data deleted successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"\n❌ Error: {e}")
        finally:
            await engine.dispose()

if __name__ == "__main__":
    confirm = input("⚠️  WARNING: This will delete ALL data! Type 'DELETE' to confirm: ")
    if confirm == "DELETE":
        asyncio.run(delete_all_data())
    else:
        print("❌ Aborted")
