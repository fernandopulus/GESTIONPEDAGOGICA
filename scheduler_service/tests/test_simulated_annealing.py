from app.solver_meta.simulated_annealing import SimulatedAnnealing
from app.domain.models import SolutionStatus, Assignment
import pytest

def test_simulated_annealing_small_case(small_schedule_request):
    """Prueba el solver metaheurístico con un caso pequeño"""
    solver = SimulatedAnnealing(small_schedule_request)
    response = solver.solve()
    
    assert response.status == SolutionStatus.METAHEURISTIC
    assert len(response.assignments) > 0
    
    # Verificar que no hay violaciones duras
    assert response.metrics.hardViolations == 0

def test_simulated_annealing_repair(medium_schedule_request):
    """Prueba la funcionalidad de reparación"""
    # Crear una solución inicial con algunas asignaciones fijas
    initial_solution = [
        Assignment(
            courseId="MAT-1A",
            period="Mar-2",
            roomId="A1"
        ),
        Assignment(
            courseId="FIS-1A",
            period="Mar-3",
            roomId="LAB1"
        )
    ]
    
    solver = SimulatedAnnealing(medium_schedule_request)
    response = solver.solve(initial_solution=initial_solution)
    
    assert response.status == SolutionStatus.METAHEURISTIC
    
    # Verificar que las asignaciones iniciales se mantienen
    assert any(
        a.courseId == "MAT-1A" and a.period == "Mar-2" and a.roomId == "A1"
        for a in response.assignments
    )
    assert any(
        a.courseId == "FIS-1A" and a.period == "Mar-3" and a.roomId == "LAB1"
        for a in response.assignments
    )
    
    # Verificar que se completó el resto del horario
    course_blocks = {}
    for assignment in response.assignments:
        course_blocks[assignment.courseId] = course_blocks.get(assignment.courseId, 0) + 1
    
    for course in medium_schedule_request.courses:
        assert course_blocks.get(course.id, 0) == course.blocksPerWeek
