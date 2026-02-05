/**
 * js/events.js
 */
const svgElement = document.getElementById('lienzo-cad');

svgElement.addEventListener('mousedown', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    const puntoIso = { x: Math.round(puntoRaw.x * 2) / 2, y: Math.round(puntoRaw.y * 2) / 2 };

    if (e.button === 0) { // Click Izquierdo
        if (window.estado.tool === 'tool-pipe') {
            manejarDibujoTuberia(puntoIso);
        } else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
            // INSERCIÓN DE COMPONENTES (Válvulas, Medidores, etc.)
            window.AppCore.agregarElemento({
                tipo: 'equipo',
                x: puntoIso.x, y: puntoIso.y, z: window.estado.currentZ,
                idCatalogo: window.estado.activeItem.id,
                props: { ...window.estado.activeItem.props, name: window.estado.activeItem.name }
            });
        } else {
            manejarSeleccion(xRaw, yRaw);
        }
    } else if (e.button === 2) {
        window.estado.isRotating = true;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

// Función de Selección Mejorada con Apertura de Panel
function manejarSeleccion(clickX, clickY) {
    const encontrado = window.AppCore.elementos.find(el => {
        const pos = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
        return dist < 20;
    });

    if (encontrado) {
        window.AppCore.seleccion = [encontrado.id];
        window.PropsPanel.abrir(encontrado); // Abre el panel de propiedades
    } else {
        window.AppCore.seleccion = [];
        window.PropsPanel.cerrar();
    }
    window.CADRenderer.dibujarEscena();
}

// Lógica de Tecla ESC
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        window.estado.tool = 'select'; // Volver al puntero
        window.estado.activeItem = null;
        window.AppCore.seleccion = [];
        document.getElementById('ui-layer').innerHTML = '';
        window.PropsPanel.cerrar();
        
        // UI: Quitar clase activa de botones de herramientas
        document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
        document.getElementById('btn-tool-select')?.classList.add('active');
        
        window.CADRenderer.dibujarEscena();
    }
    // ... (Q/A y Flechas se mantienen igual)
});

// Resto de eventos (mousemove, mouseup, wheel) se mantienen de la versión anterior...
