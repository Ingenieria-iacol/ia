/**
 * js/events.js - VERSIÓN: 4 PUNTOS DE ACOPLE (CRUCES)
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
    const distAcople = 0.25; 

    window.AppCore.elementos.forEach(el => {
        let nodos = [];
        if (el.tipo === 'tuberia') {
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id, esInicio: true });
            nodos.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz, padreId: el.id, esInicio: false });
        } else {
            // Nodo Central
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id });
            
            // --- NUEVA LÓGICA: 4 PUNTOS CARDINALES (CRUCES) ---
            // Esto asegura que siempre haya un punto alineado con la tubería
            const baseRot = ((el.props.rotacionAxial || 0) * Math.PI) / 180 + window.estado.view.angle;
            
            for(let i=0; i<4; i++) {
                const angulo = baseRot + (i * Math.PI / 2); // 0, 90, 180, 270 grados
                nodos.push({ 
                    x: el.x + Math.cos(angulo) * distAcople, 
                    y: el.y + Math.sin(angulo) * distAcople, 
                    z: el.z, 
                    padreId: el.id, 
                    isPort: true 
                });
            }
        }

        nodos.forEach(n => {
            const screenPos = window.CADMath.isoToScreen(n.x, n.y, n.z);
            const realX = rect.left + window.estado.view.x + (screenPos.x * window.estado.view.scale);
            const realY = rect.top + window.estado.view.y + (screenPos.y * window.estado.view.scale);
            const dist = Math.hypot(mouseX - realX, mouseY - realY);
            if (dist < distanciaMinima) {
                distanciaMinima = dist;
                mejorPunto = { ...n, screenX: screenPos.x, screenY: screenPos.y };
            }
        });
    });

    if (mejorPunto) return mejorPunto;
    const xRel = (mouseX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRel = (mouseY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const isoPos = window.CADMath.screenToIso(xRel, yRel);
    return { x: Math.round(isoPos.x * 2) / 2, y: Math.round(isoPos.y * 2) / 2, z: window.estado.currentZ };
}

function ejecutarAccionPrincipal(punto) {
    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(punto);
    } 
    else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
        const distAcople = 0.25; 
        let finalX = punto.x;
        let finalY = punto.y;

        // Acortar tubería si se inserta en un extremo
        if (punto.padreId) {
            const elPadre = window.AppCore.elementos.find(e => e.id === punto.padreId);
            if (elPadre && elPadre.tipo === 'tuberia') {
                const distT = Math.hypot(elPadre.dx, elPadre.dy, elPadre.dz);
                if (distT > distAcople) {
                    const ux = elPadre.dx / (distT || 1);
                    const uy = elPadre.dy / (distT || 1);
                    const uz = elPadre.dz / (distT || 1);
                    if (punto.esInicio) {
                        elPadre.x += ux * distAcople; elPadre.y += uy * distAcople; elPadre.z += uz * distAcople;
                        elPadre.dx -= ux * distAcople; elPadre.dy -= uy * distAcople; elPadre.dz -= uz * distAcople;
                    } else {
                        elPadre.dx -= ux * distAcople; elPadre.dy -= uy * distAcople; elPadre.dz -= uz * distAcople;
                    }
                }
            }
        }

        // Si es un puerto de válvula, posicionar centro para que se toquen
        if (punto.isPort) {
            // El desplazamiento ahora debe ser inverso al ángulo del puerto para centrar el objeto
            // Simplificamos: el punto de snap 'isPort' ya está en la posición ideal para el borde.
            // Para que el objeto no se desalinee, calculamos el vector desde el puerto al centro del objeto padre
            const elPadre = window.AppCore.elementos.find(e => e.id === punto.padreId);
            if(elPadre) {
                const dx = punto.x - elPadre.x;
                const dy = punto.y - elPadre.y;
                finalX = punto.x + dx; 
                finalY = punto.y + dy;
            }
        }

        window.AppCore.agregarElemento({
            tipo: window.estado.activeItem.type, 
            x: finalX, y: finalY, z: punto.z,
            idCatalogo: window.estado.activeItem.id,
            props: { ...window.estado.activeItem.props, name: window.estado.activeItem.name }
        });
        window.estado.currentZ = punto.z;
    } else {
        const rect = svgElement.getBoundingClientRect();
        const xRel = (window.estado.lastMouse.x - rect.left - window.estado.view.x) / window.estado.view.scale;
        const yRel = (window.estado.lastMouse.y - rect.top - window.estado.view.y) / window.estado.view.scale;
        manejarSeleccion(xRel, yRel);
    }
}

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto };
    } else {
        let L = parseFloat(prompt("Longitud (m):", "1.0"));
        if (!isNaN(L) && L > 0) {
            const dx_r = punto.x - window.estado.inicio.x;
            const dy_r = punto.y - window.estado.inicio.y;
            const d_t = Math.sqrt(dx_r**2 + dy_r**2) || 1;
            const fX = window.estado.inicio.x + (dx_r / d_t) * L;
            const fY = window.estado.inicio.y + (dy_r / d_t) * L;
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: fX - window.estado.inicio.x, dy: fY - window.estado.inicio.y, dz: 0,
                props: { longitudManual: L, diamNominal: '1/2"' }
            });
            window.estado.inicio = { x: fX, y: fY, z: window.estado.inicio.z };
        }
    }
}

function actualizarGuiaVisual(e) {
    const uiLayer = document.getElementById('ui-layer');
    if(!uiLayer || !puntoSnapActivo) return;
    uiLayer.innerHTML = ''; 

    const p = puntoSnapActivo;
    const pos = window.CADMath.isoToScreen(p.x, p.y, p.z);

    if (p.padreId) {
        const size = 4; // Cruz más pequeña como solicitaste
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const color = p.isPort ? "#00ff64" : "#0071eb";
        
        const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l1.setAttribute("x1", pos.x - size); l1.setAttribute("y1", pos.y);
        l1.setAttribute("x2", pos.x + size); l1.setAttribute("y2", pos.y);
        l1.setAttribute("stroke", color); l1.setAttribute("stroke-width", "1.5");
        
        const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l2.setAttribute("x1", pos.x); l2.setAttribute("y1", pos.y - size);
        l2.setAttribute("x2", pos.x); l2.setAttribute("y2", pos.y + size);
        l2.setAttribute("stroke", color); l2.setAttribute("stroke-width", "1.5");
        
        g.appendChild(l1); g.appendChild(l2);
        uiLayer.appendChild(g);
    } else {
        const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circ.setAttribute("cx", pos.x); circ.setAttribute("cy", pos.y);
        circ.setAttribute("r", "2"); circ.setAttribute("fill", "#666");
        uiLayer.appendChild(circ);
    }

    if (window.estado.drawing && window.estado.inicio) {
        const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", pos.x); line.setAttribute("y2", pos.y);
        line.setAttribute("stroke", "white"); line.setAttribute("stroke-dasharray", "4,4");
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
    window.AppCore.seleccion = encontrado ? [encontrado.id] : [];
    if (encontrado) window.PropsPanel.abrir(encontrado); else window.PropsPanel.cerrar();
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
        window.estado.tool = 'select';
        window.AppCore.seleccion = [];
        window.CADRenderer.dibujarEscena();
    }
    if ((key === 'q' || key === 'a') && window.estado.drawing) {
        let L = parseFloat(prompt("Longitud vertical:", "1.0"));
        if (!isNaN(L)) {
            const dz = (key === 'q') ? L : -L;
            window.AppCore.agregarElemento({
                tipo: 'tuberia',
                x: window.estado.inicio.x, y: window.estado.inicio.y, z: window.estado.inicio.z,
                dx: 0, dy: 0, dz: dz, props: { longitudManual: L, isVertical: true }
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
