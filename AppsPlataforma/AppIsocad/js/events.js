/**
 * js/events.js
 * Orquestador de interacción: Rotación, Pan, Dibujo Técnico y Componentes
 */
const svgElement = document.getElementById('lienzo-cad');
let mouseStartTime = 0;
let isMovingMouse = false;

// Desactivar menú contextual para usar el botón derecho para rotar
svgElement.addEventListener('contextmenu', e => e.preventDefault());

svgElement.addEventListener('mousedown', (e) => {
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    mouseStartTime = Date.now();
    isMovingMouse = false;

    if (e.button === 0) { // Botón Izquierdo: Preparar Pan
        window.estado.isPanning = true;
    } else if (e.button === 2) { // Botón Derecho: Preparar Rotación
        window.estado.isRotating = true;
    }
});

svgElement.addEventListener('mousemove', (e) => {
    isMovingMouse = true;
    const dx = e.clientX - window.estado.lastMouse.x;
    const dy = e.clientY - window.estado.lastMouse.y;

    // 1. Lógica de Desplazamiento (Pan) con Click Izquierdo
    if (window.estado.isPanning) {
        window.estado.view.x += dx;
        window.estado.view.y += dy;
        window.CADRenderer.actualizarTransformacion();
    } 
    // 2. Lógica de Rotación Orbital con Click Derecho
    else if (window.estado.isRotating) {
        window.estado.view.angle += dx * 0.01;
        window.CADRenderer.dibujarEscena();
    }

    // 3. Línea Guía de Dibujo (Feedback visual)
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
        line.setAttribute("stroke", "rgba(255,255,255,0.5)"); 
        line.setAttribute("stroke-dasharray", "4,4");
        uiLayer.appendChild(line);
    }

    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', (e) => {
    const duration = Date.now() - mouseStartTime;
    
    // Si fue un clic corto y no hubo mucho arrastre, ejecutar acción de dibujo/selección
    if (duration < 250 && !isMovingMouse && e.button === 0) {
        ejecutarAccionPrincipal(e);
    }

    window.estado.isPanning = false;
    window.estado.isRotating = false;
});

function ejecutarAccionPrincipal(e) {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    const puntoIso = { x: Math.round(puntoRaw.x * 2) / 2, y: Math.round(puntoRaw.y * 2) / 2 };

    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(puntoIso);
    } else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
        window.AppCore.agregarElemento({
            tipo: 'equipo', x: puntoIso.x, y: puntoIso.y, z: window.estado.currentZ,
            props: { ...window.estado.activeItem.props, name: window.estado.activeItem.name, tipo: window.estado.activeItem.id }
        });
    } else {
        manejarSeleccion(xRaw, yRaw);
    }
}

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto, z: window.estado.currentZ };
    } else {
        let L = parseFloat(prompt("Longitud horizontal (m):", "1.0"));
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
                props: { longitudManual: L, diamNominal: '1/2"' }
            });
            window.estado.inicio = { x: finX, y: finY, z: window.estado.currentZ };
        }
        document.getElementById('ui-layer').innerHTML = '';
    }
}

function manejarSeleccion(clickX, clickY) {
    const encontrado = window.AppCore.elementos.find(el => {
        const pos = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
        return dist < 20;
    });

    if (encontrado) {
        window.AppCore.seleccion = [encontrado.id];
        window.PropsPanel.abrir(encontrado); //
    } else {
        window.AppCore.seleccion = [];
        window.PropsPanel.cerrar(); //
    }
    window.CADRenderer.dibujarEscena(); //
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // ESC: Deseleccionar y volver a puntero
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        window.estado.tool = 'select';
        window.estado.activeItem = null;
        window.AppCore.seleccion = [];
        document.getElementById('ui-layer').innerHTML = '';
        window.PropsPanel.cerrar();
        document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
        document.getElementById('btn-tool-select')?.classList.add('active');
        window.CADRenderer.dibujarEscena();
    }

    // Q/A: Elevación vertical con longitud manual
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L = parseFloat(prompt(`Longitud vertical (${key === 'q' ? 'SUBIR' : 'BAJAR'}):`, "1.0"));
        if (!isNaN(L)) {
            const dz = (key === 'q') ? L : -L;
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: 0, dy: 0, dz: dz,
                props: { longitudManual: L, isVertical: true }
            });
            window.estado.currentZ += dz;
            window.estado.inicio.z = window.estado.currentZ;
            window.CADRenderer.dibujarEscena();
        }
    }
});

// Zoom con Rueda
svgElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    window.estado.view.scale = Math.min(Math.max(window.estado.view.scale * factor, 0.1), 10);
    window.CADRenderer.actualizarTransformacion();
}, { passive: false });
