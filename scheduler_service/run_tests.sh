#!/bin/bash

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Configurar PYTHONPATH
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Ejecutar pruebas con pytest
pytest tests/ -v --cov=app --cov-report=term-missing
