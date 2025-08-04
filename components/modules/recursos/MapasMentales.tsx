import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Position,
  useReactFlow,
  Handle,
  NodeProps,
} from 'reactflow';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { MindMap, MindMapNode, MindMapEdge, MindMapTreeNode, User } from '../../../types';
import { toPng } from 'html-to-image';
import {
    subscribeToMindMaps,
    createMindMap,
    saveMindMap,
    deleteMindMap
} from '../../../src/firebaseHelpers/recursosHelper';
import 'reactflow/dist/style.css';

// --- Icons & Helper Components ---
const Spinner = () => (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const FullscreenIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1v4m0 0h-4m4-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 4l-5-5" /></svg>);
const TreeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657l-4.243 4.243a1 1 0 01-1.414 0l-4.243-4.243a1 1 0 010-1.414l4.243-4.243a1 1 0 011.414 0l4.243 4.243a1 1 0 010 1.414z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" /></svg>);
const CenterIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5l7 7-7 7" /></svg>);

// ✅ Componente de Nodo Personalizado para mostrar íconos y colores
const CustomNode: FC<NodeProps<MindMapNode['data']>> = ({ data }) => {
    const typeColorMap: Record<string, string> = {
        'Concepto Clave': 'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700',
        'Ejemplo Práctico': 'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700',
        'Dato Interesante': 'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700',
        'Pregunta Abierta': 'bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700',
        'default': 'bg-white border-slate-300 dark:bg-slate-800 dark:border-slate-600'
    };
    const colorClass = typeColorMap[data.type || 'default'] || typeColorMap.default;

    return (
        <div className={`p-3 rounded-lg shadow-md border-2 ${colorClass} flex items-center gap-3 min-w-[180px]`}>
            <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-slate-400" />
            <span className="text-xl">{data.icon || '🧠'}</span>
            <div className="flex flex-col">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{data.label}</span>
                {data.type && <span className="text-xs text-slate-500 dark:text-slate-400">{data.type}</span>}
            </div>
            <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-slate-400" />
        </div>
    );
};

const calculateSubtreeHeight = (node: MindMapTreeNode, levelHeight: number): number => {
    if (!node.children || node.children.length === 0) return levelHeight;
    return node.children.reduce((acc, child) => acc + calculateSubtreeHeight(child, levelHeight), 0);
};

const treeToFlow = (treeData: MindMapTreeNode, layout: 'tree' | 'central' = 'tree'): { nodes: MindMapNode[]; edges: MindMapEdge[] } => {
    const nodes: MindMapNode[] = [];
    const edges: MindMapEdge[] = [];
    const levelWidth = 280;
    const levelHeight = 100;

    if (layout === 'tree') {
        const traverse = (node: MindMapTreeNode, level: number, yPos: number) => {
            nodes.push({
                id: node.id,
                position: { x: level * levelWidth, y: yPos },
                data: { label: node.label, icon: node.icon, type: node.type },
                type: 'custom',
            });

            const subtreeHeight = calculateSubtreeHeight(node, levelHeight);
            let childYOffset = yPos - subtreeHeight / 2 + levelHeight / 2;

            (node.children || []).forEach(child => {
                const childSubtreeHeight = calculateSubtreeHeight(child, levelHeight);
                const childY = childYOffset + childSubtreeHeight / 2 - levelHeight/2;
                
                edges.push({ id: `e-${node.id}-${child.id}`, source: node.id, target: child.id, type: 'smoothstep', animated: true });
                traverse(child, level + 1, childY);
                
                childYOffset += childSubtreeHeight;
            });
        };
        traverse(treeData, 0, 0);
    } else {
         nodes.push({ id: treeData.id, position: { x: 0, y: 0 }, data: { label: treeData.label, icon: treeData.icon, type: treeData.type }, type: 'custom' });
        const radius1 = 300;
        const radius2 = 500;
        
        (treeData.children || []).forEach((child, l1Index) => {
            const angle1 = (l1Index / treeData.children.length) * 2 * Math.PI;
            nodes.push({ id: child.id, position: { x: radius1 * Math.cos(angle1), y: radius1 * Math.sin(angle1) }, data: { label: child.label, icon: child.icon, type: child.type }, type: 'custom' });
            edges.push({ id: `e-${treeData.id}-${child.id}`, source: treeData.id, target: child.id, type: 'smoothstep' });
            
            (child.children || []).forEach((grandchild, l2Index) => {
                const angle2 = angle1 + (l2Index - (child.children.length - 1) / 2) * 0.25;
                nodes.push({ id: grandchild.id, position: { x: radius2 * Math.cos(angle2), y: radius2 * Math.sin(angle2) }, data: { label: grandchild.label, icon: grandchild.icon, type: grandchild.type }, type: 'custom' });
                edges.push({ id: `e-${child.id}-${grandchild.id}`, source: child.id, target: grandchild.id, type: 'smoothstep' });
            });
        });
    }

    return { nodes, edges };
};

// ✅ Componente completo que faltaba en la versión anterior
interface EditableNodeProps {
    node: MindMapTreeNode;
    onUpdate: (id: string, label: string) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
    level?: number;
}
const EditableNode: FC<EditableNodeProps> = ({ node, onUpdate, onAddChild, onDelete, level = 0 }) => {
    const levelColors = ['bg-blue-100/50 dark:bg-blue-900/20', 'bg-yellow-100/50 dark:bg-yellow-900/20', 'bg-green-100/50 dark:bg-green-900/20'];
    const borderColor = ['border-blue-300 dark:border-blue-700', 'border-yellow-300 dark:border-yellow-700', 'border-green-300 dark:border-green-700'];

    return (
        <div className={`pl-4 ${level > 0 ? 'border-l ' + borderColor[level-1 % borderColor.length] : ''}`}>
             <div className={`p-2 rounded-lg my-1 ${levelColors[level % levelColors.length]}`}>
                 <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={node.label}
                        onChange={(e) => onUpdate(node.id, e.target.value)}
                        className="w-full bg-transparent focus:bg-white dark:focus:bg-slate-700 p-1 rounded border border-transparent focus:border-slate-300 dark:focus:border-slate-600 outline-none transition-colors"
                    />
                    <button onClick={() => onAddChild(node.id)} className="p-1.5 rounded-full hover:bg-slate-300/50 dark:hover:bg-slate-600/50 transition-colors">➕</button>
                    {level > 0 && <button onClick={() => onDelete(node.id)} className="p-1.5 rounded-full hover:bg-slate-300/50 dark:hover:bg-slate-600/50 transition-colors">🗑️</button>}
                </div>
            </div>
            {(node.children || []).map(child => (
                <EditableNode key={child.id} node={child} onUpdate={onUpdate} onAddChild={onAddChild} onDelete={onDelete} level={level + 1}/>
            ))}
        </div>
    );
};

const nodeTypes = { custom: CustomNode };

// ✅ Componente completo que faltaba en la versión anterior
const EditorView: FC<{
    mapData: MindMap;
    onBack: () => void;
    onSave: (map: MindMap) => void;
}> = ({ mapData, onBack, onSave }) => {
    const [treeData, setTreeData] = useState<MindMapTreeNode>(mapData.treeData);
    const [layout, setLayout] = useState<'tree' | 'central'>('tree');
    const [isSaving, setIsSaving] = useState(false);
    
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { fitView } = useReactFlow();

    useEffect(() => {
        const { nodes: newNodes, edges: newEdges } = treeToFlow(treeData, layout);
        setNodes(newNodes);
        setEdges(newEdges);
        setTimeout(() => fitView({ duration: 300 }), 50);
    }, [treeData, layout, setNodes, setEdges, fitView]);
    
    const updateNodeLabel = (id: string, label: string) => {
        const newTreeData = JSON.parse(JSON.stringify(treeData));
        const findAndUpdate = (node: MindMapTreeNode): boolean => {
            if (node.id === id) {
                node.label = label;
                return true;
            }
            return (node.children || []).some(findAndUpdate);
        };
        findAndUpdate(newTreeData);
        setTreeData(newTreeData);
    };

    const addChildNode = (parentId: string) => {
        const newTreeData = JSON.parse(JSON.stringify(treeData));
        const findAndAdd = (node: MindMapTreeNode): boolean => {
            if (node.id === parentId) {
                if (!node.children) node.children = [];
                node.children.push({ id: crypto.randomUUID(), label: 'Nuevo Nodo', children: [] });
                return true;
            }
            return (node.children || []).some(findAndAdd);
        };
        findAndAdd(newTreeData);
        setTreeData(newTreeData);
    };

    const deleteNode = (id: string) => {
        const newTreeData = JSON.parse(JSON.stringify(treeData));
        const findAndDelete = (node: MindMapTreeNode): boolean => {
            const index = (node.children || []).findIndex(child => child.id === id);
            if (index !== -1) {
                node.children.splice(index, 1);
                return true;
            }
            return (node.children || []).some(findAndDelete);
        };
        findAndDelete(newTreeData);
        setTreeData(newTreeData);
    };

    const handleSave = () => {
        setIsSaving(true);
        const { nodes, edges } = treeToFlow(treeData, layout);
        onSave({ ...mapData, treeData, nodes, edges });
        setTimeout(() => setIsSaving(false), 1000);
    };

    const handleExport = async (format: 'png' | 'pdf') => {
        const flowElement = document.querySelector('.react-flow');
        if (!flowElement) return;
        
        toPng(flowElement as HTMLElement, { backgroundColor: '#ffffff', cacheBust: true, pixelRatio: 2 })
            .then((dataUrl) => {
                if (format === 'png') {
                    const link = document.createElement('a');
                    link.download = `${mapData.tema}.png`;
                    link.href = dataUrl;
                    link.click();
                }
            })
            .catch(err => console.error('oops, something went wrong!', err));
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 truncate pr-4">{mapData.tema}</h2>
                <button onClick={onBack} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold flex-shrink-0">&larr; Volver a la lista</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 w-full h-[70vh] rounded-lg border dark:border-slate-700 relative">
                    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView nodeTypes={nodeTypes}>
                        <Controls />
                        <Background />
                    </ReactFlow>
                </div>

                <div className="w-full h-[70vh] flex flex-col bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
                     <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Editar</h3>
                     <div className="flex items-center gap-2 mb-4 border-b dark:border-slate-700 pb-2">
                         <button onClick={() => setLayout('tree')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 transition-colors ${layout === 'tree' ? 'bg-blue-500 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}><TreeIcon /> Vista en árbol</button>
                         <button onClick={() => setLayout('central')} className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 transition-colors ${layout === 'central' ? 'bg-blue-500 text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`}><CenterIcon /> Vista central</button>
                     </div>
                     <div className="flex-1 overflow-y-auto pr-2">
                        <EditableNode node={treeData} onUpdate={updateNodeLabel} onAddChild={addChildNode} onDelete={deleteNode} />
                     </div>
                     <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-end gap-4">
                        <button onClick={() => handleExport('png')} className="bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200">Exportar PNG</button>
                        <button onClick={handleSave} className="bg-amber-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-600 w-28">
                            {isSaving ? 'Guardado!' : 'Guardar'}
                        </button>
                     </div>
                </div>
            </div>
        </div>
    );
}

interface MapasMentalesProps { onBack: () => void; currentUser: User }
const MapasMentales: FC<MapasMentalesProps> = ({ onBack, currentUser }) => {
    const [view, setView] = useState<'list' | 'config' | 'editor'>('list');
    const [savedMaps, setSavedMaps] = useState<MindMap[]>([]);
    const [currentMap, setCurrentMap] = useState<MindMap | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(true);

    const [tema, setTema] = useState('');
    const [nivel, setNivel] = useState('');
    const [contenido, setContenido] = useState('');

    useEffect(() => {
        setDataLoading(true);
        const unsubscribe = subscribeToMindMaps((data) => {
            setSavedMaps(data);
            setDataLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleGenerateMap = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tema.trim()) { alert("El tema es obligatorio."); return; }
        setIsLoading(true);

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            alert("La API Key de Gemini no está configurada.");
            setIsLoading(false);
            return;
        }

        const prompt = `
            Basado en el tema central "${tema}", y considerando el contenido adicional "${contenido}", genera una estructura jerárquica para un mapa mental con al menos 3 niveles de profundidad.
            
            Tu respuesta DEBE ser un único objeto JSON válido sin texto adicional ni bloques \`\`\`json.
            
            La estructura del JSON debe ser un objeto raíz con las siguientes claves:
            - "label": El tema central ("${tema}").
            - "icon": Un emoji que represente el tema.
            - "type": La categoría, que para el nodo raíz debe ser "Concepto Clave".
            - "children": Un array de 2 a 4 nodos hijos.

            Cada nodo hijo (y sus descendientes) debe tener esta misma estructura:
            - "label": El texto del subtema.
            - "icon": Un emoji representativo.
            - "type": Una categoría descriptiva (ej: "Concepto Clave", "Ejemplo Práctico", "Dato Interesante", "Pregunta Abierta").
            - "children": Un array de nodos hijos, o un array vacío si es un nodo final.
        `;
        
        try {
            const ai = new GoogleGenerativeAI(apiKey);
            const model = ai.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
            const generatedTree = JSON.parse(cleanedText);

            const addIdsToTree = (node: any): MindMapTreeNode => {
                return {
                    id: crypto.randomUUID(),
                    label: node.label || 'Sin etiqueta',
                    icon: node.icon || '🧠',
                    type: node.type || 'default',
                    children: (node.children || []).map(addIdsToTree)
                };
            };

            const treeDataWithIds = addIdsToTree(generatedTree);
            const { nodes, edges } = treeToFlow(treeDataWithIds);

            const newMapData: Omit<MindMap, 'id' | 'createdAt'> = { tema, nivel, treeData: treeDataWithIds, nodes, edges };
            
            const newId = await createMindMap(newMapData, currentUser);
            setCurrentMap({ ...newMapData, id: newId, createdAt: new Date().toISOString() });
            setView('editor');
        } catch (error) {
            console.error("AI Generation Error:", error);
            alert("Hubo un error al generar el mapa mental. La respuesta de la IA pudo tener un formato incorrecto. Inténtelo de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveMap = async (mapToSave: MindMap) => {
        try {
            await saveMindMap(mapToSave, currentUser);
        } catch (error) {
            console.error("Error saving mind map:", error);
            alert("No se pudo guardar el mapa mental.");
        }
    };
    
    const handleEditMap = (map: MindMap) => { setCurrentMap(map); setView('editor'); };
    const handleDeleteMap = async (mapId: string) => { 
        if (window.confirm("¿Eliminar este mapa mental?")) {
            try {
                await deleteMindMap(mapId);
            } catch (error) {
                console.error("Error deleting mind map:", error);
                alert("No se pudo eliminar el mapa mental.");
            }
        }
    };

    const renderContent = () => {
        switch (view) {
            case 'editor':
                return currentMap ? (
                    <ReactFlowProvider>
                        <EditorView mapData={currentMap} onBack={() => setView('list')} onSave={handleSaveMap} />
                    </ReactFlowProvider>
                ) : null;
            case 'config':
                return (
                    <div className="max-w-2xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Nuevo Mapa Mental con IA</h2>
                            <button onClick={() => setView('list')} className="text-slate-600 hover:text-slate-900 font-semibold">&larr; Volver</button>
                        </div>
                        <form onSubmit={handleGenerateMap} className="space-y-4">
                            <div>
                                <label htmlFor="tema" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Tema Central <span className="text-red-500">*</span></label>
                                <input type="text" id="tema" value={tema} onChange={e => setTema(e.target.value)} required className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"/>
                            </div>
                             <div>
                                <label htmlFor="contenido" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Contenido o ideas clave (Opcional)</label>
                                <textarea id="contenido" value={contenido} onChange={e => setContenido(e.target.value)} rows={4} placeholder="Añade más detalles para guiar a la IA..." className="w-full border-slate-300 dark:border-slate-600 dark:bg-slate-700 rounded-md shadow-sm"/>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button type="submit" disabled={isLoading} className="bg-amber-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-amber-600 disabled:bg-slate-400 flex items-center justify-center min-w-[200px]">
                                    {isLoading ? <Spinner /> : 'Generar Mapa con IA'}
                                </button>
                            </div>
                        </form>
                    </div>
                );
            case 'list':
            default:
                return (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Mis Mapas Mentales</h2>
                            <button onClick={() => setView('config')} className="bg-amber-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-amber-600">Crear Nuevo</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {savedMaps.length > 0 ? savedMaps.map(map => (
                                <div key={map.id} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg shadow border dark:border-slate-700">
                                    <h3 className="font-bold text-lg truncate text-slate-800 dark:text-slate-200">{map.tema}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Creado: {new Date(map.createdAt).toLocaleDateString('es-CL')}</p>
                                    <div className="mt-4 flex gap-2">
                                        <button onClick={() => handleEditMap(map)} className="flex-1 bg-slate-200 dark:bg-slate-600 font-semibold py-1.5 px-3 rounded-md text-sm">Editar</button>
                                        <button onClick={() => handleDeleteMap(map.id)} className="flex-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-semibold py-1.5 px-3 rounded-md text-sm">Eliminar</button>
                                    </div>
                                </div>
                            )) : (
                                <p className="col-span-full text-center text-slate-500 dark:text-slate-400 py-8">No has creado ningún mapa mental todavía.</p>
                            )}
                        </div>
                    </>
                );
        }
    };
    
    if (dataLoading) {
        return <div className="text-center py-10">Cargando mapas mentales...</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-xl shadow-md">
            <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl">🧠</span>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">Mapas Mentales</h1>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:underline">&larr; Volver a Recursos</button>
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default MapasMentales;
