from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum

class RoomType(str, Enum):
    NORMAL = "normal"
    LAB = "lab"
    SPECIAL = "special"

class Room(BaseModel):
    id: str
    type: RoomType

class Teacher(BaseModel):
    id: str
    name: str

class Course(BaseModel):
    id: str
    teacherId: str
    blocksPerWeek: int
    roomType: RoomType

class Availability(BaseModel):
    teacherId: str
    period: str
    allowed: bool

class LockType(str, Enum):
    BAN = "ban"
    MUST_PLACE = "must-place"

class HardLock(BaseModel):
    kind: LockType
    courseId: str
    period: str

class FixedAssignment(BaseModel):
    courseId: str
    period: str
    roomId: str

class Weights(BaseModel):
    holes: float = Field(ge=0)
    late: float = Field(ge=0)
    early: float = Field(ge=0)
    imbalance: float = Field(ge=0)
    specialRoom: float = Field(ge=0)

class SolverOptions(BaseModel):
    maxTimeSec: int = Field(ge=1, default=30)
    seed: int = Field(default=7)
    fallbackIfNoFeasible: bool = Field(default=True)

class ScheduleRequest(BaseModel):
    periods: List[str]
    rooms: List[Room]
    teachers: List[Teacher]
    courses: List[Course]
    availability: List[Availability]
    hardLocks: List[HardLock] = []
    fixedAssignments: List[FixedAssignment] = []
    weights: Weights
    options: SolverOptions

class Assignment(BaseModel):
    courseId: str
    period: str
    roomId: str

class Metrics(BaseModel):
    objective: float
    holes: int
    late: int
    early: int
    imbalance: float
    hardViolations: int

class SolutionStatus(str, Enum):
    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    METAHEURISTIC = "METAHEURISTIC"
    INFEASIBLE = "INFEASIBLE"
    TIMEOUT = "TIMEOUT"

class ScheduleResponse(BaseModel):
    status: SolutionStatus
    assignments: List[Assignment]
    metrics: Metrics
    explanation: str
