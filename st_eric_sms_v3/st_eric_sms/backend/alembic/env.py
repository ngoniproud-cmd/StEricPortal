from alembic import context
from sqlalchemy import create_engine
from app.config import settings
from app.models import Base

target = Base.metadata


def run_migrations_online():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target, compare_type=True, render_as_batch=conn.dialect.name == "sqlite")
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
