from pydantic import BaseModel
from typing import Optional

class WorkerInput(BaseModel):
    worker_id: str
    id: Optional[int] = None
    name: str
    exp: float
    baseSalary: float
    role: str
