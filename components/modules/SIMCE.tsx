import React, { useState, useEffect } from 'react';
import { useAuth } from '../../src/hooks/useAuth';
import { getPerfilActivo } from '../../src/firebaseHelpers/perfiles';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import SimceGeneradorPreguntas from './SimceGeneradorPreguntas';
import SimceVisualizador from './SimceVisualizador';
import SimceResultados from './SimceResultados';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const SIMCE: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [perfil, setPerfil] = useState<string | null>(null);
  const { usuario } = useAuth();

  useEffect(() => {
    const cargarPerfil = async () => {
      if (usuario) {
        const perfilActivo = await getPerfilActivo(usuario.uid);
        setPerfil(perfilActivo);
      }
    };
    
    cargarPerfil();
  }, [usuario]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Determinar qué pestañas mostrar según el perfil
  const mostrarPestanaGenerador = perfil === 'SUBDIRECCION' || perfil === 'PROFESOR';
  const mostrarPestanaVisualizador = perfil === 'ESTUDIANTE';
  const mostrarPestanaResultados = perfil === 'SUBDIRECCION' || perfil === 'PROFESOR';

  // Si es estudiante, mostrar directamente el visualizador
  useEffect(() => {
    if (perfil === 'ESTUDIANTE') {
      setTabValue(0);
    }
  }, [perfil]);

  return (
    <div className="w-full p-4">
      <Typography variant="h5" component="h1" gutterBottom>
        Evaluación SIMCE
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="simce tabs"
        >
          {mostrarPestanaGenerador && (
            <Tab label="Generador de Preguntas" {...a11yProps(0)} />
          )}
          {mostrarPestanaResultados && (
            <Tab 
              label="Resultados" 
              {...a11yProps(mostrarPestanaGenerador ? 1 : 0)} 
            />
          )}
          {mostrarPestanaVisualizador && (
            <Tab 
              label="Evaluación" 
              {...a11yProps(0)} 
            />
          )}
        </Tabs>
      </Box>

      {/* Contenido de las pestañas según el perfil */}
      {perfil === 'ESTUDIANTE' ? (
        <TabPanel value={tabValue} index={0}>
          <SimceVisualizador />
        </TabPanel>
      ) : (
        <>
          <TabPanel value={tabValue} index={0}>
            <SimceGeneradorPreguntas />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <SimceResultados />
          </TabPanel>
        </>
      )}
    </div>
  );
};

export default SIMCE;
