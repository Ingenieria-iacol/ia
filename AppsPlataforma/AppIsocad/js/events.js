/**
 * js/events.js
 */
const svgElement = document.getElementById('lienzo-cad');

svgElement.addEventListener('mousedown', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    if (e.button === 0) { // Click Izquierdo: Dibujo/Selección
        const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
        const puntoIso = { x: Math.round(puntoRaw.x * 2) / 2, y: Math.round(puntoRaw.y * 2) / 2 };
        if (window.estado.tool === 'tool-pipe') manejarDibujoTuberia(puntoIso);
        else manejarSeleccion(xRaw, yRaw);
    } 
    else if (e.button === 2) { // Click Derecho: Rotación
        window.estado.isRotating = true;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

svgElement.addEventListener('mousemove', (e) => {
    // Lógica de Rotación
    if (window.estado.isRotating) {
        const dx = e.clientX - window.estado.lastMouse.x;
        window.estado.view.angle += dx * 0.01; // Sensibilidad de rotación
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
        window.CADRenderer.dibujarEscena();
    }

    // Feedback visual de línea guía
    if (window.estado.drawing && window.estado.inicio) {
        const rect = svgElement.getBoundingClientRect();
        const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
        const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
        const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
        
        const uiLayer = document.getElementById('ui-layer');
        uiLayer.innerHTML = ''; 
        const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        const ePos = window.CADMath.isoToScreen(Math.round(puntoRaw.x * 2) / 2, Math.round(puntoRaw.y * 2) / 2, window.estado.currentZ);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", ePos.x); line.setAttribute("y2", ePos.y);
        line.setAttribute("stroke", "white"); line.setAttribute("stroke-dasharray", "4,4");
        uiLayer.appendChild(line);
    }
});

window.addEventListener('mouseup', () => { window.estado.isRotating = false; });

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto, z: window.estado.currentZ };
    } else {
        let L_input = prompt("Longitud horizontal (m):", "1.0");
        let L = parseFloat(L_input);
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
                props: { L: L, diam: '1/2"' }
            });
            window.estado.inicio = { x: finX, y: finY, z: window.estado.currentZ };
        }
        document.getElementById('ui-layer').innerHTML = '';
    }
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L_input = prompt(`Longitud vertical (${key === 'q' ? 'subir' : 'bajar'}):`, "1.0");
        let L = parseFloat(L_input);
        if (!isNaN(L)) {
            const dz = (key === 'q') ? L : -L;
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: 0, dy: 0, dz: dz,
                props: { L: L, diam: '1/2"', isVertical: true }
            });
            window.estado.currentZ += dz;
            window.estado.inicio.z = window.estado.currentZ;
            window.CADRenderer.dibujarEscena();
        }
    }
});
