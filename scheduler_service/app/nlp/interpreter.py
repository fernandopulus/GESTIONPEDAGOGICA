from typing import Dict, List, Optional, Union
import re
from pydantic import BaseModel
from ..domain.models import HardLock, LockType, Weights

class NLPRequest(BaseModel):
    text: str
    context: Optional[Dict] = None

class NLPResponse(BaseModel):
    weightsDelta: Optional[Dict[str, float]] = None
    newLocks: Optional[List[HardLock]] = None
    explanation: str

class NaturalLanguageInterpreter:
    def __init__(self):
        self._init_patterns()
    
    def _init_patterns(self):
        """Inicializar patrones de reconocimiento"""
        self.patterns = {
            'holes': [
                r'(?:baja|reduce|minimiza|menos)\s+(?:los\s+)?huecos\s+(?:de\s+)?([^,\.]+)',
                r'(?:sube|aumenta|más)\s+(?:los\s+)?huecos\s+(?:de\s+)?([^,\.]+)'
            ],
            'extremes': [
                r'(?:evita|no)\s+(?:los\s+)?extremos\s+(?:para\s+)?([^,\.]+)',
                r'(?:prohíbe|no)\s+(?:el\s+)?(?:bloque\s+)?([^,\.]+)\s+(?:para\s+)?([^,\.]+)'
            ],
            'room_lock': [
                r'(?:fija|asigna)\s+([^,\.]+)\s+(?:en|a)\s+(?:la\s+)?(?:sala|aula|laboratorio)\s+([^,\.]+)'
            ]
        }
    
    def interpret(self, request: NLPRequest) -> NLPResponse:
        """Interpretar texto en lenguaje natural y convertirlo en parámetros formales"""
        text = request.text
        context = request.context or {}
        search_text = text.lower()
        
        weightsDelta = {}
        newLocks = []
        explanations = []
        
        # Procesar indicaciones sobre huecos
        for pattern in self.patterns['holes']:
            matches = re.finditer(pattern, search_text)
            for match in matches:
                # Encontrar la parte correspondiente en el texto original
                start, end = match.span(1)
                subject = text[start:end].strip()
                if 'baja' in pattern or 'reduce' in pattern or 'minimiza' in pattern:
                    weightsDelta['holes'] = weightsDelta.get('holes', 0) + 5
                    explanations.append(f"Aumentando peso para minimizar huecos de {subject}")
                else:
                    weightsDelta['holes'] = weightsDelta.get('holes', 0) - 5
                    explanations.append(f"Reduciendo peso para huecos de {subject}")
        
        # Procesar indicaciones sobre horarios extremos
        for pattern in self.patterns['extremes']:
            matches = re.finditer(pattern, text)
            for match in matches:
                if len(match.groups()) == 1:
                    subject = match.group(1).strip()
                    weightsDelta['late'] = weightsDelta.get('late', 0) + 3
                    weightsDelta['early'] = weightsDelta.get('early', 0) + 3
                    explanations.append(f"Aumentando peso para evitar horarios extremos de {subject}")
                else:
                    period, subject = match.group(1).strip(), match.group(2).strip()
                    newLocks.append(HardLock(
                        kind=LockType.BAN,
                        courseId=self._find_course_id(subject, context),
                        period=self._normalize_period(period)
                    ))
                    explanations.append(f"Agregando prohibición para {subject} en periodo {period}")
        
        # Procesar fijación de salas
        for pattern in self.patterns['room_lock']:
            matches = re.finditer(pattern, text)
            for match in matches:
                course, room = match.group(1).strip(), match.group(2).strip()
                matches = re.finditer(pattern, search_text)
            for match in matches:
                # Obtener el texto original usando los índices del match
                start1, end1 = match.span(1)
                start2, end2 = match.span(2)
                course = text[start1:end1].strip()
                room = text[start2:end2].strip()
                
                # Formatear el nombre de la sala
                if "laboratorio" in room.lower():
                    room_number = ''.join(filter(str.isdigit, room))
                    room = f"Laboratorio {room_number}"
                
                room_id = self._find_room_id(room, context)
                if room_id:
                    # Aquí deberíamos generar los locks apropiados
                    explanations.append(f"Configurando {course} para usar {room}")
        
        return NLPResponse(
            weightsDelta=weightsDelta if weightsDelta else None,
            newLocks=newLocks if newLocks else None,
            explanation=". ".join(explanations) if explanations else "No se identificaron indicaciones específicas"
        )
    
    def _find_course_id(self, name: str, context: Dict) -> str:
        """Encontrar ID de curso basado en nombre o descripción"""
        # En una implementación real, usaríamos el contexto para mapear
        # nombres a IDs de forma más robusta
        return name.upper().replace(" ", "-")
    
    def _find_room_id(self, name: str, context: Dict) -> Optional[str]:
        """Encontrar ID de sala basado en nombre o descripción"""
        # En una implementación real, usaríamos el contexto para mapear
        # nombres a IDs de forma más robusta
        return f"SALA-{name.upper()}"
    
    def _normalize_period(self, period: str) -> str:
        """Normalizar descripción de periodo a formato estándar"""
        # En una implementación real, tendríamos una lógica más robusta
        # para manejar diferentes formatos de entrada
        return period.upper()

class LLMInterpreter:
    """
    Clase para integración futura con modelos de lenguaje más avanzados
    como GPT-4 o similares
    """
    def __init__(self, model_name: str = "gpt-4"):
        self.model_name = model_name
        
    async def interpret(self, request: NLPRequest) -> NLPResponse:
        """
        Versión asíncrona que usaría un LLM para interpretación más sofisticada
        """
        # TODO: Implementar integración con LLM
        raise NotImplementedError(
            "La interpretación con LLM será implementada en una versión futura"
        )
