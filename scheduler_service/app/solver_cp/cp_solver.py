from ortools.sat.python import cp_model
from ..domain.models import (
    ScheduleRequest, 
    ScheduleResponse, 
    Assignment, 
    Metrics, 
    SolutionStatus
)
import numpy as np
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class ScheduleSolver:
    def __init__(self, request: ScheduleRequest):
        self.request = request
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = request.options.maxTimeSec
        self.solver.parameters.random_seed = request.options.seed
        
        # Índices para acceso rápido
        self.period_indices = {p: i for i, p in enumerate(request.periods)}
        self.room_indices = {r.id: i for i, r in enumerate(request.rooms)}
        self.course_indices = {c.id: i for i, c in enumerate(request.courses)}
        
        # Variables binarias x[c,p,r] = 1 si el curso c se dicta en periodo p y sala r
        self.x = {}
        for c in request.courses:
            for p in request.periods:
                for r in request.rooms:
                    if r.type == c.roomType:  # Solo crear variables para salas compatibles
                        self.x[c.id, p, r.id] = self.model.NewBoolVar(f'x_{c.id}_{p}_{r.id}')
    
    def add_coverage_constraints(self):
        """Cada curso debe cumplir con sus blocksPerWeek"""
        for c in self.request.courses:
            self.model.Add(
                sum(self.x[c.id, p, r.id] 
                    for p in self.request.periods 
                    for r in self.request.rooms 
                    if r.type == c.roomType) == c.blocksPerWeek
            )
    
    def add_no_overlap_constraints(self):
        """Un docente no puede dictar más de un curso por periodo y 
        una sala no puede alojar más de un curso por periodo"""
        
        # No topes de docente
        for p in self.request.periods:
            for t in self.request.teachers:
                courses_by_teacher = [c for c in self.request.courses if c.teacherId == t.id]
                self.model.Add(
                    sum(self.x[c.id, p, r.id]
                        for c in courses_by_teacher
                        for r in self.request.rooms
                        if r.type == c.roomType) <= 1
                )
        
        # No topes de sala
        for p in self.request.periods:
            for r in self.request.rooms:
                self.model.Add(
                    sum(self.x[c.id, p, r.id]
                        for c in self.request.courses
                        if r.type == c.roomType) <= 1
                )

    def add_availability_constraints(self):
        """Respetar las disponibilidades de los docentes"""
        for a in self.request.availability:
            if not a.allowed:
                courses = [c for c in self.request.courses if c.teacherId == a.teacherId]
                for c in courses:
                    for r in self.request.rooms:
                        if r.type == c.roomType and (c.id, a.period, r.id) in self.x:
                            self.model.Add(self.x[c.id, a.period, r.id] == 0)

    def add_hard_locks(self):
        """Aplicar prohibiciones y obligaciones puntuales"""
        for lock in self.request.hardLocks:
            if lock.kind == "ban":
                for r in self.request.rooms:
                    if (lock.courseId, lock.period, r.id) in self.x:
                        self.model.Add(self.x[lock.courseId, lock.period, r.id] == 0)
            elif lock.kind == "must-place":
                self.model.Add(
                    sum(self.x[lock.courseId, lock.period, r.id]
                        for r in self.request.rooms
                        if (lock.courseId, lock.period, r.id) in self.x) == 1
                )

    def add_fixed_assignments(self):
        """Respetar asignaciones fijas"""
        for fix in self.request.fixedAssignments:
            if (fix.courseId, fix.period, fix.roomId) in self.x:
                self.model.Add(self.x[fix.courseId, fix.period, fix.roomId] == 1)

    def add_objective(self):
        """Añadir función objetivo con penalizaciones"""
        holes_cost = self._calculate_holes_cost()
        late_early_cost = self._calculate_late_early_cost()
        imbalance_cost = self._calculate_imbalance_cost()
        special_room_cost = self._calculate_special_room_cost()

        total_cost = (
            self.request.weights.holes * holes_cost +
            self.request.weights.late * late_early_cost +
            self.request.weights.imbalance * imbalance_cost +
            self.request.weights.specialRoom * special_room_cost
        )

        self.model.Minimize(total_cost)

    def _calculate_holes_cost(self):
        """Calcular costo por huecos en los horarios de los docentes"""
        holes_vars = []
        for t in self.request.teachers:
            courses = [c for c in self.request.courses if c.teacherId == t.id]
            for day in set(p.split('-')[0] for p in self.request.periods):
                day_periods = [p for p in self.request.periods if p.startswith(day)]
                for i in range(len(day_periods)-2):
                    # Si hay clase en p1 y p3 pero no en p2, es un hueco
                    p1, p2, p3 = day_periods[i:i+3]
                    has_p1 = sum(self.x[c.id, p1, r.id]
                                for c in courses
                                for r in self.request.rooms
                                if (c.id, p1, r.id) in self.x)
                    has_p2 = sum(self.x[c.id, p2, r.id]
                                for c in courses
                                for r in self.request.rooms
                                if (c.id, p2, r.id) in self.x)
                    has_p3 = sum(self.x[c.id, p3, r.id]
                                for c in courses
                                for r in self.request.rooms
                                if (c.id, p3, r.id) in self.x)
                    
                    hole = self.model.NewBoolVar(f'hole_{t.id}_{day}_{i}')
                    self.model.Add(has_p1 + has_p3 - 2*has_p2 >= 1).OnlyEnforceIf(hole)
                    holes_vars.append(hole)
        
        return sum(holes_vars)

    def _calculate_late_early_cost(self):
        """Calcular costo por clases en primera y última hora"""
        late_early_vars = []
        for t in self.request.teachers:
            courses = [c for c in self.request.courses if c.teacherId == t.id]
            for day in set(p.split('-')[0] for p in self.request.periods):
                day_periods = [p for p in self.request.periods if p.startswith(day)]
                first_period = day_periods[0]
                last_period = day_periods[-1]
                
                # Primera hora
                early = sum(self.x[c.id, first_period, r.id]
                          for c in courses
                          for r in self.request.rooms
                          if (c.id, first_period, r.id) in self.x)
                late_early_vars.append(early)
                
                # Última hora
                late = sum(self.x[c.id, last_period, r.id]
                         for c in courses
                         for r in self.request.rooms
                         if (c.id, last_period, r.id) in self.x)
                late_early_vars.append(late)
        
        return sum(late_early_vars)

    def _calculate_imbalance_cost(self):
        """Calcular costo por desbalance en la carga diaria"""
        imbalance_vars = []
        for t in self.request.teachers:
            courses = [c for c in self.request.courses if c.teacherId == t.id]
            
            # Calcular diferencias entre pares de días
            days = list(set(p.split('-')[0] for p in self.request.periods))
            for i in range(len(days)):
                for j in range(i + 1, len(days)):
                    day1_periods = [p for p in self.request.periods if p.startswith(days[i])]
                    day2_periods = [p for p in self.request.periods if p.startswith(days[j])]
                    
                    load1 = sum(self.x[c.id, p, r.id]
                              for p in day1_periods
                              for c in courses
                              for r in self.request.rooms
                              if (c.id, p, r.id) in self.x)
                    
                    load2 = sum(self.x[c.id, p, r.id]
                              for p in day2_periods
                              for c in courses
                              for r in self.request.rooms
                              if (c.id, p, r.id) in self.x)
                    
                    # Usar diferencia absoluta como medida de desbalance
                    diff = self.model.NewIntVar(0, len(self.request.periods), f'diff_{t.id}_{i}_{j}')
                    self.model.AddAbsEquality(diff, load1 - load2)
                    imbalance_vars.append(diff)
        
        return sum(imbalance_vars)

    def _calculate_special_room_cost(self):
        """Calcular costo por uso innecesario de salas especiales"""
        special_room_vars = []
        special_rooms = [r for r in self.request.rooms if r.type != "normal"]
        for r in special_rooms:
            for p in self.request.periods:
                for c in self.request.courses:
                    if (c.id, p, r.id) in self.x and c.roomType == "normal":
                        special_room_vars.append(self.x[c.id, p, r.id])
        
        return sum(special_room_vars)

    def solve(self) -> ScheduleResponse:
        """Resolver el problema y devolver la solución"""
        try:
            # Añadir todas las restricciones
            self.add_coverage_constraints()
            self.add_no_overlap_constraints()
            self.add_availability_constraints()
            self.add_hard_locks()
            self.add_fixed_assignments()
            self.add_objective()

            # Resolver
            status = self.solver.Solve(self.model)

            if status == cp_model.OPTIMAL:
                solution_status = SolutionStatus.OPTIMAL
            elif status == cp_model.FEASIBLE:
                solution_status = SolutionStatus.FEASIBLE
            elif status == cp_model.INFEASIBLE:
                solution_status = SolutionStatus.INFEASIBLE
            else:
                solution_status = SolutionStatus.TIMEOUT

            if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
                assignments = self._extract_solution()
                metrics = self._calculate_metrics()
                explanation = self._generate_explanation(metrics)
                
                return ScheduleResponse(
                    status=solution_status,
                    assignments=assignments,
                    metrics=metrics,
                    explanation=explanation
                )
            else:
                if self.request.options.fallbackIfNoFeasible:
                    # TODO: Implementar fallback metaheurístico
                    pass
                return ScheduleResponse(
                    status=solution_status,
                    assignments=[],
                    metrics=Metrics(
                        objective=float('inf'),
                        holes=0,
                        late=0,
                        early=0,
                        imbalance=0,
                        hardViolations=0
                    ),
                    explanation="No se encontró solución factible"
                )

        except Exception as e:
            logger.error(f"Error solving schedule: {str(e)}")
            raise

    def _extract_solution(self) -> List[Assignment]:
        """Extraer la solución del solver"""
        assignments = []
        for (c_id, p, r_id), var in self.x.items():
            if self.solver.Value(var) == 1:
                assignments.append(Assignment(
                    courseId=c_id,
                    period=p,
                    roomId=r_id
                ))
        return assignments

    def _calculate_metrics(self) -> Metrics:
        """Calcular métricas de la solución"""
        objective_value = self.solver.ObjectiveValue()
        
        # Calcular métricas individuales
        holes = sum(1 for (c_id, p, r_id), var in self.x.items() 
                   if self.solver.Value(var) == 1)  # TODO: implementar conteo real
        
        late_early = sum(1 for (c_id, p, r_id), var in self.x.items()
                        if self.solver.Value(var) == 1 and 
                        (p.endswith('-1') or p.endswith('-7')))
        
        imbalance = 0.0  # TODO: implementar cálculo real
        
        return Metrics(
            objective=objective_value,
            holes=holes,
            late=late_early // 2,  # Dividir entre early y late
            early=late_early // 2,
            imbalance=imbalance,
            hardViolations=0  # Si llegamos aquí, no hay violaciones duras
        )

    def _generate_explanation(self, metrics: Metrics) -> str:
        """Generar explicación en lenguaje natural de la solución"""
        explanation = []
        
        if metrics.holes > 0:
            explanation.append(f"Se generaron {metrics.holes} huecos en total.")
        
        if metrics.late > 0 or metrics.early > 0:
            explanation.append(
                f"Hay {metrics.early} bloques a primera hora y {metrics.late} a última hora."
            )
        
        if metrics.imbalance > 0:
            explanation.append("Existe cierto desbalance en la carga diaria.")
            
        if not explanation:
            explanation.append("Se encontró una solución óptima sin penalizaciones significativas.")
            
        return " ".join(explanation)
