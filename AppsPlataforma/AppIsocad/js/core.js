/**
 * js/core.js
 * Gestión del estado, historial y base de datos del proyecto
 */

window.AppCore = {
    // 1. BASE DE DATOS EN MEMORIA
    elementos: [], // Aquí se guardan todas las tuberías y equipos
    seleccion: [], // IDs de los elementos seleccionados actualmente
    
    // 2. SISTEMA DE HISTORIAL (Undo/Redo)
    historial: [],
    indiceHistorial: -1,
    MAX_HISTORIAL: 50,

    /**
     * Guarda una "foto" del estado actual para poder deshacer después
     */
    guardarEstado: function() {
        // Si el usuario hizo cambios después de un "Deshacer", borramos la rama vieja
        if (this.indiceHistorial < this.historial.length - 1) {
            this.historial = this.historial.slice(0, this.indiceHistorial + 1);
        }
        
        // Guardamos una copia profunda (string) para que no se altere sola
        this.historial.push(JSON.stringify(this.elementos));
        
        if (this.historial.length > this.MAX_HISTORIAL) this.historial.shift();
        this.indiceHistorial = this.historial.length - 1;
        
        this.actualizarBotonesUI();
    },

    /**
     * Agrega un nuevo elemento (Tubería, Válvula, etc.)
     */
    agregarElemento: function(datos) {
        const nuevo = {
            id: Date.now() + Math.random(), // ID único
            layerId: window.activeLayerId || 'gas',
            visible: true,
            props: {},
            ...datos
        };
        
        this.elementos.push(nuevo);
        this.guardarEstado();
        
        // Avisar al renderizador que debe dibujar de nuevo
        if (window.CADRenderer) window.CADRenderer.dibujarEscena();
    },

    /**
     * Borra los elementos seleccionados
     */
    borrarSeleccion: function() {
        if (this.seleccion.length === 0) return;
        
        this.elementos = this.elementos.filter(el => !this.seleccion.includes(el.id));
        this.seleccion = [];
        
        this.guardarEstado();
        if (window.CADRenderer) window.CADRenderer.dibujarEscena();
        if (window.PropsPanel) window.PropsPanel.cerrar();
    },

    /**
     * Lógica de Deshacer (Undo)
     */
    deshacer: function() {
        if (this.indiceHistorial > 0) {
            this.indiceHistorial--;
            this.elementos = JSON.parse(this.historial[this.indiceHistorial]);
            this.seleccion = [];
            if (window.CADRenderer) window.CADRenderer.dibujarEscena();
        }
    },

    actualizarBotonesUI: function() {
        // Esta función activará/desactivará los botones ↩ y ↪ en el index.html
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        if(btnUndo) btnUndo.disabled = (this.indiceHistorial <= 0);
        if(btnRedo) btnRedo.disabled = (this.indiceHistorial >= this.historial.length - 1);
    }
};

// Inicializamos el estado base (Estado Global)
window.estado = {
    tool: 'select',
    view: { x: 0, y: 0, scale: 1, angle: Math.PI / 4 },
    mouseIso: { x: 0, y: 0 },
    currentZ: 0,
    drawing: false,
    inicio: null
};
