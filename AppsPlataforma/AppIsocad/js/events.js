/**
 * js/events.js - VERSIÓN INTEGRAL: RESTAURACIÓN DE INTERFAZ Y SNAP DE INGENIERÍA
 */
const svgElement = document.getElementById('lienzo-cad');
let mouseStartTime = 0;
let isMovingMouse = false;
let puntoSnapActivo = null; 

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

    puntoSnapActivo = buscarPuntoSnap(e.clientX, e.clientY);
    actualizarGuiaVisual(e);
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mouseup', (e) => {
    const duration = Date.now() - mouseStartTime;
    // Si no hubo arrastre significativo y fue clic izquierdo, ejecutar acción
    if (duration < 250 && !isMovingMouse && e.button === 0) {
        ejecutarAccionPrincipal(puntoSnapActivo);
    }
    window.estado.isPanning = false;
    window.estado.isRotating = false;
});

function buscarPuntoSnap(mouseX, mouseY) {
    let mejorPunto = null;
    let distanciaMinima = 30; 
    const rect = svgElement.getBoundingClientRect();

    window.AppCore.elementos.forEach(el => {
        let nodos = [];
        if (el.tipo === 'tuberia') {
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id, esInicio: true });
            nodos.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz, padreId: el.id, esInicio: false });
        } else {
            // Radio real basado en catálogo (ej. 10cm -> 0.05m de radio)
            const radioFisico = (el.props.longitudReal || 0.1) / 2;
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id });
            const baseRot = ((el.props.rotacionAxial || 0) * Math.PI) / 180;
            for(let i=0; i<4; i++) {
                const ang = baseRot + (i * Math.PI / 2);
                nodos.push({ x: el.x + Math.cos(ang) * radioFisico, y: el.y + Math.sin(ang) * radioFisico, z: el.z, padreId: el.id, isPort: true });
            }
        }
        nodos.forEach(n => {
            const sPos = window.CADMath.isoToScreen(n.x, n.y, n.z);
            const rX = rect.left + window.estado.view.x + (sPos.x * window.estado.view.scale);
            const rY = rect.top + window.estado.view.y + (sPos.y * window.estado.view.scale);
            const d = Math.hypot(mouseX - rX, mouseY - rY);
            if (d < distanciaMinima) { distanciaMinima = d; mejorPunto = { ...n }; }
        });
    });

    if (mejorPunto) return mejorPunto;
    const xR = (mouseX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yR = (mouseY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const iso = window.CADMath.screenToIso(xR, yR);
    return { x: Math.round(iso.x * 2) / 2, y: Math.round(iso.y * 2) / 2, z: window.estado.currentZ };
}

function ejecutarAccionPrincipal(punto) {
    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(punto);
    } 
    else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
        const radioComp = (window.estado.activeItem.props.longitudReal || 0.1) / 2;
        let finalX = punto.x, finalY = punto.y;

        if (punto.padreId) {
            const elPadre = window.AppCore.elementos.find(e => e.id === punto.padreId);
            if (elPadre && elPadre.tipo === 'tuberia') {
                const distT = Math.hypot(elPadre.dx, elPadre.dy, elPadre.dz);
                const ux = elPadre.dx / (distT || 1), uy = elPadre.dy / (distT || 1);
                if (punto.esInicio) {
                    elPadre.x += ux * radioComp; elPadre.y += uy * radioComp;
                    elPadre.dx -= ux * radioComp; elPadre.dy -= uy * radioComp;
                } else {
                    elPadre.dx -= ux * radioComp; elPadre.dy -= uy * radioComp;
                }
            } else if (elPadre && punto.isPort) {
                finalX = punto.x + (punto.x - elPadre.x);
                finalY = punto.y + (punto.y - elPadre.y);
            }
        }
        window.AppCore.agregarElemento({
            tipo: window.estado.activeItem.type, 
            x: finalX, y: finalY, z: punto.z,
            idCatalogo: window.estado.activeItem.id,
            props: { ...window.estado.activeItem.props, name: window.estado.activeItem.name }
        });
        window.CADRenderer.dibujarEscena();
    } else {
        const rect = svgElement.getBoundingClientRect();
        const xRel = (window.estado.lastMouse.x - rect.left - window.estado.view.x) / window.estado.view.scale;
        const yRel = (window.estado.lastMouse.y - rect.top - window.estado.view.y) / window.estado.view.scale;
        manejarSeleccion(xRel, yRel);
    }
}

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true; window.estado.inicio = { ...punto };
    } else {
        let L = parseFloat(prompt("Longitud real (m):", "1.0"));
        if (!isNaN(L) && L > 0) {
            const dx = punto.x - window.estado.inicio.x, dy = punto.y - window.estado.inicio.y;
            const dt = Math.sqrt(dx**2 + dy**2) || 1;
            window.AppCore.agregarElemento({
                tipo: 'tuberia', x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: (dx/dt)*L, dy: (dy/dt)*L, dz: 0, props: { longitudManual: L, diamNominal: '1/2"' }
            });
            window.estado.inicio = { x: window.estado.inicio.x + (dx/dt)*L, y: window.estado.inicio.y + (dy/dt)*L, z: window.estado.inicio.z };
            window.CADRenderer.dibujarEscena();
        }
    }
}

function actualizarGuiaVisual(e) {
    const uiLayer = document.getElementById('ui-layer');
    if(!uiLayer || !puntoSnapActivo) return;
    uiLayer.innerHTML = ''; 
    const p = puntoSnapActivo;
    const pos = window.CADMath.isoToScreen(p.x, p.y, p.z);
    const size = 3.5;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const color = p.padreId ? (p.isPort ? "#00ff64" : "#0071eb") : "#666";
    const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l1.setAttribute("x1", pos.x-size); l1.setAttribute("y1", pos.y); l1.setAttribute("x2", pos.x+size); l1.setAttribute("y2", pos.y);
    l1.setAttribute("stroke", color); l1.setAttribute("stroke-width", "1");
    const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l2.setAttribute("x1", pos.x); l2.setAttribute("y1", pos.y-size); l2.setAttribute("x2", pos.x); l2.setAttribute("y2", pos.y+size);
    l2.setAttribute("stroke", color); l2.setAttribute("stroke-width", "1");
    g.appendChild(l1); g.appendChild(l2);
    uiLayer.appendChild(g);
}

function manejarSeleccion(cX, cY) {
    const el = window.AppCore.elementos.find(e => {
        const p = window.CADMath.isoToScreen(e.x, e.y, e.z);
        if (e.tipo === 'tuberia') {
            const f = window.CADMath.isoToScreen(e.x + e.dx, e.y + e.dy, e.z + e.dz);
            return distToSegment({x: cX, y: cY}, p, f) < 10;
        }
        return Math.hypot(p.x - cX, p.y - cY) < 20;
    });
    window.AppCore.seleccion = el ? [el.id] : [];
    if (el) window.PropsPanel.abrir(el); else window.PropsPanel.cerrar();
    window.CADRenderer.dibujarEscena();
}

function distToSegment(p, v, w) {
    const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
    if (l2 == 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.estado.drawing = false; window.estado.tool = 'select'; window.estado.activeItem = null;
        window.AppCore.seleccion = []; window.PropsPanel.cerrar();
        document.querySelectorAll('.tool-item').forEach(el => el.classList.remove('active'));
        document.getElementById('btn-tool-select')?.classList.add('active');
        window.CADRenderer.dibujarEscena();
    }
});

svgElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    window.estado.view.scale = Math.min(Math.max(window.estado.view.scale * factor, 0.1), 10);
    window.CADRenderer.actualizarTransformacion();
}, { passive: false });
