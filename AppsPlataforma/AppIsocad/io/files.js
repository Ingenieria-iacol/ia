/**
 * js/io/files.js
 * Gestión de archivos locales (Guardar y Abrir JSON)
 */

window.AppFiles = {
    /**
     * Guarda el estado actual del proyecto en un archivo .json
     */
    guardarProyecto: function() {
        const proyecto = {
            elementos: window.AppCore.elementos,
            capas: window.layers || [],
            fecha: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(proyecto, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = "isometrico_gas_v25.json";
        a.click();
        
        URL.revokeObjectURL(url);
        console.log("💾 Proyecto guardado como JSON");
    },

    /**
     * Carga un archivo JSON al sistema
     */
    cargarProyecto: function(archivo) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const contenido = JSON.parse(e.target.result);
                window.AppCore.elementos = contenido.elementos || [];
                window.AppCore.guardarEstado();
                window.CADRenderer.dibujarEscena();
                console.log("📂 Proyecto cargado con éxito");
            } catch (err) {
                alert("Error al leer el archivo JSON");
            }
        };
        reader.readAsText(archivo);
    }
};

// Conectar botones del index.html si existen
document.getElementById('btn-save')?.addEventListener('click', () => window.AppFiles.guardarProyecto());
