from app.nlp.interpreter import NaturalLanguageInterpreter, NLPRequest
import pytest

def test_holes_interpretation():
    """Prueba la interpretación de indicaciones sobre huecos"""
    interpreter = NaturalLanguageInterpreter()
    
    test_cases = [
        (
            "baja los huecos de Matemáticas",
            {"weightsDelta": {"holes": 5}}
        ),
        (
            "reduce huecos para Ana",
            {"weightsDelta": {"holes": 5}}
        ),
        (
            "aumenta los huecos de Física",
            {"weightsDelta": {"holes": -5}}
        )
    ]
    
    for text, expected in test_cases:
        response = interpreter.interpret(NLPRequest(text=text))
        if expected.get("weightsDelta"):
            assert response.weightsDelta is not None
            for key, value in expected["weightsDelta"].items():
                assert response.weightsDelta[key] == value

def test_extremes_interpretation():
    """Prueba la interpretación de indicaciones sobre horarios extremos"""
    interpreter = NaturalLanguageInterpreter()
    
    test_cases = [
        (
            "evita extremos para Ana",
            {
                "weightsDelta": {
                    "late": 3,
                    "early": 3
                }
            }
        ),
        (
            "prohíbe viernes 7 para Lenguaje",
            {
                "newLocks": [{
                    "kind": "ban",
                    "courseId": "LENGUAJE",
                    "period": "VIERNES-7"
                }]
            }
        )
    ]
    
    for text, expected in test_cases:
        response = interpreter.interpret(NLPRequest(text=text))
        if expected.get("weightsDelta"):
            assert response.weightsDelta is not None
            for key, value in expected["weightsDelta"].items():
                assert response.weightsDelta[key] == value
        if expected.get("newLocks"):
            assert response.newLocks is not None
            assert len(response.newLocks) == len(expected["newLocks"])

def test_room_lock_interpretation():
    """Prueba la interpretación de indicaciones sobre salas"""
    interpreter = NaturalLanguageInterpreter()
    
    test_cases = [
        (
            "fija 3M-Auto en Laboratorio 1",
            {"explanation": "Configurando 3M-Auto para usar Laboratorio 1"}
        ),
        (
            "asigna Matemáticas a sala 201",
            {"explanation": "Configurando Matemáticas para usar 201"}
        )
    ]
    
    for text, expected in test_cases:
        response = interpreter.interpret(NLPRequest(text=text))
        assert expected["explanation"] in response.explanation

def test_multiple_instructions():
    """Prueba la interpretación de múltiples indicaciones en un solo texto"""
    interpreter = NaturalLanguageInterpreter()
    
    text = """
    baja los huecos de Matemáticas,
    evita extremos para Ana,
    fija Física en Laboratorio 2
    """
    
    response = interpreter.interpret(NLPRequest(text=text))
    
    assert response.weightsDelta is not None
    assert "holes" in response.weightsDelta
    assert response.explanation.count(".") >= 2  # Al menos 2 indicaciones interpretadas
