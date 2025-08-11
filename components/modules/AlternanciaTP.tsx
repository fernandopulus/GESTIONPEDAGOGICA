// RUTA: components/modules/AlternanciaTP.tsx
// VERSIÓN AUTÓNOMA GARANTIZADA PARA COMPILAR. NO TIENE DEPENDENCIAS EXTERNAS.

import React from 'react';

// --- COMPONENTE AUTÓNOMO DE ALTERNANCIA TP ---

const AlternanciaTP: React.FC = () => {

    // --- DATOS DE EJEMPLO INTERNOS ---
    // Para no depender de Firebase, los datos se definen aquí mismo.
    const MOCK_COHORTES = [
        {
            id: "c1",
            nombre: "4°B - Mecánica Industrial",
            especialidad: "Mecánica Industrial",
            estudiantes: 28,
            avance: 48,
            empresa: "MetalMaq SpA",
        },
        {
            id: "c2",
            nombre: "4°C - Energías Renovables",
            especialidad: "Energía",
            estudiantes: 26,
            avance: 22,
            empresa: "Energía Andes",
        },
    ];

    // --- ESTILOS EN LÍNEA ---
    // Para no depender de librerías de UI externas como shadcn/ui o Tailwind,
    // se usan estilos directamente en el JSX. Esto asegura que compile.
    const cardStyle: React.CSSProperties = {
        backgroundColor: '#FFFFFF',
        color: '#334155',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1rem',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        border: '1px solid #E2E8F0'
    };
    
    const buttonStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        backgroundColor: '#1E293B',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '0.875rem'
    };

    const outlineButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        backgroundColor: 'white',
        color: '#334155',
        border: '1px solid #E2E8F0',
    };

    return (
        <div style={{ fontFamily: 'system-ui, sans-serif' }}>

            {/* Encabezado */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1E293B' }}>
                        Dashboard de Alternancia TP
                    </h1>
                    <p style={{ marginTop: '0.25rem', color: '#64748B' }}>
                        Monitorea cohortes, empresas y el progreso de los planes de alternancia.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={outlineButtonStyle}>
                        <span role="img" aria-label="descargar">📥</span> Exportar
                    </button>
                    <button style={buttonStyle}>
                        <span role="img" aria-label="añadir">➕</span> Nuevo Plan
                    </button>
                </div>
            </div>

            {/* Listado de Cohortes */}
            <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: '#1E293B' }}>
                    Cohortes en Curso
                </h2>
                {MOCK_COHORTES.map((cohorte) => (
                    <div key={cohorte.id} style={cardStyle}>
                        {/* -- Cabecera de la Tarjeta -- */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #F1F5F9', paddingBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>{cohorte.nombre}</h3>
                                <p style={{ color: '#64748B', margin: '0.25rem 0 0 0' }}>{cohorte.especialidad}</p>
                            </div>
                            <span style={{ padding: '0.25rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: '9999px', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                                {cohorte.estudiantes} Estudiantes
                            </span>
                        </div>
                        
                        {/* -- Cuerpo de la Tarjeta -- */}
                        <div style={{ marginTop: '1rem' }}>
                             <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.875rem' }}>
                                <span role="img" aria-label="empresa">🏢</span>
                                <span>Empresa: <span style={{ fontWeight: '500', color: '#1E293B' }}>{cohorte.empresa}</span></span>
                            </div>

                            {/* -- Barra de Progreso -- */}
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                                    <span style={{ fontWeight: '500' }}>Progreso del Plan</span>
                                    <span style={{ fontWeight: '500' }}>{cohorte.avance}%</span>
                                </div>
                                <div style={{ width: '100%', backgroundColor: '#E2E8F0', borderRadius: '9999px', height: '8px' }}>
                                    <div style={{ width: `${cohorte.avance}%`, backgroundColor: '#3B82F6', borderRadius: '9999px', height: '100%' }}></div>
                                </div>
                            </div>
                        </div>

                        {/* -- Pie de la Tarjeta -- */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1.5rem', marginTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                            <button style={buttonStyle}>
                                Ver Detalles <span role="img" aria-label="flecha">➡️</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AlternanciaTP;