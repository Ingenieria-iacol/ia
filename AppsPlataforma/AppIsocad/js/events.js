/**
 * js/events.js - RESTAURACIÓN TOTAL QUIRÚRGICA CON SNAPS MEJORADOS + TAG MANAGER + ROTACIÓN
 */

/**
 * Lógica para arrastrar etiquetas
 */
window.TagManager = {
    draggingTagId: null,
    startOffset: { x: 0, y: 0 },

    startDrag: function(e, id) {
        e.stopPropagation();
        this.draggingTagId = id;
        const el = window.AppCore.elementos.find(x => x.id === id);
        this.startOffset = {
            x: e.clientX - (el.props.tagOffX || 0),
            y: e.clientY - (el.props.tagOffY || 0)
        };
        
        const moveHandler = (me) => {
            if (this.draggingTagId) {
                el.props.tagOffX = me.clientX - this.startOffset.x;
                el.props.tagOffY = me.clientY - this.startOffset.y;
                window.CADRenderer.dibujarEscena();
            }
        };

        const upHandler = () => {
            this.draggingTagId = null;
            window.AppCore.guardarEstado();
            window.removeEventListener('mousemove', moveHandler);
            window.removeEventListener('mouseup', upHandler);
        };

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
    },

    toggleVisibilidad: function() {
        window.CONFIG.showTags = !window.CONFIG.showTags;
        window.CADRenderer.dibujarEscena();
        const btn = document.getElementById('btn-toggle-tags');
        if(btn) btn.classList.toggle('active', window.CONFIG.showTags);
    }
};

const svgElement = document.getElementById('lienzo-cad');
let mouseStartTime = 0;
let isMovingMouse = false;
let puntoSnapActivo = null; 

// Prevenir menú contextual globalmente para permitir rotación con click derecho
window.addEventListener('contextmenu', e => e.preventDefault());

svgElement.addEventListener('mousedown', (e) => {
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
    // Guardamos posición inicial específica para rotación
    window.estado.lastMousePos = { x: e.clientX, y: e.clientY }; 
    mouseStartTime = Date.now();
    isMovingMouse = false;

    if (e.button === 0) {
        window.estado.isPanning = true;
    } else if (e.button === 2) {
        window.estado.isRotating = true;
        e.preventDefault();
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
        // Lógica de rotación integrada
        const dxRot = e.clientX - window.estado.lastMousePos.x;
        window.estado.view.angle += dxRot * 0.01;
        window.estado.lastMousePos = { x: e.clientX, y: e.clientY };
        window.CADRenderer.dibujarEscena();
    }

    // El Snap solo se busca si no estamos rotando ni paneando para ahorrar recursos
    if (!window.estado.isPanning && !window.estado.isRotating) {
        puntoSnapActivo = buscarPuntoSnap(e.clientX, e.clientY);
        actualizarGuiaVisual(e);
    }
    
    window.estado.lastMouse = { x: e.clientX, y: e.clientY };
});

// EVENTO ACTUALIZADO: Integra el reseteo de estados de navegación
window.addEventListener('mouseup', (e) => {
    const duration = Date.now() - mouseStartTime;
    
    // Ejecutar acción solo si fue un click rápido con el botón izquierdo
    if (duration < 250 && !isMovingMouse && e.button === 0) {
        ejecutarAccionPrincipal(puntoSnapActivo);
    }
    
    // Resetear estados de navegación (Panning y Rotación)
    window.estado.isPanning = false;
    window.estado.isRotating = false; 
});

/**
 * BUSCAR PUNTO SNAP (Mantiene integridad de restricción ortogonal)
 */
function buscarPuntoSnap(mouseX, mouseY) {
    let mejorPunto = null;
    let distanciaMinima = 40; 
    const rect = svgElement.getBoundingClientRect();

    window.AppCore.elementos.forEach(el => {
        let nodos = [];
        if (el.tipo === 'tuberia') {
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id, esInicio: true });
            nodos.push({ x: el.x + el.dx, y: el.y + el.dy, z: el.z + el.dz, padreId: el.id, esInicio: false });
        } else {
            const radioReal = (el.props.longitudReal || 0.1) / 2;
            nodos.push({ x: el.x, y: el.y, z: el.z, padreId: el.id }); 

            const baseRot = ((el.props.rotacionAxial || 0) * Math.PI) / 180;
            const offsets = [
                { dx: radioReal, dy: 0 }, 
                { dx: -radioReal, dy: 0 },
                { dx: 0, dy: radioReal }, 
                { dx: 0, dy: -radioReal } 
            ];

            offsets.forEach(off => {
                const rx = off.dx * Math.cos(baseRot) - off.dy * Math.sin(baseRot);
                const ry = off.dx * Math.sin(baseRot) + off.dy * Math.cos(baseRot);
                nodos.push({ 
                    x: el.x + rx, 
                    y: el.y + ry, 
                    z: el.z, 
                    padreId: el.id, 
                    isPort: true 
                });
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
    
    const xRel = (mouseX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRel = (mouseY - rect.top - window.estado.view.y) / window.estado.view.scale;
    let isoPos = window.CADMath.screenToIso(xRel, yRel);

    let finalX = Math.round(isoPos.x * 2) / 2;
    let finalY = Math.round(isoPos.y * 2) / 2;

    if (window.estado.drawing && window.estado.inicio) {
        let dx = Math.abs(finalX - window.estado.inicio.x);
        let dy = Math.abs(finalY - window.estado.inicio.y);

        if (dx > dy) {
            finalY = window.estado.inicio.y; 
        } else {
            finalX = window.estado.inicio.x; 
        }
    }

    return { x: finalX, y: finalY, z: window.estado.currentZ };
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

    if (window.estado.drawing && window.estado.inicio) {
        const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", s.x); line.setAttribute("y1", s.y);
        line.setAttribute("x2", pos.x); line.setAttribute("y2", pos.y);
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
