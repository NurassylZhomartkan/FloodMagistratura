from sqlalchemy import Column, Integer, String, Boolean, DateTime,ForeignKey, func
from database.database import Base


from sqlalchemy import Column, Integer, String
from database.database import Base  # Импортируем базу

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    project_hash = Column(String)
