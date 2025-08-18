from app.solver_cp.cp_solver import ScheduleSolver
from app.domain.models import SolutionStatus
import pytest

def test_cp_solver_small_case(small_schedule_request):
    """Prueba el solver CP-SAT con un caso pequeño"""
    solver = ScheduleSolver(small_schedule_request)
    response = solver.solve()
    
    assert response.status in [SolutionStatus.OPTIMAL, SolutionStatus.FEASIBLE]
    assert len(response.assignments) == 5  # 3 bloques MAT + 2 bloques FIS
    
    # Verificar restricciones duras
    teacher_periods = {}
    room_periods = {}
    for assignment in response.assignments:
        # Verificar que no hay topes de profesor
        period = assignment.period
        course = next(c for c in small_schedule_request.courses if c.id == assignment.courseId)
        teacher = course.teacherId
        
        if period in teacher_periods:
            assert teacher not in teacher_periods[period], "Tope de profesor detectado"
            teacher_periods[period].append(teacher)
        else:
            teacher_periods[period] = [teacher]
            
        # Verificar que no hay topes de sala
        if period in room_periods:
            assert assignment.roomId not in room_periods[period], "Tope de sala detectado"
            room_periods[period].append(assignment.roomId)
        else:
            room_periods[period] = [assignment.roomId]
            
        # Verificar que se respeta la disponibilidad
        if course.teacherId == "T1":
            assert assignment.period != "Lun-1", "No se respetó la restricción de disponibilidad"
            
        # Verificar que se respetan los hardLocks
        if assignment.courseId == "MAT-1A":
            assert assignment.period != "Mar-3", "No se respetó el hardLock"

def test_cp_solver_medium_case(medium_schedule_request):
    """Prueba el solver CP-SAT con un caso mediano"""
    solver = ScheduleSolver(medium_schedule_request)
    response = solver.solve()
    
    assert response.status in [SolutionStatus.OPTIMAL, SolutionStatus.FEASIBLE]
    
    # Verificar que todos los cursos tienen sus bloques asignados
    course_blocks = {}
    for assignment in response.assignments:
        course_blocks[assignment.courseId] = course_blocks.get(assignment.courseId, 0) + 1
    
    for course in medium_schedule_request.courses:
        assert course_blocks.get(course.id, 0) == course.blocksPerWeek, \
            f"El curso {course.id} no tiene todos sus bloques asignados"
            
    # Verificar restricciones de disponibilidad
    for assignment in response.assignments:
        course = next(c for c in medium_schedule_request.courses if c.id == assignment.courseId)
        if course.teacherId == "T1":
            assert assignment.period != "Lun-1", "No se respetó la disponibilidad de T1"
        if course.teacherId == "T2":
            assert assignment.period != "Vie-7", "No se respetó la disponibilidad de T2"

def test_cp_solver_infeasible_case(small_schedule_request):
    """Prueba el solver CP-SAT con un caso infactible"""
    # Hacer el caso infactible añadiendo más bloques de los que caben
    small_schedule_request.courses[0].blocksPerWeek = 10  # Más bloques que periodos disponibles
    
    solver = ScheduleSolver(small_schedule_request)
    response = solver.solve()
    
    assert response.status == SolutionStatus.INFEASIBLE
