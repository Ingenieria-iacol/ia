/**
 * js/events.js
 */
const svgElement = document.getElementById('lienzo-cad');

// Desactivar menú contextual para usar botón derecho
svgElement.addEventListener('contextmenu', e => e.preventDefault());

svgElement.addEventListener('mousedown', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    if (e.button === 0) { // Click Izquierdo
        const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
        const puntoIso = { x: Math.round(puntoRaw.x * 2) / 2, y: Math.round(puntoRaw.y * 2) / 2 };
        if (window.estado.tool === 'tool-pipe') manejarDibujoTuberia(puntoIso);
    } 
    else if (e.button === 2) { // Click Derecho: Rotación
        window.estado.isRotating = true;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

svgElement.addEventListener('mousemove', (e) => {
    if (window.estado.isRotating) {
        const dx = e.clientX - window.estado.lastMouse.x;
        window.estado.view.angle += dx * 0.01;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
        window.CADRenderer.dibujarEscena();
    }

    if (window.estado.drawing && window.estado.inicio) {
        // ... (Lógica de línea guía punteada se mantiene igual)
    }
});

window.addEventListener('mouseup', () => { window.estado.isRotating = false; });

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto, z: window.estado.currentZ };
    } else {
        let L = parseFloat(prompt("Longitud horizontal (metros):", "1.0"));
        if (!isNaN(L) && L > 0) {
            const dx_r = punto.x - window.estado.inicio.x;
            const dy_r = punto.y - window.estado.inicio.y;
            const dist = Math.sqrt(dx_r**2 + dy_r**2) || 1;
            
            const finX = window.estado.inicio.x + (dx_r / dist) * L;
            const finY = window.estado.inicio.y + (dy_r / dist) * L;

            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: finX - window.estado.inicio.x, dy: finY - window.estado.inicio.y, dz: 0,
                props: { longitudManual: L, customColor: "#FFD700" }
            });
            window.estado.inicio = { x: finX, y: finY, z: window.estado.currentZ };
        }
        document.getElementById('ui-layer').innerHTML = '';
    }
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L = parseFloat(prompt(`Longitud vertical (${key === 'q' ? 'SUBIR' : 'BAJAR'}):`, "1.0"));
        if (!isNaN(L)) {
            const dz = (key === 'q') ? L : -L;
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: 0, dy: 0, dz: dz,
                props: { longitudManual: L, customColor: "#00FF00" }
            });
            window.estado.currentZ += dz;
            window.estado.inicio.z = window.estado.currentZ;
            window.CADRenderer.dibujarEscena();
        }
    }
});
