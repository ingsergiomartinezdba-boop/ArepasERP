
from sqlalchemy import create_engine, text
import os

db_path = os.path.join(os.getcwd(), 'backend', 'arepas.db')
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as conn:
    result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
    print("TABLES:")
    for row in result:
        print(row[0])
