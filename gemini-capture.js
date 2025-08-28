// Función para capturar y guardar respuestas de Gemini para diagnóstico
// Para usar, pega este código en la consola del navegador cuando generes preguntas SIMCE

(function() {
  // Objeto para almacenar las respuestas
  const geminiCapture = {
    // Guarda la última respuesta
    lastResponse: null,
    
    // Configuración
    config: {
      active: true,
      debug: true,
      saveToLocalStorage: true
    },
    
    // Inicializa el monitor
    init: function() {
      console.log("🔍 Iniciando captura de respuestas de Gemini...");
      
      // Hook para XHR/fetch para capturar respuestas
      this.setupXHRHook();
      this.setupFetchHook();
      
      // Si hay respuesta guardada, cargarla
      this.loadFromStorage();
      
      console.log("✅ Monitor de respuestas Gemini activo");
      console.log("Para acceder a la última respuesta: geminiCapture.lastResponse");
      console.log("Para guardar la respuesta: geminiCapture.saveResponseToFile()");
    },
    
    // Hook para XMLHttpRequest
    setupXHRHook: function() {
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;
      const self = this;
      
      XMLHttpRequest.prototype.open = function(method, url) {
        this._geminiUrl = url;
        return originalXHROpen.apply(this, arguments);
      };
      
      XMLHttpRequest.prototype.send = function() {
        if (self.config.active && this._geminiUrl && 
            (this._geminiUrl.includes('generativelanguage.googleapis.com') || 
             this._geminiUrl.includes('gemini'))) {
          
          this.addEventListener('load', function() {
            try {
              if (this.status === 200) {
                const response = JSON.parse(this.responseText);
                self.processResponse(response, this._geminiUrl);
              }
            } catch (e) {
              console.error("Error procesando respuesta XHR:", e);
            }
          });
        }
        return originalXHRSend.apply(this, arguments);
      };
    },
    
    // Hook para fetch
    setupFetchHook: function() {
      const originalFetch = window.fetch;
      const self = this;
      
      window.fetch = function(resource, init) {
        const url = typeof resource === 'string' ? resource : resource.url;
        
        if (self.config.active && url && 
            (url.includes('generativelanguage.googleapis.com') || 
             url.includes('gemini'))) {
          
          return originalFetch.apply(this, arguments)
            .then(response => {
              const clone = response.clone();
              
              clone.json().then(data => {
                self.processResponse(data, url);
              }).catch(e => {
                console.error("Error procesando respuesta fetch:", e);
              });
              
              return response;
            });
        }
        
        return originalFetch.apply(this, arguments);
      };
    },
    
    // Procesa una respuesta de la API
    processResponse: function(response, url) {
      if (this.config.debug) {
        console.log("📥 Capturada respuesta de Gemini:", url);
      }
      
      // Extraer el texto del contenido generado
      let generatedText = "";
      
      try {
        if (response.candidates && response.candidates[0] && 
            response.candidates[0].content && 
            response.candidates[0].content.parts) {
          
          generatedText = response.candidates[0].content.parts[0].text || "";
        } else if (response.text) {
          generatedText = response.text;
        } else if (response.response && response.response.text) {
          generatedText = response.response.text;
        }
        
        // Guardar solo si parece relacionado con preguntas SIMCE
        if (generatedText.includes('"id": "p1"') || 
            generatedText.includes('"enunciado"') || 
            generatedText.includes('alternativas')) {
          
          this.lastResponse = generatedText;
          console.log("✅ Capturada respuesta Gemini relacionada con SIMCE");
          
          // Guardar automáticamente
          if (this.config.saveToLocalStorage) {
            this.saveToStorage();
          }
        }
      } catch (e) {
        console.error("Error extrayendo texto de la respuesta:", e);
      }
    },
    
    // Guarda la respuesta en localStorage
    saveToStorage: function() {
      if (this.lastResponse) {
        try {
          localStorage.setItem('geminiCapture_response', this.lastResponse);
          localStorage.setItem('geminiCapture_timestamp', new Date().toISOString());
          if (this.config.debug) {
            console.log("💾 Respuesta guardada en localStorage");
          }
        } catch (e) {
          console.error("Error guardando en localStorage:", e);
        }
      }
    },
    
    // Carga la respuesta desde localStorage
    loadFromStorage: function() {
      try {
        const savedResponse = localStorage.getItem('geminiCapture_response');
        const timestamp = localStorage.getItem('geminiCapture_timestamp');
        
        if (savedResponse) {
          this.lastResponse = savedResponse;
          console.log(`ℹ️ Cargada respuesta guardada (${new Date(timestamp).toLocaleString()})`);
        }
      } catch (e) {
        console.error("Error cargando desde localStorage:", e);
      }
    },
    
    // Crear y descargar archivo de texto con la respuesta
    saveResponseToFile: function() {
      if (!this.lastResponse) {
        console.error("❌ No hay respuesta capturada para guardar");
        return;
      }
      
      try {
        const blob = new Blob([this.lastResponse], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = 'respuesta-gemini.txt';
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log("📄 Archivo respuesta-gemini.txt creado y descargado");
        console.log("Para diagnóstico, coloca este archivo en la raíz del proyecto");
        console.log("y ejecuta: node diagnose-gemini.js");
      } catch (e) {
        console.error("Error creando archivo:", e);
      }
    }
  };
  
  // Inicializar
  geminiCapture.init();
  
  // Hacer accesible globalmente
  window.geminiCapture = geminiCapture;
  
  // Mostrar instrucciones
  console.log(`
  =====================================================
  🔎 DIAGNÓSTICO GEMINI ACTIVADO 🔎
  =====================================================
  
  Instrucciones:
  
  1. Este script capturará automáticamente las respuestas
     de Gemini relacionadas con preguntas SIMCE.
  
  2. Para guardar la última respuesta como archivo:
     geminiCapture.saveResponseToFile()
  
  3. Para ver la última respuesta capturada:
     geminiCapture.lastResponse
  
  4. Para diagnóstico completo:
     - Guarda la respuesta con el método del paso 2
     - Coloca el archivo en la raíz del proyecto
     - Ejecuta: node diagnose-gemini.js
  
  =====================================================
  `);
  
})();
