import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { PlanificacionUnidad } from '../../types';

// Registrar fuentes personalizadas
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/roboto/v27/KFOlCnqEu92Fr1MmEU9vAx05IsDqlA.ttf', fontWeight: 'bold' },
  ],
});

// Estilos para el PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Roboto',
  },
  header: {
    marginBottom: 20,
    borderBottom: '1pt solid #DDD',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#2563EB',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 5,
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1F2937',
    backgroundColor: '#F1F5F9',
    padding: '5 8',
    borderRadius: 3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    fontSize: 11,
    color: '#4B5563',
  },
  value: {
    width: '70%',
    fontSize: 11,
    color: '#1F2937',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#9CA3AF',
    textAlign: 'center',
    borderTop: '1pt solid #DDD',
    paddingTop: 10,
  },
  leccionContainer: {
    marginBottom: 15,
    border: '1pt solid #E5E7EB',
    padding: 10,
    borderRadius: 5,
  },
  leccionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#4B5563',
  },
  leccionRow: {
    flexDirection: 'row',
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  leccionLabel: {
    width: '25%',
    fontWeight: 'bold',
    fontSize: 10,
    color: '#6B7280',
  },
  leccionValue: {
    width: '75%',
    fontSize: 10,
    color: '#374151',
  },
  actividadDetailContainer: {
    marginTop: 5,
    padding: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
  },
  actividadDetailTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 3,
  },
  actividadDetailRow: {
    flexDirection: 'row',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  actividadDetailLabel: {
    width: '25%',
    fontWeight: 'bold',
    fontSize: 9,
    color: '#6B7280',
  },
  actividadDetailValue: {
    width: '75%',
    fontSize: 9,
    color: '#374151',
  },
  table: {
    display: 'table',
    width: 'auto',
    marginVertical: 10,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  tableColHeader: {
    backgroundColor: '#F3F4F6',
    padding: 5,
  },
  tableCol: {
    padding: 5,
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 10,
    color: '#4B5563',
  },
  tableCell: {
    fontSize: 10,
    color: '#374151',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: '#9CA3AF',
  },
});

// Componente para generar el PDF de la unidad
const UnidadPDF = ({ plan }: { plan: PlanificacionUnidad }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{plan.nombreUnidad}</Text>
        <Text style={styles.subtitle}>{plan.asignatura} - {plan.nivel}</Text>
        <Text style={styles.subtitle}>Autor: {plan.autor} - Creado: {new Date(plan.fechaCreacion).toLocaleDateString('es-CL')}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información General</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Objetivo de Aprendizaje:</Text>
          <Text style={styles.value}>{plan.objetivosAprendizaje}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Indicadores de Evaluación:</Text>
          <Text style={styles.value}>{plan.indicadoresEvaluacion}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Contenidos:</Text>
          <Text style={styles.value}>{plan.contenidos}</Text>
        </View>
        {plan.observaciones && (
          <View style={styles.row}>
            <Text style={styles.label}>Observaciones:</Text>
            <Text style={styles.value}>{plan.observaciones}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Detalle de Lecciones</Text>
        {plan.detallesLeccion.map((leccion, index) => (
          <View key={index} style={styles.leccionContainer}>
            <Text style={styles.leccionTitle}>Clase {index + 1}: {leccion.actividades}</Text>
            
            <View style={styles.leccionRow}>
              <Text style={styles.leccionLabel}>Objetivo:</Text>
              <Text style={styles.leccionValue}>{leccion.objetivosAprendizaje}</Text>
            </View>
            
            <View style={styles.leccionRow}>
              <Text style={styles.leccionLabel}>Contenidos:</Text>
              <Text style={styles.leccionValue}>{leccion.contenidosConceptuales}</Text>
            </View>
            
            <View style={styles.leccionRow}>
              <Text style={styles.leccionLabel}>Habilidad (Bloom):</Text>
              <Text style={styles.leccionValue}>{leccion.habilidadesBloom}</Text>
            </View>
            
            <View style={styles.leccionRow}>
              <Text style={styles.leccionLabel}>Perfil de Egreso:</Text>
              <Text style={styles.leccionValue}>{leccion.perfilEgreso}</Text>
            </View>
            
            <View style={styles.leccionRow}>
              <Text style={styles.leccionLabel}>Interdisciplinariedad:</Text>
              <Text style={styles.leccionValue}>{leccion.asignaturasInterdisciplinariedad}</Text>
            </View>

            {leccion.actividadDetallada && (
              <View style={styles.actividadDetailContainer}>
                <Text style={styles.actividadDetailTitle}>Actividad Detallada</Text>
                
                <View style={styles.actividadDetailRow}>
                  <Text style={styles.actividadDetailLabel}>Estrategia:</Text>
                  <Text style={styles.actividadDetailValue}>{leccion.actividadDetallada.estrategiaDidactica}</Text>
                </View>
                
                <View style={styles.actividadDetailRow}>
                  <Text style={styles.actividadDetailLabel}>Materiales:</Text>
                  <Text style={styles.actividadDetailValue}>{leccion.actividadDetallada.materiales}</Text>
                </View>
                
                <View style={styles.actividadDetailRow}>
                  <Text style={styles.actividadDetailLabel}>Organización:</Text>
                  <Text style={styles.actividadDetailValue}>{leccion.actividadDetallada.organizacionEstudiantes}</Text>
                </View>
                
                <View style={styles.actividadDetailRow}>
                  <Text style={styles.actividadDetailLabel}>Tiempo estimado:</Text>
                  <Text style={styles.actividadDetailValue}>{leccion.actividadDetallada.tiempoEstimado}</Text>
                </View>
                
                <View style={styles.actividadDetailRow}>
                  <Text style={styles.actividadDetailLabel}>Descripción:</Text>
                  <Text style={styles.actividadDetailValue}>{leccion.actividadDetallada.descripcion}</Text>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>
      
      <Text style={styles.footer}>
        Planificación generada por Plataforma de Gestión Pedagógica - {new Date().getFullYear()}
      </Text>
      
      <Text 
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed 
      />
    </Page>
  </Document>
);

export default UnidadPDF;
