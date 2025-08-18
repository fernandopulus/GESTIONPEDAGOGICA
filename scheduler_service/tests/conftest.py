from app.domain.models import (
    ScheduleRequest,
    Room,
    Teacher,
    Course,
    Availability,
    HardLock,
    FixedAssignment,
    Weights,
    SolverOptions,
    RoomType,
    LockType
)
import pytest

@pytest.fixture
def small_schedule_request():
    """Fixture con un caso pequeño de prueba"""
    return ScheduleRequest(
        periods=[
            "Lun-1", "Lun-2", "Lun-3",
            "Mar-1", "Mar-2", "Mar-3"
        ],
        rooms=[
            Room(id="A1", type=RoomType.NORMAL),
            Room(id="LAB1", type=RoomType.LAB)
        ],
        teachers=[
            Teacher(id="T1", name="Ana"),
            Teacher(id="T2", name="Luis")
        ],
        courses=[
            Course(
                id="MAT-1A",
                teacherId="T1",
                blocksPerWeek=3,
                roomType=RoomType.NORMAL
            ),
            Course(
                id="FIS-1A",
                teacherId="T2",
                blocksPerWeek=2,
                roomType=RoomType.LAB
            )
        ],
        availability=[
            Availability(teacherId="T1", period="Lun-1", allowed=False)
        ],
        hardLocks=[
            HardLock(
                kind=LockType.BAN,
                courseId="MAT-1A",
                period="Mar-3"
            )
        ],
        fixedAssignments=[],
        weights=Weights(
            holes=10,
            late=3,
            early=3,
            imbalance=1,
            specialRoom=2
        ),
        options=SolverOptions(
            maxTimeSec=5,
            seed=42,
            fallbackIfNoFeasible=True
        )
    )

@pytest.fixture
def medium_schedule_request():
    """Fixture con un caso mediano de prueba"""
    periods = []
    for day in ["Lun", "Mar", "Mie", "Jue", "Vie"]:
        for block in range(1, 8):
            periods.append(f"{day}-{block}")
    
    return ScheduleRequest(
        periods=periods,
        rooms=[
            Room(id="A1", type=RoomType.NORMAL),
            Room(id="A2", type=RoomType.NORMAL),
            Room(id="LAB1", type=RoomType.LAB),
            Room(id="LAB2", type=RoomType.LAB)
        ],
        teachers=[
            Teacher(id="T1", name="Ana"),
            Teacher(id="T2", name="Luis"),
            Teacher(id="T3", name="María"),
            Teacher(id="T4", name="Juan")
        ],
        courses=[
            Course(
                id="MAT-1A",
                teacherId="T1",
                blocksPerWeek=6,
                roomType=RoomType.NORMAL
            ),
            Course(
                id="FIS-1A",
                teacherId="T2",
                blocksPerWeek=4,
                roomType=RoomType.LAB
            ),
            Course(
                id="QUI-1A",
                teacherId="T3",
                blocksPerWeek=4,
                roomType=RoomType.LAB
            ),
            Course(
                id="LEN-1A",
                teacherId="T4",
                blocksPerWeek=4,
                roomType=RoomType.NORMAL
            )
        ],
        availability=[
            # T1 no disponible lunes primera hora
            Availability(teacherId="T1", period="Lun-1", allowed=False),
            # T2 no disponible viernes última hora
            Availability(teacherId="T2", period="Vie-7", allowed=False)
        ],
        hardLocks=[],
        fixedAssignments=[],
        weights=Weights(
            holes=10,
            late=3,
            early=3,
            imbalance=1,
            specialRoom=2
        ),
        options=SolverOptions(
            maxTimeSec=30,
            seed=42,
            fallbackIfNoFeasible=True
        )
    )
