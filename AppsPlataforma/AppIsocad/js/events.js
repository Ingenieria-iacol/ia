/**
 * js/events.js
 * Orquestador de interacción con Snap y Línea Guía
 */

const svgElement = document.getElementById('lienzo-cad');

// --- 1. GESTIÓN DE RATÓN ---

svgElement.addEventListener('mousedown', (e) => {
    const rect = svgElement.getBoundingClientRect();
    const xRaw = (e.clientX - rect.left - window.estado.view.x) / window.estado.view.scale;
    const yRaw = (e.clientY - rect.top - window.estado.view.y) / window.estado.view.scale;
    
    // Obtener punto isométrico y aplicar SNAP (imán) cada 0.5 metros
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    const puntoIso = {
        x: Math.round(puntoRaw.x * 2) / 2,
        y: Math.round(puntoRaw.y * 2) / 2
    };

    if (e.button === 0) {
        if (window.estado.tool === 'tool-pipe') {
            manejarDibujoTuberia(puntoIso);
        } else if (window.estado.tool === 'btn-tool-select') {
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
    const puntoRaw = window.CADMath.screenToIso(xRaw, yRaw);
    
    const puntoIso = {
        x: Math.round(puntoRaw.x * 2) / 2,
        y: Math.round(puntoRaw.y * 2) / 2
    };

    // 1. Lógica de Línea Guía (Feedback visual)
    if (window.estado.drawing && window.estado.inicio) {
        const uiLayer = document.getElementById('ui-layer');
        uiLayer.innerHTML = ''; 
        
        const s = window.CADMath.isoToScreen(window.estado.inicio.x, window.estado.inicio.y, window.estado.inicio.z);
        const ePos = window.CADMath.isoToScreen(puntoIso.x, puntoIso.y, window.estado.currentZ);
        
        const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tempLine.setAttribute("x1", s.x); tempLine.setAttribute("y1", s.y);
        tempLine.setAttribute("x2", ePos.x); tempLine.setAttribute("y2", ePos.y);
        tempLine.setAttribute("stroke", "white");
        tempLine.setAttribute("stroke-width", "1");
        tempLine.setAttribute("stroke-dasharray", "5,5");
        uiLayer.appendChild(tempLine);
    }

    // 2. Lógica de Pan (Mover cámara)
    if (window.estado.isPanning) {
        const dx = e.clientX - window.estado.lastMouse.x;
        const dy = e.clientY - window.estado.lastMouse.y;
        window.estado.view.x += dx;
        window.estado.view.y += dy;
        window.estado.lastMouse = { x: e.clientX, y: e.clientY };
        window.CADRenderer.actualizarTransformacion();
    }
});

window.addEventListener('mouseup', () => {
    window.estado.isPanning = false;
});

// --- 2. FUNCIONES DE APOYO ---

function manejarDibujoTuberia(punto) {
    if (!window.estado.drawing) {
        window.estado.drawing = true;
        window.estado.inicio = { ...punto, z: window.estado.currentZ };
    } else {
        const fin = { ...punto, z: window.estado.currentZ };
        
        window.AppCore.agregarElemento({
            tipo: 'tuberia',
            x: window.estado.inicio.x,
            y: window.estado.inicio.y,
            z: window.estado.inicio.z,
            dx: fin.x - window.estado.inicio.x,
            dy: fin.y - window.estado.inicio.y,
            dz: fin.z - window.estado.inicio.z,
            props: { 
                material: window.estado.activeItem?.props.material || 'acero_sch40',
                diamNominal: window.estado.activeItem?.props.diamNominal || '1/2"',
                grosor: 2 
            }
        });
        
        window.estado.drawing = false;
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
        window.PropsPanel.abrir(encontrado);
    } else {
        window.AppCore.seleccion = [];
        window.PropsPanel.cerrar();
    }
    window.CADRenderer.dibujarEscena();
}

// Zoom con Rueda
svgElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    window.estado.view.scale = Math.min(Math.max(window.estado.view.scale * factor, 0.1), 10);
    window.CADRenderer.actualizarTransformacion();
}, { passive: false });

// Atajos de Teclado
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.estado.drawing = false;
        document.getElementById('ui-layer').innerHTML = '';
        window.AppCore.seleccion = [];
        window.PropsPanel.cerrar();
        window.CADRenderer.dibujarEscena();
    }
});

svgElement.addEventListener('contextmenu', e => e.preventDefault());
