from fastapi.testclient import TestClient
from app.main import app
import pytest

client = TestClient(app)

def test_health_check():
    """Prueba el endpoint de health check"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_version():
    """Prueba el endpoint de versión"""
    response = client.get("/version")
    assert response.status_code == 200
    assert "version" in response.json()

def test_solve_endpoint(small_schedule_request):
    """Prueba el endpoint de solución de horarios"""
    response = client.post("/solve", json=small_schedule_request.dict())
    assert response.status_code == 200
    
    data = response.json()
    assert "status" in data
    assert "assignments" in data
    assert "metrics" in data
    assert "explanation" in data

def test_repair_endpoint(medium_schedule_request):
    """Prueba el endpoint de reparación"""
    response = client.post("/repair", json=medium_schedule_request.dict())
    assert response.status_code == 200
    
    data = response.json()
    assert "status" in data
    assert data["status"] == "METAHEURISTIC"

def test_interpret_endpoint():
    """Prueba el endpoint de interpretación de lenguaje natural"""
    test_cases = [
        {
            "text": "baja los huecos de Matemáticas",
            "context": {"courseId": "MAT-1A"}
        },
        {
            "text": "evita extremos para Ana",
            "context": {"teacherId": "T1"}
        },
        {
            "text": "fija 3M-Auto en Laboratorio 1",
            "context": {
                "courseId": "3M-Auto",
                "roomId": "LAB1"
            }
        }
    ]
    
    for case in test_cases:
        response = client.post("/interpret", json=case)
        assert response.status_code == 200
        data = response.json()
        assert "explanation" in data
        
        # Al menos uno de weightsDelta o newLocks debe estar presente
        assert "weightsDelta" in data or "newLocks" in data
