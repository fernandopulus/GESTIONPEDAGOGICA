from fastapi import FastAPI, HTTPException
from .domain.models import (
    ScheduleRequest,
    ScheduleResponse,
    Assignment,
    SolutionStatus
)
from .solver_cp.cp_solver import ScheduleSolver
from .solver_meta.simulated_annealing import SimulatedAnnealing
from .nlp.interpreter import NaturalLanguageInterpreter, NLPRequest, NLPResponse
import logging

app = FastAPI(
    title="School Schedule Optimizer",
    description="Servicio de optimización de horarios escolares con CP-SAT y metaheurísticas",
    version="1.0.0"
)

logger = logging.getLogger(__name__)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/version")
async def version():
    return {"version": "1.0.0"}

@app.post("/solve", response_model=ScheduleResponse)
async def solve_schedule(request: ScheduleRequest):
    try:
        # Intentar primero con CP-SAT
        solver = ScheduleSolver(request)
        response = solver.solve()
        
        # Si CP-SAT no encuentra solución y está habilitado el fallback
        if (response.status in [SolutionStatus.INFEASIBLE, SolutionStatus.TIMEOUT] 
            and request.options.fallbackIfNoFeasible):
            logger.info("CP-SAT no encontró solución, intentando con metaheurística")
            meta_solver = SimulatedAnnealing(request)
            response = meta_solver.solve()
        
        return response
    except Exception as e:
        logger.error(f"Error solving schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/repair", response_model=ScheduleResponse)
async def repair_schedule(request: ScheduleRequest):
    try:
        # Usar directamente el solver metaheurístico para reparaciones
        solver = SimulatedAnnealing(request)
        
        # Extraer asignaciones fijas de request.fixedAssignments
        fixed_assignments = [
            Assignment(
                courseId=fix.courseId,
                period=fix.period,
                roomId=fix.roomId
            ) for fix in request.fixedAssignments
        ]
        
        response = solver.solve(initial_solution=fixed_assignments)
        return response
    except Exception as e:
        logger.error(f"Error repairing schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/interpret", response_model=NLPResponse)
async def interpret_natural_language(request: NLPRequest):
    try:
        interpreter = NaturalLanguageInterpreter()
        response = interpreter.interpret(request)
        return response
    except Exception as e:
        logger.error(f"Error interpreting natural language: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
