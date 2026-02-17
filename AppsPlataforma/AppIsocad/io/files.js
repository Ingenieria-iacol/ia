/**
 * js/io/files.js - GESTIÓN DE PERSISTENCIA E INTEGRIDAD
 */
window.AppFiles = {
    // Clave para el almacenamiento local
    STORAGE_KEY: 'cad_gas_last_session',

    /**
     * Guarda el estado actual en un archivo .json (Para compartir/respaldar)
     */
    guardarProyecto: function() {
        const proyecto = {
            elementos: window.AppCore.elementos,
            config: window.CONFIG,
            fecha: new Date().toISOString(),
            version: "3.1.7"
        };

        const blob = new Blob([JSON.stringify(proyecto, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `proyecto_gas_${new Date().getTime()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        console.log("💾 Proyecto exportado a disco");
    },

    /**
     * Carga un archivo JSON al sistema (Para editar trabajos previos)
     */
    cargarProyecto: function(archivo) {
        if (!archivo) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const contenido = JSON.parse(e.target.result);
                if (contenido.elementos) {
                    window.AppCore.elementos = contenido.elementos;
                    // Forzamos el guardado de estado para el historial de deshacer
                    window.AppCore.guardarEstado(); 
                    window.CADRenderer.dibujarEscena();
                    this.sincronizarLocalStorage();
                    alert("✅ Proyecto cargado con éxito");
                }
            } catch (err) {
                console.error("Error de integridad:", err);
                alert("❌ El archivo no es un proyecto de CAD Gas válido");
            }
        };
        reader.readAsText(archivo);
    },

    /**
     * Guarda automáticamente en el navegador (Evita pérdida de datos)
     */
    sincronizarLocalStorage: function() {
        const data = JSON.stringify(window.AppCore.elementos);
        localStorage.setItem(this.STORAGE_KEY, data);
    },

    /**
     * Recupera el trabajo si la página se refresca
     */
    recuperarSesion: function() {
        const backup = localStorage.getItem(this.STORAGE_KEY);
        if (backup) {
            try {
                window.AppCore.elementos = JSON.parse(backup);
                window.CADRenderer.dibujarEscena();
                console.log("🔄 Sesión recuperada del navegador");
            } catch(e) { console.error("Error recuperando sesión"); }
        }
    }
};

// --- INTEGRACIÓN CON EL MOTOR ---
// 1. Vinculamos el guardado manual
document.getElementById('btn-save')?.addEventListener('click', () => window.AppFiles.guardarProyecto());

// 2. Inyectamos el auto-guardado en el core de la aplicación
// Modificamos la función guardarEstado de AppCore para que también use LocalStorage
const originalGuardarEstado = window.AppCore.guardarEstado;
window.AppCore.guardarEstado = function() {
    originalGuardarEstado.apply(this);
    window.AppFiles.sincronizarLocalStorage();
};

// 3. Recuperar sesión al iniciar
window.addEventListener('load', () => window.AppFiles.recuperarSesion());
