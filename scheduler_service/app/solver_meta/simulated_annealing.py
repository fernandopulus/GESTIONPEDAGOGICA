from typing import List, Dict, Tuple
import numpy as np
from ..domain.models import (
    ScheduleRequest, 
    ScheduleResponse,
    Assignment,
    Metrics,
    SolutionStatus
)
import random
import logging

logger = logging.getLogger(__name__)

class SimulatedAnnealing:
    def __init__(self, request: ScheduleRequest):
        self.request = request
        self.best_solution = None
        self.best_cost = float('inf')
        
    def solve(self, initial_solution: List[Assignment] = None) -> ScheduleResponse:
        """
        Implementar recocido simulado para encontrar una solución factible
        cuando CP-SAT no encuentra solución o como método de reparación rápida
        """
        if initial_solution is None:
            solution = self._generate_initial_solution()
        else:
            # Si tenemos una solución inicial, completarla respetando las asignaciones dadas
            self.fixed_assignments = {
                (a.courseId, a.period, a.roomId) for a in initial_solution
            }
            solution = self._complete_initial_solution(initial_solution)
            
        current_solution = solution
        current_cost = self._evaluate_solution(current_solution)
        
        self.best_solution = current_solution.copy()
        self.best_cost = current_cost
        
        # Parámetros del recocido simulado
        T = 1.0  # Temperatura inicial
        T_min = 0.00001  # Temperatura mínima
        alpha = 0.9  # Factor de enfriamiento
        max_iterations = 1000
        
        iteration = 0
        while T > T_min and iteration < max_iterations:
            # Generar vecino
            neighbor = self._get_neighbor(current_solution)
            neighbor_cost = self._evaluate_solution(neighbor)
            
            # No aceptar soluciones con violaciones duras
            if math.isinf(neighbor_cost):
                continue
                
            # Calcular delta    
            delta = neighbor_cost - current_cost
            
            # Criterio de aceptación
            if delta < 0 or random.random() < np.exp(-delta / T):
                current_solution = neighbor
                current_cost = neighbor_cost
                
                # Actualizar mejor solución
                if current_cost < self.best_cost:
                    self.best_solution = current_solution.copy()
                    self.best_cost = current_cost
            
            # Enfriar
            T *= alpha
            iteration += 1
        
        metrics = self._calculate_metrics(self.best_solution)
        explanation = self._generate_explanation(metrics, iteration)
        
        return ScheduleResponse(
            status=SolutionStatus.METAHEURISTIC,
            assignments=self.best_solution,
            metrics=metrics,
            explanation=explanation
        )
    
    def _generate_initial_solution(self) -> List[Assignment]:
        """Generar una solución inicial factible intentando respetar restricciones"""
        solution = []
        max_attempts = 1000
        attempts = 0
        
        # Ordenar cursos por número de bloques (más restrictivos primero)
        sorted_courses = sorted(
            self.request.courses, 
            key=lambda c: c.blocksPerWeek, 
            reverse=True
        )
        
        while attempts < max_attempts:
            solution = []
            success = True
            
            for course in sorted_courses:
                compatible_rooms = [r for r in self.request.rooms 
                                  if r.type == course.roomType]
                
                # Obtener periodos disponibles según disponibilidad del docente
                available_periods = [
                    p for p in self.request.periods
                    if not any(a for a in self.request.availability
                             if a.teacherId == course.teacherId 
                             and a.period == p 
                             and not a.allowed)
                ]
                
                blocks_assigned = 0
                course_attempts = 0
                max_course_attempts = len(self.request.periods)
                
                while blocks_assigned < course.blocksPerWeek:
                    if not available_periods or course_attempts >= max_course_attempts:
                        success = False
                        break
                    
                    period = random.choice(available_periods)
                    room = random.choice(compatible_rooms)
                    
                    if self._is_assignment_valid(course.id, period, room.id, solution):
                        solution.append(Assignment(
                            courseId=course.id,
                            period=period,
                            roomId=room.id
                        ))
                        blocks_assigned += 1
                        available_periods.remove(period)
                    else:
                        course_attempts += 1
                
                if not success:
                    break
            
            if success:
                return solution
            
            attempts += 1
        
        logger.warning("No se pudo generar una solución inicial sin violaciones")
        return solution
    
    def _complete_initial_solution(self, initial_solution: List[Assignment]) -> List[Assignment]:
        """Completar una solución inicial respetando las asignaciones fijas"""
        solution = initial_solution.copy()
        
        # Calcular bloques ya asignados por curso
        assigned_blocks = {}
        for assignment in solution:
            assigned_blocks[assignment.courseId] = assigned_blocks.get(assignment.courseId, 0) + 1
        
        # Completar bloques faltantes
        for course in self.request.courses:
            blocks_needed = course.blocksPerWeek - assigned_blocks.get(course.id, 0)
            if blocks_needed <= 0:
                continue
                
            compatible_rooms = [r for r in self.request.rooms if r.type == course.roomType]
            available_periods = set(self.request.periods)
            
            # Excluir periodos ya usados por este docente
            used_periods = {
                a.period for a in solution 
                if next(c for c in self.request.courses 
                       if c.id == a.courseId).teacherId == course.teacherId
            }
            available_periods -= used_periods
            
            # Intentar asignar los bloques faltantes
            attempts = 0
            max_attempts = len(self.request.periods) * 2
            while blocks_needed > 0 and attempts < max_attempts and available_periods:
                period = random.choice(list(available_periods))
                room = random.choice(compatible_rooms)
                
                if self._is_assignment_valid(course.id, period, room.id, solution):
                    solution.append(Assignment(
                        courseId=course.id,
                        period=period,
                        roomId=room.id
                    ))
                    blocks_needed -= 1
                    available_periods.remove(period)
                
                attempts += 1
        
        return solution
        
    def _get_neighbor(self, solution: List[Assignment]) -> List[Assignment]:
        """
        Generar un vecino aplicando uno de varios movimientos posibles:
        1. Intercambiar dos periodos
        2. Mover un bloque a otro periodo
        3. Cambiar de sala
        """
        neighbor = solution.copy()
        move_type = random.choice(['swap', 'move', 'change_room'])
        
        # Filtrar asignaciones que no son fijas
        modifiable_indices = [
            i for i, a in enumerate(neighbor)
            if not hasattr(self, 'fixed_assignments') or
               (a.courseId, a.period, a.roomId) not in self.fixed_assignments
        ]
        
        if not modifiable_indices:
            return neighbor
            
        if move_type == 'swap':
            if len(modifiable_indices) >= 2:
                i, j = random.sample(modifiable_indices, 2)
                neighbor[i].period, neighbor[j].period = neighbor[j].period, neighbor[i].period
                
        elif move_type == 'move':
            i = random.choice(modifiable_indices)
            old_period = neighbor[i].period
            available_periods = [p for p in self.request.periods if p != old_period]
            if available_periods:
                neighbor[i].period = random.choice(available_periods)
                
        else:  # change_room
            i = random.choice(modifiable_indices)
            course = next(c for c in self.request.courses 
                        if c.id == neighbor[i].courseId)
            compatible_rooms = [r for r in self.request.rooms 
                              if r.type == course.roomType]
            if compatible_rooms:
                neighbor[i].roomId = random.choice(compatible_rooms).id
        
        return neighbor
    
    def _evaluate_solution(self, solution: List[Assignment]) -> float:
        """
        Evaluar la calidad de una solución considerando:
        1. Violaciones duras (topes, disponibilidad)
        2. Penalizaciones blandas (huecos, extremos, etc.)
        """
        cost = 0
        
        # Penalización muy alta para violaciones duras
        hard_penalty = float('inf')
        
        # Verificar topes
        overlaps = self._count_overlaps(solution)
        if overlaps > 0:
            return hard_penalty
        
        # Verificar disponibilidad
        availability_violations = self._count_availability_violations(solution)
        if availability_violations > 0:
            return hard_penalty
        
        # Calcular penalizaciones blandas
        holes = self._count_holes(solution)
        cost += holes * self.request.weights.holes
        
        late_early = self._count_late_early(solution)
        cost += late_early * (self.request.weights.late + self.request.weights.early)
        
        imbalance = self._calculate_imbalance(solution)
        cost += imbalance * self.request.weights.imbalance
        
        special_room = self._count_special_room_usage(solution)
        cost += special_room * self.request.weights.specialRoom
        
        return cost
    
    def _is_assignment_valid(self, course_id: str, period: str, 
                           room_id: str, solution: List[Assignment]) -> bool:
        """Verificar si una asignación es válida"""
        # Verificar disponibilidad del docente
        course = next(c for c in self.request.courses if c.id == course_id)
        teacher_id = course.teacherId
        
        if any(a for a in self.request.availability 
               if a.teacherId == teacher_id and a.period == period 
               and not a.allowed):
            return False
        
        # Verificar topes de docente
        if any(s for s in solution 
               if s.period == period 
               and next(c for c in self.request.courses if c.id == s.courseId).teacherId == teacher_id):
            return False
        
        # Verificar topes de sala
        if any(s for s in solution 
               if s.period == period and s.roomId == room_id):
            return False
        
        return True
    
    def _count_overlaps(self, solution: List[Assignment]) -> int:
        """Contar número de topes (docente y sala)"""
        overlaps = 0
        for i, a1 in enumerate(solution):
            for a2 in solution[i+1:]:
                if a1.period == a2.period:
                    # Verificar tope de docente
                    course1 = next(c for c in self.request.courses if c.id == a1.courseId)
                    course2 = next(c for c in self.request.courses if c.id == a2.courseId)
                    if course1.teacherId == course2.teacherId:
                        overlaps += 1
                    
                    # Verificar tope de sala
                    if a1.roomId == a2.roomId:
                        overlaps += 1
        return overlaps
    
    def _count_availability_violations(self, solution: List[Assignment]) -> int:
        """Contar violaciones de disponibilidad"""
        violations = 0
        for assignment in solution:
            course = next(c for c in self.request.courses if c.id == assignment.courseId)
            teacher_id = course.teacherId
            
            if any(a for a in self.request.availability 
                   if a.teacherId == teacher_id 
                   and a.period == assignment.period 
                   and not a.allowed):
                violations += 1
        return violations
    
    def _count_holes(self, solution: List[Assignment]) -> int:
        """Contar huecos en los horarios de los docentes"""
        holes = 0
        for teacher in self.request.teachers:
            # Obtener bloques por día
            teacher_assignments = [a for a in solution 
                                 if next(c for c in self.request.courses 
                                       if c.id == a.courseId).teacherId == teacher.id]
            
            for day in set(p.split('-')[0] for p in self.request.periods):
                day_blocks = sorted(
                    int(a.period.split('-')[1]) 
                    for a in teacher_assignments 
                    if a.period.startswith(day)
                )
                
                if len(day_blocks) >= 2:
                    # Contar huecos entre el primer y último bloque
                    for i in range(len(day_blocks) - 1):
                        holes += day_blocks[i+1] - day_blocks[i] - 1
        
        return holes
    
    def _count_late_early(self, solution: List[Assignment]) -> int:
        """Contar bloques en primera y última hora"""
        count = 0
        for assignment in solution:
            block = int(assignment.period.split('-')[1])
            if block == 1 or block == len(set(
                int(p.split('-')[1]) for p in self.request.periods 
                if p.split('-')[0] == assignment.period.split('-')[0]
            )):
                count += 1
        return count
    
    def _calculate_imbalance(self, solution: List[Assignment]) -> float:
        """Calcular desbalance en la carga diaria"""
        teacher_loads = {}
        for teacher in self.request.teachers:
            loads = []
            for day in set(p.split('-')[0] for p in self.request.periods):
                load = len([a for a in solution 
                           if a.period.startswith(day) 
                           and next(c for c in self.request.courses 
                                  if c.id == a.courseId).teacherId == teacher.id])
                loads.append(load)
            if loads:
                teacher_loads[teacher.id] = np.var(loads)
        
        return sum(teacher_loads.values())
    
    def _count_special_room_usage(self, solution: List[Assignment]) -> int:
        """Contar uso innecesario de salas especiales"""
        count = 0
        for assignment in solution:
            room = next(r for r in self.request.rooms if r.id == assignment.roomId)
            course = next(c for c in self.request.courses if c.id == assignment.courseId)
            
            if room.type != "normal" and course.roomType == "normal":
                count += 1
        return count
    
    def _calculate_metrics(self, solution: List[Assignment]) -> Metrics:
        """Calcular métricas de la solución"""
        holes = self._count_holes(solution)
        late_early = self._count_late_early(solution)
        imbalance = self._calculate_imbalance(solution)
        special_room = self._count_special_room_usage(solution)
        
        hard_violations = (
            self._count_overlaps(solution) + 
            self._count_availability_violations(solution)
        )
        
        objective = (
            self.request.weights.holes * holes +
            (self.request.weights.late + self.request.weights.early) * late_early +
            self.request.weights.imbalance * imbalance +
            self.request.weights.specialRoom * special_room
        )
        
        if hard_violations > 0:
            objective += hard_violations * 1000000
        
        return Metrics(
            objective=objective,
            holes=holes,
            late=late_early // 2,
            early=late_early // 2,
            imbalance=imbalance,
            hardViolations=hard_violations
        )
    
    def _generate_explanation(self, metrics: Metrics, iterations: int) -> str:
        """Generar explicación de la solución"""
        parts = []
        
        if metrics.hardViolations > 0:
            parts.append(
                f"ADVERTENCIA: La solución tiene {metrics.hardViolations} "
                "violaciones de restricciones duras."
            )
        
        parts.append(
            f"Solución encontrada después de {iterations} iteraciones "
            f"con {metrics.holes} huecos, "
            f"{metrics.late + metrics.early} bloques en horarios extremos "
            f"y un índice de desbalance de {metrics.imbalance:.2f}."
        )
        
        return " ".join(parts)
