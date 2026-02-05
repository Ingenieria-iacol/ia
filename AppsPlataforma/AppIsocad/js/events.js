/**
 * js/events.js
 * Manejo de mouse, teclado y lógica de herramientas
 */

const svg = document.getElementById('lienzo-cad');

// 1. GESTIÓN DE RATÓN (MOUSE)
svg.addEventListener('mousedown', e => {
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convertir clic de pantalla a coordenadas del mundo 3D
    // Restamos la posición de la cámara (pan) y dividimos por el zoom
    const worldX = (x - window.estado.view.x) / window.estado.view.scale;
    const worldY = (y - window.estado.view.y) / window.estado.view.scale;
    
    const puntoIso = window.CADMath.screenToIso(worldX, worldY);

    // Botón Izquierdo: Dibujar o Seleccionar
    if (e.button === 0) {
        handlePrincipalClick(puntoIso);
    }
    
    // Botón Derecho: Mover cámara (Pan)
    if (e.button === 2) {
        window.estado.isPanning = true;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

window.addEventListener('mousemove', e => {
    if (window.estado.isPanning) {
        const dx = e.clientX - window.estado.lastMouse.x;
        const dy = e.clientY - window.estado.lastMouse.y;
        
        window.estado.view.x += dx;
        window.estado.view.y += dy;
        
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
        window.CADRenderer.dibujarEscena();
    }
});

window.addEventListener('mouseup', () => {
    window.estado.isPanning = false;
});

// 2. LÓGICA DE HERRAMIENTAS
function handlePrincipalClick(punto) {
    const tool = window.estado.tool;

    if (tool === 'tool-pipe') {
        if (!window.estado.drawing) {
            // Primer clic: Iniciar tubería
            window.estado.drawing = true;
            window.estado.inicio = { ...punto, z: window.estado.currentZ };
            console.log("Inicio de tubería en:", window.estado.inicio);
        } else {
            // Segundo clic: Finalizar tubería
            const fin = { ...punto, z: window.estado.currentZ };
            
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x,
                y: window.estado.inicio.y,
                z: window.estado.inicio.z,
                dx: fin.x - window.estado.inicio.x,
                dy: fin.y - window.estado.inicio.y,
                dz: fin.z - window.estado.inicio.z,
                props: { material: 'acero', grosor: 3 }
            });
            
            window.estado.drawing = false;
        }
    }
}

// 3. ATAJOS DE TECLADO
window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        window.AppCore.seleccion = [];
        window.CADRenderer.dibujarEscena();
    }
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        window.AppCore.borrarSeleccion();
    }
});

// Desactivar menú contextual para usar el botón derecho para PAN
svg.addEventListener('contextmenu', e => e.preventDefault());
