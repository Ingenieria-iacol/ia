/**
 * js/events.js
 * Orquestador de interacción: Rotación, Pan, Dibujo Técnico y Componentes
 */
const svgElement = document.getElementById('lienzo-cad');
let mouseStartTime = 0;
let isMovingMouse = false;

// Desactivar menú contextual para usar el botón derecho para rotar libremente
svgElement.addEventListener('contextmenu', e => e.preventDefault());

// --- 1. GESTIÓN DE RATÓN (Mousedown, Mousemove, Mouseup) ---

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

    // Lógica de Desplazamiento (Pan) con Click Izquierdo
    if (window.estado.isPanning) {
        window.estado.view.x += dx;
        window.estado.view.y += dy;
        window.CADRenderer.actualizarTransformacion();
    } 
    // Lógica de Rotación Orbital con Click Derecho
    else if (window.estado.isRotating) {
        window.estado.view.angle += dx * 0.01; // Sensibilidad de giro
        window.CADRenderer.dibujarEscena();
    }

    // Feedback visual de línea guía durante el dibujo
    if (window.estado.drawing && window.estado.inicio) {
        actualizarGuiaVisual(e);
    }

    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', (e) => {
    const duration = Date.now() - mouseStartTime;
    
    // Si fue un clic corto sin arrastre, es una acción de dibujo o selección
    if (duration < 250 && !isMovingMouse && e.button === 0) {
        ejecutarAccionPrincipal(e);
    }

    window.estado.isPanning = false;
    window.estado.isRotating = false;
});

// --- 2. LÓGICA DE ACCIONES (Dibujo, Inserción y Selección) ---

function ejecutarAccionPrincipal(e) {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    
    // Snap magnético cada 0.5 metros para precisión de ingeniería
    const puntoIso = { 
        x: Math.round(puntoRaw.x * 2) / 2, 
        y: Math.round(puntoRaw.y * 2) / 2 
    };

    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(puntoIso);
    } else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
        // Inserción de componentes del catálogo (Válvulas, Medidores, etc.)
        window.AppCore.agregarElemento({
            tipo: 'equipo', 
            x: puntoIso.x, 
            y: puntoIso.y, 
            z: window.estado.currentZ,
            idCatalogo: window.estado.activeItem.id,
            props: { 
                ...window.estado.activeItem.props, 
                name: window.estado.activeItem.name,
                tipo: window.estado.activeItem.id 
            }
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
        let L_input = prompt("Longitud horizontal (m):", "1.0");
        let L = parseFloat(L_input);
        
        if (!isNaN(L) && L > 0) {
            const dx_r = punto.x - window.estado.inicio.x;
            const dy_r = punto.y - window.estado.inicio.y;
            const dist = Math.sqrt(dx_r**2 + dy_r**2) || 1;
            
            // Ajuste simétrico del tramo según la longitud ingresada
            const finX = window.estado.inicio.x + (dx_r / dist) * L;
            const finY = window.estado.inicio.y + (dy_r / dist) * L;

            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: finX - window.estado.inicio.x, 
                dy: finY - window.estado.inicio.y, 
                dz: 0,
                props: { longitudManual: L, diamNominal: '1/2"' }
            });
            // El punto final se convierte en el nuevo inicio para dibujo continuo
            window.estado.inicio = { x: finX, y: finY, z: window.estado.currentZ };
        }
        document.getElementById('ui-layer').innerHTML = '';
    }
}

function manejarSeleccion(clickX, clickY) {
    const encontrado = window.AppCore.elementos.find(el => {
        const pos = window.CADMath.isoToScreen(el.x, el.y, el.z);
        const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
        return dist < 20; // Tolerancia de clic en píxeles
    });

    if (encontrado) {
        window.AppCore.seleccion = [encontrado.id];
        if (window.PropsPanel) window.PropsPanel.abrir(encontrado);
    } else {
        window.AppCore.seleccion = [];
        if (window.PropsPanel) window.PropsPanel.cerrar();
    }
    window.CADRenderer.dibujarEscena();
}

function actualizarGuiaVisual(e) {
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

// --- 3. ATAJOS DE TECLADO Y ZOOM ---

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    // ESC: Cancelar acción actual y volver a Selección
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        window.estado.tool = 'select';
        window.estado.activeItem = null;
        window.AppCore.seleccion = [];
        document.getElementById('ui-layer').innerHTML = '';
        if (window.PropsPanel) window.PropsPanel.cerrar();
        document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
        document.getElementById('btn-tool-select')?.classList.add('active');
        window.CADRenderer.dibujarEscena();
    }

    // Q (Subir) / A (Bajar): Tramos verticales con longitud manual
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L_input = prompt(`Longitud vertical para ${key === 'q' ? 'SUBIR' : 'BAJAR'} (m):`, "1.0");
        let L = parseFloat(L_input);
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

// Zoom con Rueda del Ratón
svgElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    window.estado.view.scale = Math.min(Math.max(window.estado.view.scale * factor, 0.1), 10);
    window.CADRenderer.actualizarTransformacion();
}, { passive: false });
