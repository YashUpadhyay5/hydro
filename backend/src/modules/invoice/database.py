from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm import declarative_base

from config import Config


engine = create_engine(
    Config.DATABASE_URL,
    pool_pre_ping=True,       # Check connection liveness before every use
    pool_recycle=300,         # Recycle connections every 5 min (not 1 hour)
    pool_size=5,              # Keep 5 connections in pool
    max_overflow=10,          # Allow 10 extra connections under load
    pool_timeout=30,          # Wait max 30s for a connection from pool
    echo=False
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        try:
            db.close()
        except Exception:
            pass