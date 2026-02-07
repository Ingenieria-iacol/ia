/**
 * js/events.js - VERSIÓN CORREGIDA PARA ACOPLAMIENTOS
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

// Localiza esta función en js/events.js y reemplázala con esta versión mejorada
function buscarPuntoSnap(mouseX, mouseY) {
    let mejorPunto = null;
    let distanciaMinima = 40; 
    const rect = svgElement.getBoundingClientRect();

    window.AppCore.elementos.forEach(el => {
        let nodos = [];
        if (el.tipo === 'tuberia') {
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id });
            nodos.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz, padreId: el.id });
        } else {
            // PUNTO CENTRAL (Existente)
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id });
            
            // NUEVO: PUNTOS DE ACOPLAMIENTO PARA VÁLVULAS Y EQUIPOS
            // Calculamos los extremos basados en la rotación axial (0° horizontal, 90° vertical en ISO)
            const offset = 0.5; // Distancia del centro al extremo en unidades de mundo
            const rot = (el.props.rotacionAxial || 0) * (Math.PI / 180);
            
            // Extremo A (Entrada)
            nodos.push({ 
                x: el.x - Math.cos(rot) * offset, 
                y: el.y - Math.sin(rot) * offset, 
                z: el.z, 
                padreId: el.id,
                isPort: true 
            });
            // Extremo B (Salida)
            nodos.push({ 
                x: el.x + Math.cos(rot) * offset, 
                y: el.y + Math.sin(rot) * offset, 
                z: el.z, 
                padreId: el.id,
                isPort: true 
            });
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

    // Si no hay snap a objeto, snap a grilla (Existente)
    const xRel = (mouseX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRel = (mouseY - rect.top - window.estado.view.y) / window.estado.view.scale;
    const isoPos = window.CADMath.screenToIso(xRel, yRel);
    return { 
        x: Math.round(isoPos.x * 2) / 2, 
        y: Math.round(isoPos.y * 2) / 2, 
        z: window.estado.currentZ 
    };
}

function ejecutarAccionPrincipal(punto) {
    if (window.estado.tool === 'tool-pipe') {
        manejarDibujoTuberia(punto);
    } 
  // Localiza el bloque 'tool-insert' dentro de ejecutarAccionPrincipal en js/events.js
else if (window.estado.tool === 'tool-insert' && window.estado.activeItem) {
    let posX = punto.x;
    let posY = punto.y;

    // Si estamos haciendo snap a un punto que NO es el centro de otro objeto, 
    // desplazamos el centro de la nueva válvula para que su extremo toque el punto.
    if (punto.padreId && window.estado.activeItem.type === 'valvula') {
        const offset = 0.5; 
        const rot = (window.estado.activeItem.props.rotacionAxial || 0) * (Math.PI / 180);
        // Empujamos el centro media unidad para que el borde quede en el snap
        posX += Math.cos(rot) * offset;
        posY += Math.sin(rot) * offset;
    }

    window.AppCore.agregarElemento({
        tipo: window.estado.activeItem.type, 
        x: posX, y: posY, z: punto.z,
        idCatalogo: window.estado.activeItem.id,
        props: { ...window.estado.activeItem.props, name: window.estado.activeItem.name }
    });
    window.estado.currentZ = punto.z;
}
        
        if (punto.padreId) {
            const elPadre = window.AppCore.elementos.find(e => e.id === punto.padreId);
            if (elPadre && elPadre.tipo === 'tuberia') {
                const distTotal = Math.hypot(elPadre.dx, elPadre.dy, elPadre.dz);
                if (distTotal > offset) {
                    const ux = elPadre.dx / distTotal;
                    const uy = elPadre.dy / distTotal;
                    const uz = elPadre.dz / distTotal;

                    if (punto.esInicio) {
                        elPadre.x += ux * offset;
                        elPadre.y += uy * offset;
                        elPadre.z += uz * offset;
                        elPadre.dx -= ux * offset;
                        elPadre.dy -= uy * offset;
                        elPadre.dz -= uz * offset;
                    } else {
                        elPadre.dx -= ux * offset;
                        elPadre.dy -= uy * offset;
                        elPadre.dz -= uz * offset;
                    }
                }
            }
        }

        window.AppCore.agregarElemento({
            tipo: 'equipo', 
            x: punto.x, y: punto.y, z: punto.z,
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
        window.estado.currentZ = punto.z;
    } else {
        let L = parseFloat(prompt("Longitud horizontal (m):", "1.0"));
        if (!isNaN(L) && L > 0) {
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
    if(!uiLayer) return;
    uiLayer.innerHTML = ''; 

    const p = puntoSnapActivo;
    const posScreen = window.CADMath.isoToScreen(p.x, p.y, p.z);

    const circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circ.setAttribute("cx", posScreen.x); circ.setAttribute("cy", posScreen.y);
    circ.setAttribute("r", p.padreId ? (p.isPort ? "7" : "10") : "5"); 
    circ.setAttribute("fill", p.isPort ? "rgba(0, 255, 100, 0.3)" : (p.padreId ? "rgba(0, 113, 235, 0.2)" : "none"));
    circ.setAttribute("stroke", p.isPort ? "#00ff64" : "#0071eb");
    circ.setAttribute("stroke-width", "2");
    uiLayer.appendChild(circ);

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
