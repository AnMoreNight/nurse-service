from asyncpg import create_pool, Pool
import os

pool: Pool = None

async def init_db():
    global pool
    pool = await create_pool(
        dsn=os.getenv("DATABASE_URL"),
        min_size=5,
        max_size=20
    )

async def close_db():
    global pool
    if pool:
        await pool.close()

def get_pool() -> Pool:
    return pool
