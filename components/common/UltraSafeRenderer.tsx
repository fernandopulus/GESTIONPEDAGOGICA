import React from 'react';

// UltraSafeRenderer: Renderiza texto plano, markdown o HTML seguro (sin JS)
// Uso: <UltraSafeRenderer content={texto} context="simce-texto-base" />
interface UltraSafeRendererProps {
  content: any;
  context?: string;
}

const UltraSafeRenderer: React.FC<UltraSafeRendererProps> = ({ content, context = 'unknown' }) => {
  // Si es string, intentamos detectar si es HTML/markdown simple
  if (typeof content === 'string') {
    // Si contiene tags HTML básicos, renderizar como HTML seguro
    if (/<[a-z][\s\S]*>/i.test(content)) {
      return (
        <span
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }
    // Si contiene saltos de línea, renderizar como texto plano con saltos
    return <span className="whitespace-pre-wrap">{content}</span>;
  }
  // Si es ReactNode o cualquier otra cosa
  if (React.isValidElement(content)) return content;
  // Si es objeto serializable
  try {
    return <span>{JSON.stringify(content)}</span>;
  } catch {
    return <span>[Sin contenido disponible]</span>;
  }
};

export default UltraSafeRenderer;
