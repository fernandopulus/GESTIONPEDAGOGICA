import React, { useState, useEffect, useCallback, useRef, FC } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Node,
  Edge,
  Position,
  useReactFlow,
  Handle,
  NodeProps,
} from 'reactflow';
// ✅ IA: Importar la librería de Google Generative AI
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
const Spinner = () => (<svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>);
const FullscreenIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1v4m0 0h-4m4-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 4l-5-5" /></svg>);
const TreeIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657l-4.243 4.243a1 1 0 01-1.414 0l-4.243-4.243a1 1 0 010-1.414l4.243-4.243a1 1 0 011.414 0l4.243 4.243a1 1 0 010 1.414z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" /></svg>);
const CenterIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5l7 7-7 7" /></svg>);

// ✅ IA: Componente de Nodo Personalizado para mostrar íconos y colores
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
        <div className={`p-3 rounded-lg shadow-md border-2 ${colorClass} flex items-center gap-3`}>
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

// ✅ IA: Función actualizada para usar los nuevos datos (ícono, tipo) y el nodo personalizado
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
                type: 'custom', // Usar nuestro nodo personalizado
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
    } else { // Layout Central
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

// ... (El resto de los componentes como EditableNode, EditorView, etc., se mantienen igual)
// ...

// ✅ IA: Se importa el componente de nodo personalizado para usarlo en ReactFlow
const nodeTypes = {
    custom: CustomNode,
};

// ... (Componente EditorView con la prop `nodeTypes` añadida a ReactFlow)
const EditorView: FC<{
    mapData: MindMap;
    onBack: () => void;
    onSave: (map: MindMap) => void;
}> = ({ mapData, onBack, onSave }) => {
    // ... todo el estado y funciones de EditorView se mantienen ...
    return (
        // ...
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView nodeTypes={nodeTypes}>
            <Controls />
            <Background />
        </ReactFlow>
        // ...
    );
}

const MapasMentales: FC<{ onBack: () => void; currentUser: User }> = ({ onBack, currentUser }) => {
    // ... todo el estado se mantiene ...

    // ✅ IA: Función de generación de mapas completamente nueva y mejorada
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

            // Función recursiva para añadir IDs únicos a cada nodo generado por la IA
            const addIdsToTree = (node: any): MindMapTreeNode => {
                return {
                    id: crypto.randomUUID(),
                    label: node.label,
                    icon: node.icon,
                    type: node.type,
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
    
    // ... El resto del componente `MapasMentales` se mantiene igual ...
};

export default MapasMentales;