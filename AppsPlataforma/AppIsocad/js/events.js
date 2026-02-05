/**
 * js/events.js
 * Interacción con ingreso de longitud manual (Ingeniería)
 */
const svgElement = document.getElementById('lienzo-cad');

// --- GESTIÓN DE RATÓN ---
svgElement.addEventListener('mousedown', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    const puntoIso = {
        x: Math.round(puntoRaw.x * 2) / 2,
        y: Math.round(puntoRaw.y * 2) / 2
    };

    if (e.button === 0) {
        if (window.estado.tool === 'tool-pipe') {
            manejarDibujoTuberia(puntoIso);
        } else {
            manejarSeleccion(xRaw, yRaw);
        }
    }
    if (e.button === 2) {
        window.estado.isPanning = true;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    }
});

svgElement.addEventListener('mousemove', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    if (window.estado.drawing && window.estado.inicio) {
        const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
        const uiLayer = document.getElementById('ui-layer');
        uiLayer.innerHTML = ''; 
        const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        const ePos = window.CADMath.isoToScreen(Math.round(puntoRaw.x * 2) / 2, Math.round(puntoRaw.y * 2) / 2, window.estado.currentZ);
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", ePos.x); line.setAttribute("y2", ePos.y);
        line.setAttribute("stroke", "white"); line.setAttribute("stroke-dasharray", "5,5");
        uiLayer.appendChild(line);
    }

    if (window.estado.isPanning) {
        const dx = e.clientX - window.estado.lastMouse.x;
        const dy = e.clientY - window.estado.lastMouse.y;
        window.estado.view.x += dx; window.estado.view.y += dy;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
        window.CADRenderer.actualizarTransformacion();
    }
});

window.addEventListener('mouseup', () => window.estado.isPanning = false);

// --- LÓGICA DE DIBUJO CON LONGITUD ---
function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto, z: window.estado.currentZ };
    } else {
        // Solicitar longitud para tramo horizontal
        let L_input = prompt("Ingrese longitud del tramo (metros):", "1.0");
        let L = parseFloat(L_input);
        
        if (!isNaN(L) && L > 0) {
            // Calcular dirección del vector
            const dx_raw = punto.x - window.estado.inicio.x;
            const dy_raw = punto.y - window.estado.inicio.y;
            const dist_plano = Math.sqrt(dx_raw**2 + dy_raw**2) || 1;
            
            // Ajustar punto final según longitud ingresada
            const finX = window.estado.inicio.x + (dx_raw / dist_plano) * L;
            const finY = window.estado.inicio.y + (dy_raw / dist_plano) * L;

            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: finX - window.estado.inicio.x, dy: finY - window.estado.inicio.y, dz: 0,
                props: { material: 'acero_sch40', diamNominal: '1/2"' }
            });
            
            // Encadenar dibujo: el fin de esta es el inicio de la siguiente
            window.estado.inicio = { x: finX, y: finY, z: window.estado.currentZ };
        } else {
            window.estado.drawing = false;
        }
        document.getElementById('ui-layer').innerHTML = '';
    }
}

// --- COMANDOS DE TECLADO (Q/A) ---
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L_input = prompt(`Ingrese longitud para ${key === 'q' ? 'SUBIR' : 'BAJAR'} (metros):`, "1.0");
        let L = parseFloat(L_input);
        
        if (!isNaN(L) && L > 0) {
            const dz = (key === 'q') ? L : -L;
            const nuevoZ = window.estado.currentZ + dz;

            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: 0, dy: 0, dz: dz,
                props: { material: 'acero_sch40', diamNominal: '1/2"', customColor: '#00ff00' }
            });

            window.estado.currentZ = nuevoZ;
            window.estado.inicio.z = nuevoZ;
            document.getElementById('hud-z').innerText = window.estado.currentZ.toFixed(2);
            window.CADRenderer.dibujarEscena();
        }
    }

    if (e.key === 'ArrowLeft') { window.estado.view.angle -= 0.1; window.CADRenderer.dibujarEscena(); }
    if (e.key === 'ArrowRight') { window.estado.view.angle += 0.1; window.CADRenderer.dibujarEscena(); }
    if (e.key === 'Escape') { window.estado.drawing = false; document.getElementById('ui-layer').innerHTML = ''; }
});
