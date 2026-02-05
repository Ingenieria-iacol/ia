/**
 * js/core.js
 * Gestión del estado y base de datos del proyecto
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
        this.historial.push(JSON.stringify(this.elementos));
        if (this.historial.length > this.MAX_HISTORIAL) this.historial.shift();
        this.indiceHistorial = this.historial.length - 1;
        this.actualizarBotonesUI();
    },

    agregarElemento: function(datos) {
        const nuevo = {
            id: Date.now() + Math.random(),
            layerId: 'gas',
            visible: true,
            props: {},
            ...datos
        };
        this.elementos.push(nuevo);
        this.guardarEstado();
        if (window.CADRenderer) window.CADRenderer.dibujarEscena();
        return nuevo;
    },

    borrarSeleccion: function() {
        if (this.seleccion.length === 0) return;
        this.elementos = this.elementos.filter(el => !this.seleccion.includes(el.id));
        this.seleccion = [];
        this.guardarEstado();
        if (window.CADRenderer) window.CADRenderer.dibujarEscena();
    },

    actualizarBotonesUI: function() {
        const btnUndo = document.getElementById('btn-undo');
        if(btnUndo) btnUndo.disabled = (this.indiceHistorial <= 0);
    }
};

// Estado inicial garantizado
window.estado = {
    tool: 'select',
    view: { x: 0, y: 0, scale: 1, angle: Math.PI / 6 },
    currentZ: 0,
    drawing: false,
    inicio: null,
    isPanning: false,
    lastMouse: { x: 0, y: 0 },
    activeItem: null
};
