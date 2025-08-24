import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { PlanificacionClase } from '../../types';

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
  infoContainer: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 5,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  infoLabel: {
    width: '30%',
    fontWeight: 'bold',
    fontSize: 11,
    color: '#4B5563',
  },
  infoValue: {
    width: '70%',
    fontSize: 11,
    color: '#1F2937',
  },
  section: {
    marginTop: 15,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1F2937',
    backgroundColor: '#F1F5F9',
    padding: '5 8',
    borderRadius: 3,
  },
  momentoContainer: {
    marginBottom: 20,
    border: '1pt solid #E5E7EB',
    padding: 10,
    borderRadius: 5,
  },
  momentoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#4B5563',
  },
  momentoContent: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.5,
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
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    right: 40,
    fontSize: 9,
    color: '#9CA3AF',
  },
  timelineContainer: {
    marginBottom: 15,
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 5,
  },
  timelineItem: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  timelineTime: {
    width: 80,
    fontSize: 10,
    color: '#4B5563',
  },
  timelineActivity: {
    flex: 1,
    fontSize: 10,
    color: '#1F2937',
  },
  detalleOrigenContainer: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 5,
  },
  detalleOrigenTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 5,
  },
  detalleOrigenRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  detalleOrigenLabel: {
    width: '30%',
    fontWeight: 'bold',
    fontSize: 9,
    color: '#3B82F6',
  },
  detalleOrigenValue: {
    width: '70%',
    fontSize: 9,
    color: '#1E3A8A',
  },
});

// Componente para generar el PDF de la clase
const ClasePDF = ({ plan }: { plan: PlanificacionClase }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan de Clase: {plan.nombreClase}</Text>
        <Text style={styles.subtitle}>{plan.asignatura} - {plan.nivel}</Text>
        <Text style={styles.subtitle}>Autor: {plan.autor} - Creado: {new Date(plan.fechaCreacion).toLocaleDateString('es-CL')}</Text>
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Duración:</Text>
          <Text style={styles.infoValue}>{plan.duracionClase} minutos</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Contenidos:</Text>
          <Text style={styles.infoValue}>{plan.contenidos}</Text>
        </View>
        {plan.observaciones && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Observaciones:</Text>
            <Text style={styles.infoValue}>{plan.observaciones}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Momentos de la Clase</Text>
        
        <View style={styles.momentoContainer}>
          <Text style={styles.momentoTitle}>Inicio</Text>
          <Text style={styles.momentoContent}>{plan.momentosClase.inicio}</Text>
        </View>
        
        <View style={styles.momentoContainer}>
          <Text style={styles.momentoTitle}>Desarrollo</Text>
          <Text style={styles.momentoContent}>{plan.momentosClase.desarrollo}</Text>
        </View>
        
        <View style={styles.momentoContainer}>
          <Text style={styles.momentoTitle}>Cierre</Text>
          <Text style={styles.momentoContent}>{plan.momentosClase.cierre}</Text>
        </View>
      </View>
      
      {plan.detalleLeccionOrigen && (
        <View style={styles.detalleOrigenContainer}>
          <Text style={styles.detalleOrigenTitle}>Información Adicional de la Unidad</Text>
          
          <View style={styles.detalleOrigenRow}>
            <Text style={styles.detalleOrigenLabel}>Objetivo:</Text>
            <Text style={styles.detalleOrigenValue}>{plan.detalleLeccionOrigen.objetivosAprendizaje}</Text>
          </View>
          
          <View style={styles.detalleOrigenRow}>
            <Text style={styles.detalleOrigenLabel}>Habilidad (Bloom):</Text>
            <Text style={styles.detalleOrigenValue}>{plan.detalleLeccionOrigen.habilidadesBloom}</Text>
          </View>
          
          <View style={styles.detalleOrigenRow}>
            <Text style={styles.detalleOrigenLabel}>Perfil de Egreso:</Text>
            <Text style={styles.detalleOrigenValue}>{plan.detalleLeccionOrigen.perfilEgreso}</Text>
          </View>
          
          <View style={styles.detalleOrigenRow}>
            <Text style={styles.detalleOrigenLabel}>Interdisciplinariedad:</Text>
            <Text style={styles.detalleOrigenValue}>{plan.detalleLeccionOrigen.asignaturasInterdisciplinariedad}</Text>
          </View>
        </View>
      )}
      
      <Text style={styles.footer}>
        Plan de clase generado por Plataforma de Gestión Pedagógica - {new Date().getFullYear()}
      </Text>
      
      <Text 
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        fixed 
      />
    </Page>
  </Document>
);

export default ClasePDF;
