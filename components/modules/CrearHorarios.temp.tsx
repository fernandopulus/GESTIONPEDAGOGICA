import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  CircularProgress,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { CURSOS, ASIGNATURAS } from '../../constants';
import { Profile, User } from '../../types';
import { subscribeToProfesores } from '../../src/firebaseHelpers/reemplazosHelper';

interface Course {
  id: string;
  name: string;
  subject: string;
  hoursPerWeek: number;
  teacher: string;
  roomType: string;
}

interface Teacher {
  id: string;
  name: string;
  availability: {
    day: string;
    blocks: number[];
  }[];
}

function CrearHorarios(): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedSchedule, setGeneratedSchedule] = useState<any>(null);
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [registeredProfessors, setRegisteredProfessors] = useState<User[]>([]);
  const [newCourse, setNewCourse] = useState<Partial<Course>>({});
  const [newTeacher, setNewTeacher] = useState<Partial<Teacher>>({});

  // Efecto para cargar los profesores registrados
  useEffect(() => {
    const unsubscribe = subscribeToProfesores((professors) => {
      // Filtramos solo los profesores con perfil PROFESORADO
      const teachersOnly = professors.filter(p => p.profile === Profile.PROFESORADO);
      setRegisteredProfessors(teachersOnly);
    });

    return () => unsubscribe();
  }, []);

  const handleAddCourse = () => {
    if (newCourse.name && newCourse.subject && newCourse.hoursPerWeek && newCourse.teacher) {
      setCourses([...courses, { ...newCourse, id: `course-${Date.now()}` } as Course]);
      setNewCourse({});
    }
  };

  const handleAddTeacher = () => {
    if (newTeacher.name) {
      setTeachers([...teachers, { ...newTeacher, id: `teacher-${Date.now()}`, availability: [] } as Teacher]);
      setNewTeacher({});
    }
  };

  const handleDeleteCourse = (id: string) => {
    setCourses(courses.filter(course => course.id !== id));
  };

  const handleDeleteTeacher = (id: string) => {
    setTeachers(teachers.filter(teacher => teacher.id !== id));
  };

  const generateSchedule = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const requestData = {
        courses: courses.map(course => ({
          id: course.id,
          name: course.name,
          subject: course.subject,
          blocksPerWeek: course.hoursPerWeek,
          teacherId: course.teacher,
          roomType: course.roomType
        })),
        teachers: teachers.map(teacher => ({
          id: teacher.id,
          name: teacher.name,
          availability: teacher.availability
        })),
        periods: Array.from({ length: 40 }, (_, i) => {
          const day = Math.floor(i / 8);
          const block = (i % 8) + 1;
          const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
          return `${days[day]}-${block}`;
        }),
        rooms: Array.from({ length: 20 }, (_, i) => ({
          id: `sala${i + 1}`,
          type: `sala${i + 1}`
        })),
        weights: {
          holes: 10,
          late: 5,
          early: 5,
          imbalance: 3,
          specialRoom: 2
        }
      };

      const response = await fetch('http://localhost:8000/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Error al generar el horario');
      }

      const schedule = await response.json();
      setGeneratedSchedule(schedule);
      
    } catch (error: any) {
      console.error('Error:', error);
      setError('Error al generar el horario: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Generador de Horarios
      </Typography>
      
      {/* Configuración de Cursos */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Configuración de Cursos
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Curso</InputLabel>
              <Select
                value={newCourse.name || ''}
                label="Curso"
                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
              >
                {CURSOS.map(curso => (
                  <MenuItem key={curso} value={curso}>{curso}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Asignatura</InputLabel>
              <Select
                value={newCourse.subject || ''}
                label="Asignatura"
                onChange={(e) => setNewCourse({ ...newCourse, subject: e.target.value })}
              >
                {ASIGNATURAS.map(asignatura => (
                  <MenuItem key={asignatura} value={asignatura}>{asignatura}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <TextField
              fullWidth
              type="number"
              label="Horas Semanales"
              value={newCourse.hoursPerWeek || ''}
              onChange={(e) => setNewCourse({ ...newCourse, hoursPerWeek: parseInt(e.target.value) })}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Profesor</InputLabel>
              <Select
                value={newCourse.teacher || ''}
                label="Profesor"
                onChange={(e) => setNewCourse({ ...newCourse, teacher: e.target.value })}
              >
                {registeredProfessors.map(profesor => (
                  <MenuItem key={profesor.id} value={profesor.nombreCompleto}>
                    {profesor.nombreCompleto}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth>
              <InputLabel>Número de Sala</InputLabel>
              <Select
                value={newCourse.roomType || ''}
                label="Número de Sala"
                onChange={(e) => setNewCourse({ ...newCourse, roomType: e.target.value })}
              >
                {Array.from({length: 20}, (_, i) => i + 1).map(num => (
                  <MenuItem key={num} value={`sala${num}`}>Sala {num}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={1}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleAddCourse}
              disabled={!newCourse.name || !newCourse.subject || !newCourse.hoursPerWeek || !newCourse.teacher || !newCourse.roomType}
            >
              Agregar
            </Button>
          </Grid>
        </Grid>

        {/* Lista de Cursos */}
        <Box sx={{ mt: 2 }}>
          {courses.map((course) => (
            <Chip
              key={course.id}
              label={`${course.name} - ${course.subject} (${course.hoursPerWeek}h) - ${course.teacher} - Sala ${course.roomType.replace('sala', '')}`}
              onDelete={() => handleDeleteCourse(course.id)}
              sx={{ m: 0.5 }}
            />
          ))}
        </Box>
      </Paper>

      {/* Botón de Generación */}
      <Button 
        variant="contained" 
        onClick={generateSchedule}
        disabled={isLoading || courses.length === 0}
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
}

export default CrearHorarios;
