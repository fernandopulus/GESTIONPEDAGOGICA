import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, CircularProgress } from '@mui/material';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '../../src/firebase';

const CrearHorarios: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSchedule, setGeneratedSchedule] = useState<any>(null);

  const generateSchedule = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `Genera un horario semanal para un curso técnico profesional. 
                     El horario debe incluir:
                     - 5 días (Lunes a Viernes)
                     - 8 bloques por día
                     - Asignaturas técnicas y generales
                     Retorna SOLO un objeto JSON con la siguiente estructura:
                     {
                       "horario": {
                         "lunes": {"bloque1": "asignatura", ...},
                         "martes": {"bloque1": "asignatura", ...},
                         ...
                       }
                     }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      try {
        const cleanJSON = text.replace(/```json\n?|\n?```/g, '').trim();
        const schedule = JSON.parse(cleanJSON);
        setGeneratedSchedule(schedule);
      } catch (jsonError) {
        console.error('Error parsing JSON:', jsonError);
        setError('Error al procesar el horario generado');
      }
    } catch (apiError) {
      console.error('Error calling Gemini API:', apiError);
      setError('Error al generar el horario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Generador de Horarios
      </Typography>
      
      <Button 
        variant="contained" 
        onClick={generateSchedule}
        disabled={isLoading}
        sx={{ mb: 3 }}
      >
        {isLoading ? 'Generando...' : 'Generar Horario'}
      </Button>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ my: 2 }}>
          {error}
        </Typography>
      )}

      {generatedSchedule && (
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Horario Generado:
          </Typography>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(generatedSchedule, null, 2)}
          </pre>
        </Paper>
      )}
    </Box>
  );
};

export default CrearHorarios;
