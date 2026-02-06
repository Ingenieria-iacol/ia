/**
 * js/events.js
 * Orquestador de interacción con Snap Proyectado (Pantalla a Iso)
 */
const svgElement = document.getElementById('lienzo-cad');
let mouseStartTime = 0;
let isMovingMouse = false;

svgElement.addEventListener('contextmenu', e => e.preventDefault());

svgElement.addEventListener('mousedown', (e) => {
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    mouseStartTime = Date.now();
    isMovingMouse = false;
    if (e.button === 0) window.estado.isPanning = true;
    else if (e.button === 2) window.estado.isRotating = true;
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

    // Actualizar siempre la guía visual para mostrar el Snap
    actualizarGuiaVisual(e);
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
 * Busca el punto de conexión más cercano basándose en la proximidad visual (pantalla)
 */
function buscarPuntoSnap(clickX, clickY) {
    let mejorPunto = null;
    let distanciaMinima = 30; // Píxeles de tolerancia en pantalla

    window.AppCore.elementos.forEach(el => {
        let puntos = [];
        if (el.tipo === 'tuberia') {
            puntos.push({ x: el.x, y: el.y, z: el.z });
            puntos.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz });
        } else {
            puntos.push({ x: el.x, y: el.y, z: el.z });
        }

        puntos.forEach(p => {
            // Convertir punto iso a coordenadas de pantalla actuales
            const screenPos = window.CADMath.isoToScreen(p.x, p.y, p.z);
            // Aplicar transformación de vista (pan/zoom)
            const tx = screenPos.x * window.estado.view.scale + window.estado.view.x;
            const ty = screenPos.y * window.estado.view.scale + window.estado.view.y;
            
            const d = Math.hypot(clickX - tx, clickY - ty);
            if (d < distanciaMinima) {
                distanciaMinima = d;
                mejorPunto = { x: p.x, y: p.y, z: p.z };
            }
        });
    });

    if (mejorPunto) return mejorPunto;

    // Si no hay snap, devolver posición del cursor proyectada al plano Z actual
    const rect = svgElement.getBoundingClientRect();
    const xRel = (clickX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRel = (clickY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const isoPos = window.CADMath.screenToIso(xRel, yRel);
    return { x: Math.round(isoPos.x * 2) / 2, y: Math.round(isoPos.y * 2) / 2, z: window.estado.currentZ };
}

function ejecutarAccionPrincipal(e) {
    const puntoSnap = buscarPuntoSnap(e.clientX, e.clientY);

    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(puntoSnap);
    } 
    else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
        window.AppCore.agregarElemento({
            tipo: 'equipo', 
            x: puntoSnap.x, y: puntoSnap.y, z: puntoSnap.z,
            idCatalogo: window.estado.activeItem.id,
            props: { ...window.estado.activeItem.props, name: window.estado.activeItem.name }
        });
        window.estado.currentZ = puntoSnap.z;
    } else {
        // Para selección usamos las coordenadas relativas normales
        const rect = svgElement.getBoundingClientRect();
        const xRel = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
        const yRel = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
        manejarSeleccion(xRel, yRel);
    }
}

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto };
        window.estado.currentZ = punto.z;
    } else {
        let L = parseFloat(prompt("Longitud horizontal (m):", "1.0"));
        if (!isNaN(L) && L > 0) {
            // Dirección basada en el mouse pero longitud fija
            const dx_r = punto.x - window.estado.inicio.x;
            const dy_r = punto.y - window.estado.inicio.y;
            const d_total = Math.sqrt(dx_r**2 + dy_r**2) || 1;

            const finX = window.estado.inicio.x + (dx_r / d_total) * L;
            const finY = window.estado.inicio.y + (dy_r / d_total) * L;

            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: finX - window.estado.inicio.x, dy: finY - window.estado.inicio.y, dz: 0,
                props: { longitudManual: L, diamNominal: '1/2"' }
            });
            window.estado.inicio = { x: finX, y: finY, z: window.estado.inicio.z };
        }
    }
}

function actualizarGuiaVisual(e) {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;
    uiLayer.innerHTML = ''; 

    const puntoSnap = buscarPuntoSnap(e.clientX, e.clientY);
    const posScreen = window.CADMath.isoToScreen(puntoSnap.x, puntoSnap.y, puntoSnap.z);

    // Dibujar Círculo de Snap
    const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circ.setAttribute("cx", posScreen.x); circ.setAttribute("cy", posScreen.y);
    circ.setAttribute("r", "6");
    circ.setAttribute("fill", "none");
    circ.setAttribute("stroke", "#0071eb");
    circ.setAttribute("stroke-width", "2");
    uiLayer.appendChild(circ);

    // Si estamos dibujando tubería, mostrar línea elástica
    if (window.estado.drawing && window.estado.inicio) {
        const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", posScreen.x); line.setAttribute("y2", posScreen.y);
        line.setAttribute("stroke", "white");
        line.setAttribute("stroke-dasharray", "4,4");
        uiLayer.appendChild(line);
    }
}

function manejarSeleccion(clickX, clickY) {
    const encontrado = window.AppCore.elementos.find(el => {
        const pos = window.CADMath.isoToScreen(el.x, el.y, el.z);
        if (el.tipo === 'tuberia') {
            const final = window.CADMath.isoToScreen(el.x + el.dx, el.y + el.dy, el.z + el.dz);
            return distToSegment({x: clickX, y: clickY}, pos, final) < 10;
        }
        return Math.hypot(pos.x - clickX, pos.y - clickY) < 20;
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
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        document.getElementById('ui-layer').innerHTML = '';
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
