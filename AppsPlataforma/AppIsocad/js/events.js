/**
 * js/events.js
 * Orquestador de las interacciones del usuario
 */

const svgElement = document.getElementById('lienzo-cad');

// --- 1. GESTIÓN DE RATÓN (MOUSE) ---

svgElement.addEventListener('mousedown', (e) => {
    const rect = svgElement.getBoundingClientRect();
    
    // 1.1. Coordenadas de pantalla a mundo (tomando en cuenta Zoom y Pan)
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    // 1.2. Coordenadas de mundo a plano isométrico (Z=0)
    const puntoIso = window.CADMath.screenToIso(xRaw, yRaw);

    // BOTÓN IZQUIERDO: Acción de herramienta
    if (e.button === 0) {
        ejecutarAccionHerramienta(puntoIso);
    }

    // BOTÓN DERECHO: Iniciar movimiento de cámara (Pan)
    if (e.button === 2) {
        window.estado.isPanning = true;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

svgElement.addEventListener('mousemove', (e) => {
    // Lógica de Pan (Mover cámara)
    if (window.estado.isPanning) {
        const dx = e.clientX - window.estado.lastMouse.x;
        const dy = e.clientY - window.estado.lastMouse.y;
        
        window.estado.view.x += dx;
        window.estado.view.y += dy;
        
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
        window.CADRenderer.actualizarTransformacion();
    }
});

window.addEventListener('mouseup', () => {
    window.estado.isPanning = false;
});

// Lógica de Zoom con la rueda del ratón
svgElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    window.estado.view.scale *= zoomFactor;
    
    // Limitar zoom
    window.estado.view.scale = Math.min(Math.max(window.estado.view.scale, 0.2), 10);
    
    window.CADRenderer.actualizarTransformacion();
}, { passive: false });

// --- 2. LÓGICA DE DIBUJO ---

function ejecutarAccionHerramienta(punto) {
    const tool = window.estado.tool;

    if (tool === 'tool-pipe') {
        if (!window.estado.drawing) {
            // Primer punto
            window.estado.drawing = true;
            window.estado.inicio = { ...punto, z: window.estado.currentZ };
        } else {
            // Segundo punto: Crear tubería en el Cerebro
            const fin = { ...punto, z: window.estado.currentZ };
            
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x,
                y: window.estado.inicio.y,
                z: window.estado.inicio.z,
                dx: fin.x - window.estado.inicio.x,
                dy: fin.y - window.estado.inicio.y,
                dz: fin.z - window.estado.inicio.z,
                props: { 
                    material: window.estado.activeItem?.props.material || 'acero_sch40',
                    diamNominal: window.estado.activeItem?.props.diametroNominal || '1/2"',
                    grosor: 3 
                }
            });
            
            window.estado.drawing = false;
        }
    }
}

// --- 3. ATAJOS DE TECLADO ---

window.addEventListener('keydown', (e) => {
    // ESC para cancelar dibujo o limpiar selección
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        window.AppCore.seleccion = [];
        window.PropsPanel.cerrar();
        window.CADRenderer.dibujarEscena();
    }
});

// Desactivar menú contextual para usar botón derecho libremente
svgElement.addEventListener('contextmenu', e => e.preventDefault());
