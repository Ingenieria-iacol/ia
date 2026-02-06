/**
 * js/events.js
 * Orquestador de interacción con lógica de Snap (Adherencia)
 */
const svgElement = document.getElementById('lienzo-cad');
let mouseStartTime = 0;
let isMovingMouse = false;

svgElement.addEventListener('contextmenu', e => e.preventDefault());

svgElement.addEventListener('mousedown', (e) => {
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    mouseStartTime = Date.now();
    isMovingMouse = false;

    if (e.button === 0) {
        window.estado.isPanning = true;
    } else if (e.button === 2) {
        window.estado.isRotating = true;
    }
});

svgElement.addEventListener('mousemove', (e) => {
    isMovingMouse = true;
    const dx = e.clientX - window.estado.lastMouse.x;
    const dy = e.clientY - window.estado.lastMouse.y;

    if (window.estado.isPanning) {
        window.estado.view.x += dx;
        window.estado.view.y += dy;
        window.CADRenderer.actualizarTransformacion();
    } else if (window.estado.isRotating) {
        window.estado.view.angle += dx * 0.01;
        window.CADRenderer.dibujarEscena();
    }

    if (window.estado.drawing && window.estado.inicio) {
        actualizarGuiaVisual(e);
    }
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', (e) => {
    const duration = Date.now() - mouseStartTime;
    if (duration < 250 && !isMovingMouse && e.button === 0) {
        ejecutarAccionPrincipal(e);
    }
    window.estado.isPanning = false;
    window.estado.isRotating = false;
});

/**
 * Busca el punto de conexión más cercano (Snap)
 */
function buscarPuntoSnap(puntoMouse) {
    let mejorPunto = { ...puntoMouse, z: window.estado.currentZ };
    let distanciaMinima = 0.8; // Radio de snap en unidades de rejilla

    window.AppCore.elementos.forEach(el => {
        let puntosInteres = [];
        if (el.tipo === 'tuberia') {
            puntosInteres.push({ x: el.x, y: el.y, z: el.z });
            puntosInteres.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz });
        } else {
            puntosInteres.push({ x: el.x, y: el.y, z: el.z });
        }

        puntosInteres.forEach(p => {
            const d = Math.hypot(puntoMouse.x - p.x, puntoMouse.y - p.y);
            if (d < distanciaMinima) {
                distanciaMinima = d;
                mejorPunto = { x: p.x, y: p.y, z: p.z };
            }
        });
    });
    return mejorPunto;
}

function ejecutarAccionPrincipal(e) {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    
    // Aplicar Snap
    const puntoSnap = buscarPuntoSnap(puntoRaw);

    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(puntoSnap);
    } 
    else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
        window.AppCore.agregarElemento({
            tipo: 'equipo', 
            x: puntoSnap.x, 
            y: puntoSnap.y, 
            z: puntoSnap.z, // Hereda la altura del punto de snap
            idCatalogo: window.estado.activeItem.id,
            props: { 
                ...window.estado.activeItem.props, 
                name: window.estado.activeItem.name
            }
        });
        // Actualizar la Z global a la del elemento insertado para facilitar la continuidad
        window.estado.currentZ = puntoSnap.z;
        window.CADRenderer.actualizarTransformacion();
    } else {
        manejarSeleccion(xRaw, yRaw);
    }
}

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto };
        window.estado.currentZ = punto.z; // Ajustar Z a la del punto de inicio
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
            window.estado.inicio = { x: finX, y: finY, z: window.estado.inicio.z };
        }
        document.getElementById('ui-layer').innerHTML = '';
    }
}

function manejarSeleccion(clickX, clickY) {
    const encontrado = window.AppCore.elementos.find(el => {
        const pos = window.CADMath.isoToScreen(el.x, el.y, el.z);
        if (el.tipo === 'tuberia') {
            const final = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
            const dist = distToSegment({x: clickX, y: clickY}, pos, final);
            return dist < 10;
        }
        const dist = Math.hypot(pos.x - clickX, pos.y - clickY);
        return dist < 20;
    });

    if (encontrado) {
        window.AppCore.seleccion = [encontrado.id];
        window.PropsPanel.abrir(encontrado);
    } else {
        window.AppCore.seleccion = [];
        window.PropsPanel.cerrar();
    }
    window.CADRenderer.dibujarEscena();
}

function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

function actualizarGuiaVisual(e) {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    const puntoSnap = buscarPuntoSnap(puntoRaw);

    const uiLayer = document.getElementById('ui-layer');
    uiLayer.innerHTML = ''; 
    const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
    const ePos = window.CADMath.isoToScreen(puntoSnap.x, puntoSnap.y, puntoSnap.z);
    
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
    line.setAttribute("x2", ePos.x); line.setAttribute("y2", ePos.y);
    line.setAttribute("stroke", "rgba(255,255,255,0.5)"); line.setAttribute("stroke-dasharray", "4,4");
    uiLayer.appendChild(line);

    // Círculo indicador de Snap
    const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circ.setAttribute("cx", ePos.x); circ.setAttribute("cy", ePos.y);
    circ.setAttribute("r", "5"); circ.setAttribute("fill", "none"); circ.setAttribute("stroke", "#0071eb");
    uiLayer.appendChild(circ);
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
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
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L = parseFloat(prompt(`Longitud vertical (${key === 'q' ? 'subir' : 'bajar'}):`, "1.0"));
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

svgElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    window.estado.view.scale = Math.min(Math.max(window.estado.view.scale * factor, 0.1), 10);
    window.CADRenderer.actualizarTransformacion();
}, { passive: false });
