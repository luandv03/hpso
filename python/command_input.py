from pydantic import BaseModel, Field
from typing import Optional, List, Any


class Resource(BaseModel):
    machine_id: str
    hprs: int
    costPerHour: float
    minExp: int
    role: str


class Operation(BaseModel):
    id: int
    resources: list[Resource]
    prevOperation: Optional[Any] = None


class Task(BaseModel):
    machine_id: str
    worker_id: str
    start_date: str
    start_hours: int
    end_date: str
    end_hours: int


class WorkOrder(BaseModel):
    tasks: list[Task]


class CommandInput(BaseModel):
    command_id: str
    id: Optional[int] = None
    quantity: int
    status: str
    start_date: str
    end_date: str
    operations: Optional[List[Operation]] = Field(default_factory=list)
    workOrders: Optional[List[WorkOrder]] = Field(default_factory=list)
