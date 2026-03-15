/**
 * js/core.js - Gestión del estado y elementos
 */
window.AppCore = {
    elementos: [], 
    seleccion: [], 
    historial: [],
    indiceHistorial: -1,
    MAX_HISTORIAL: 50,

    guardarEstado: function() {
        if (this.indiceHistorial < this.historial.length - 1) {
            this.historial = this.historial.slice(0, this.indiceHistorial + 1);
        }
        // Guardamos una copia profunda del estado actual de los elementos
        this.historial.push(JSON.stringify(this.elementos));
        
        if (this.historial.length > this.MAX_HISTORIAL) {
            this.historial.shift();
        }
        this.indiceHistorial = this.historial.length - 1;
        this.actualizarBotonesUI();
    },

    /**
     * Agrega un nuevo elemento al lienzo.
     * @param {Object} datos - Debe contener tipo de objeto y puntos (p1, p2, etc.)
     */
    agregarElemento: function(datos) {
        const nuevo = {
            id: Date.now() + Math.random(),
            layerId: 'gas', // Capa por defecto
            visible: true,
            props: datos.props || {}, // Propiedades adicionales (color, grosor, etc.)
            ...datos // Aquí se expanden p1, p2 y el type que vienen del input
        };

        this.elementos.push(nuevo);
        
        // Persistencia en el historial para Undo/Redo
        this.guardarEstado();

        // Notificar al renderer para actualizar la pantalla
        if (window.CADRenderer) {
            window.CADRenderer.dibujarEscena();
        }

        return nuevo;
    },

    borrarSeleccion: function() {
        if (this.seleccion.length === 0) return;
        this.elementos = this.elementos.filter(el => !this.seleccion.includes(el.id));
        this.seleccion = [];
        this.guardarEstado();
        if (window.CADRenderer) window.CADRenderer.dibujarEscena();
        if (window.PropsPanel) window.PropsPanel.cerrar();
    },

    actualizarBotonesUI: function() {
        const btnUndo = document.getElementById('btn-undo');
        if(btnUndo) btnUndo.disabled = (this.indiceHistorial <= 0);
    }
};
