/**
 * js/events.js - VERSIÓN: PRESIÓN QUIRÚRGICA 0.01m
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
    const distAcople = 0.01; // Tu solicitud: Contacto a tope

    window.AppCore.elementos.forEach(el => {
        let nodos = [];
        if (el.tipo === 'tuberia') {
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id, esInicio: true });
            nodos.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz, padreId: el.id, esInicio: false });
        } else {
            // Nodo Central
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id });
            
            // --- CORRECCIÓN: PUERTOS ANCLADOS AL MUNDO (Sin View Angle) ---
            // Los ángulos 0, 90, 180, 270 ahora son absolutos respecto al objeto
            const baseRot = ((el.props.rotacionAxial || 0) * Math.PI) / 180;
            
            for(let i=0; i<4; i++) {
                const angulo = baseRot + (i * Math.PI / 2);
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
        const distAcople = 0.01; 
        let finalX = punto.x;
        let finalY = punto.y;

        // Si insertamos sobre una tubería, la ajustamos para el contacto a tope
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

        // Si es un puerto de válvula, posicionar centro exactamente en el eje
        if (punto.isPort) {
            const elPadre = window.AppCore.elementos.find(e => e.id === punto.padreId);
            if(elPadre) {
                // Mantenemos la dirección longitudinal perfecta
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
        // --- MARCADOR: CRUZ (+) ULTRA PEQUEÑA Y TÉCNICA ---
        const size = 3.5; 
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const color = p.isPort ? "#00ff64" : "#0071eb";
        
        const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l1.setAttribute("x1", pos.x - size); l1.setAttribute("y1", pos.y);
        l1.setAttribute("x2", pos.x + size); l1.setAttribute("y2", pos.y);
        l1.setAttribute("stroke", color); l1.setAttribute("stroke-width", "1");
        
        const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l2.setAttribute("x1", pos.x); l2.setAttribute("y1", pos.y - size);
        l2.setAttribute("x2", pos.x); l2.setAttribute("y2", pos.y + size);
        l2.setAttribute("stroke", color); l2.setAttribute("stroke-width", "1");
        
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
// ... resto de funciones de selección y teclado
