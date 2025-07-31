import React, { useState, useEffect, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { Anuncio, Profile, User, DestinatariosAnuncio, TipoDestinatario } from '../../types';
import { CURSOS } from '../../constants';

const ANUNCIOS_KEY = 'anunciosMuro';

const postItStyles = [
    { bg: 'bg-yellow-200 dark:bg-yellow-800/50', rotate: 'transform -rotate-2' },
    { bg: 'bg-lime-200 dark:bg-lime-800/50', rotate: 'transform rotate-1' },
    { bg: 'bg-sky-200 dark:bg-sky-800/50', rotate: 'transform rotate-2' },
    { bg: 'bg-red-200 dark:bg-red-800/50', rotate: 'transform -rotate-1' },
    { bg: 'bg-violet-200 dark:bg-violet-800/50', rotate: 'transform rotate-1' },
];

interface MuroAnunciosProps {
    currentUser: User;
}

const MuroAnuncios: React.FC<MuroAnunciosProps> = ({ currentUser }) => {
    const [anuncios, setAnuncios] = useState<Anuncio[]>(() => {
        try {
            const data = localStorage.getItem(ANUNCIOS_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error al leer anuncios de localStorage en la inicialización", e);
            return [];
        }
    });

    const [formData, setFormData] = useState({
        titulo: '',
        mensaje: '',
        adjunto: '',
    });
    const [destinatarios, setDestinatarios] = useState<DestinatariosAnuncio>({ tipo: 'Todos', cursos: [] });

    useEffect(() => {
        try {
            localStorage.setItem(ANUNCIOS_KEY, JSON.stringify(anuncios));
        } catch (e) {
            console.error("Error al guardar anuncios en localStorage", e);
        }
    }, [anuncios]);


    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleDestinatarioTipoChange = (tipo: TipoDestinatario) => {
        setDestinatarios({ tipo, cursos: tipo === 'Cursos' ? [] : undefined });
    };

    const handleCursoDestinoChange = (curso: string) => {
        setDestinatarios(prev => {
            if (prev.tipo !== 'Cursos') return prev;
            const newCursos = prev.cursos?.includes(curso)
                ? prev.cursos.filter(c => c !== curso)
                : [...(prev.cursos || []), curso];
            return { ...prev, cursos: newCursos };
        });
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!formData.titulo || !formData.mensaje) {
            alert('Título y mensaje son obligatorios.');
            return;
        }
        if (destinatarios.tipo === 'Cursos' && (!destinatarios.cursos || destinatarios.cursos.length === 0)) {
            alert('Debe seleccionar al menos un curso para el destinatario "Cursos".');
            return;
        }

        const newAnuncio: Anuncio = {
            id: crypto.randomUUID(),
            fechaPublicacion: new Date().toISOString(),
            destacado: false,
            autor: currentUser.nombreCompleto,
            profileCreador: currentUser.profile,
            destinatarios,
            ...formData,
        };

        setAnuncios(prev => [newAnuncio, ...prev]);
        setFormData({
            titulo: '',
            mensaje: '',
            adjunto: '',
        });
        setDestinatarios({ tipo: 'Todos', cursos: [] });
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este anuncio?')) {
            setAnuncios(prev => prev.filter(a => a.id !== id));
        }
    };

    const handleTogglePin = (id: string) => {
        setAnuncios(prev => prev.map(a => a.id === id ? { ...a, destacado: !a.destacado } : a));
    };

    const sortedAnuncios = useMemo(() => {
        return [...anuncios].sort((a, b) => {
            if (a.destacado && !b.destacado) return -1;
            if (!a.destacado && b.destacado) return 1;
            return new Date(b.fechaPublicacion).getTime() - new Date(a.fechaPublicacion).getTime();
        });
    }, [anuncios]);

    const filteredAndSortedAnuncios = useMemo(() => {
        const profile = currentUser.profile;
        const curso = currentUser.curso;

        return sortedAnuncios.filter(anuncio => {
            if (profile === Profile.SUBDIRECCION) {
                return true;
            }

            if (!anuncio.destinatarios) {
                return profile !== Profile.ESTUDIANTE;
            }

            const { tipo, cursos } = anuncio.destinatarios;
            
            if (tipo === 'Todos') return true;
            if (tipo === 'Profesores' && profile === Profile.PROFESORADO) return true;
            if (tipo === 'Coordinación TP' && profile === Profile.COORDINACION_TP) return true;
            if (tipo === 'Cursos') {
                if (profile === Profile.ESTUDIANTE) {
                    return cursos?.includes(curso || '');
                }
                return true;
            }
            return false;
        });
    }, [sortedAnuncios, currentUser]);
    
    const canDelete = (anuncio: Anuncio): boolean => {
        if (currentUser.profile === Profile.ESTUDIANTE) return false;
        return currentUser.profile === Profile.SUBDIRECCION || currentUser.profile === anuncio.profileCreador;
    };
    
    const canPin = (): boolean => {
         return currentUser.profile === Profile.SUBDIRECCION || currentUser.profile === Profile.PROFESORADO;
    };
    
    const inputStyles = "w-full border-slate-300 rounded-md shadow-sm focus:ring-amber-400 focus:border-amber-400 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";


    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-2">Muro de Anuncios</h1>
                {currentUser.profile !== Profile.ESTUDIANTE ? (
                    <>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">Publique un nuevo anuncio para toda la comunidad escolar.</p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="titulo" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Título</label>
                                <input type="text" name="titulo" value={formData.titulo} onChange={handleFieldChange} required className={inputStyles} />
                            </div>
                             <div>
                                <label htmlFor="mensaje" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Mensaje</label>
                                <textarea name="mensaje" value={formData.mensaje} onChange={handleFieldChange} required rows={4} className={inputStyles}></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Destinatarios</label>
                                <div className="flex flex-wrap gap-4 items-center">
                                    {(['Todos', 'Cursos', 'Profesores', 'Coordinación TP'] as TipoDestinatario[]).map(tipo => (
                                        <label key={tipo} className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="destinatarioTipo"
                                                value={tipo}
                                                checked={destinatarios.tipo === tipo}
                                                onChange={() => handleDestinatarioTipoChange(tipo)}
                                                className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300"
                                            />
                                            <span className="text-slate-700 dark:text-slate-300">{tipo.replace('Coordinación TP', 'Coord. TP')}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            {destinatarios.tipo === 'Cursos' && (
                                <div className="p-4 border rounded-md bg-slate-50 dark:bg-slate-700/50 dark:border-slate-600 animate-fade-in">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Seleccione Cursos</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
                                        {CURSOS.map(curso => (
                                            <label key={curso} className="flex items-center gap-2 p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={destinatarios.cursos?.includes(curso)}
                                                    onChange={() => handleCursoDestinoChange(curso)}
                                                    className="h-4 w-4 rounded text-amber-500 focus:ring-amber-400 border-slate-300 bg-slate-100"
                                                />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{curso}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label htmlFor="adjunto" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Enlace adjunto (Opcional)</label>
                                <input type="url" name="adjunto" value={formData.adjunto} onChange={handleFieldChange} placeholder="https://ejemplo.com/documento.pdf" className={inputStyles} />
                            </div>
                            <div className="pt-2 text-right">
                                <button type="submit" className="bg-slate-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-600">
                                    Publicar Anuncio
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Anuncios de la comunidad escolar. Este módulo es de solo lectura.</p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-8 py-4">
                {filteredAndSortedAnuncios.length > 0 ? filteredAndSortedAnuncios.map((anuncio, index) => {
                    const style = postItStyles[index % postItStyles.length];
                    return (
                        <div 
                            key={anuncio.id}
                            className={`font-handwritten text-slate-800 dark:text-slate-200 shadow-xl p-4 flex flex-col relative transition-transform duration-300 ease-in-out hover:scale-105 hover:rotate-0 hover:z-10 ${style.bg} ${style.rotate}`}
                        >
                            {anuncio.destacado && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                    <span className="text-5xl" role="img" aria-label="Anuncio destacado">📌</span>
                                </div>
                            )}

                            <h2 className="text-3xl font-bold border-b-2 border-slate-500/30 dark:border-slate-400/30 pb-2 mb-4 break-words">{anuncio.titulo}</h2>
                            
                            <p className="flex-grow text-2xl whitespace-pre-wrap mb-4 break-words min-h-[100px]">{anuncio.mensaje}</p>

                            {anuncio.adjunto && (
                                <div className="font-sans text-sm mb-4">
                                    <a href={anuncio.adjunto} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                        Ver Adjunto
                                    </a>
                                </div>
                            )}

                            <div className="font-sans text-xs mt-auto pt-2 border-t border-slate-500/30 dark:border-slate-400/30 flex justify-between items-end">
                                <div>
                                    <p className="font-bold">{anuncio.autor}</p>
                                    <p className="text-slate-600 dark:text-slate-400">{new Date(anuncio.fechaPublicacion).toLocaleString('es-CL')}</p>
                                </div>
                                <div className="flex items-center">
                                    {canPin() && (
                                        <button onClick={() => handleTogglePin(anuncio.id)} title={anuncio.destacado ? 'Desfijar' : 'Fijar'} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                                            <span className={`text-xl transition-opacity ${anuncio.destacado ? 'opacity-100' : 'opacity-30'}`}>📌</span>
                                        </button>
                                    )}
                                    {canDelete(anuncio) && (
                                        <button onClick={() => handleDelete(anuncio.id)} title="Eliminar" className="text-red-600 hover:text-red-800 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }) : (
                     <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-md text-center col-span-full">
                        <p className="text-slate-500 dark:text-slate-400 text-lg">No hay anuncios para mostrar con los filtros actuales.</p>
                     </div>
                )}
            </div>
        </div>
    );
};

export default MuroAnuncios;