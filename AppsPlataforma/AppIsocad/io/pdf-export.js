/**
 * js/io/pdf-export.js
 * Reporte con BOM y Memoria de Cálculo de Ingeniería (Mueller)
 */

window.PDFExport = {
    generarReporte: function() {
        console.log("📄 Generando reporte técnico integral...");
        
        if (!window.jspdf || !window.html2canvas) {
            alert("Error: Librerías de exportación no cargadas.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const mainArea = document.getElementById('main-area');

        html2canvas(mainArea, {
            backgroundColor: "#111",
            scale: 2,
            useCORS: true
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // --- ENCABEZADO ---
            doc.setFillColor(0, 113, 235);
            doc.rect(0, 0, 210, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("MEMORIA TÉCNICA Y DE CÁLCULO - GAS", 105, 18, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Fecha: ${new Date().toLocaleString()} | Normativa: Mueller / NFPA 54`, 105, 26, { align: 'center' });
            
            // --- VISTA ISOMÉTRICA ---
            doc.addImage(imgData, 'PNG', 10, 40, 190, 100);
            
            const resumenBOM = {};
            const datosIngenieria = [];
            
            window.AppCore.elementos.forEach(el => {
                if (el.tipo === 'tuberia') {
                    // 1. Lógica para Lista de Materiales (BOM)
                    const diam = el.props.diamNominal || '1/2"';
                    const nombreBOM = `TUBERÍA - Ø ${diam}`;
                    const longReal = Math.sqrt(Math.pow(el.dx||0,2)+Math.pow(el.dy||0,2)+Math.pow(el.dz||0,2));
                    
                    if (!resumenBOM[nombreBOM]) resumenBOM[nombreBOM] = { cant: 0, uni: "m" };
                    resumenBOM[nombreBOM].cant += longReal;

                    // 2. Lógica para Memoria de Cálculo (Ingeniería)
                    // Usamos el motor de GasEngine definido en calc.js
                    const calc = window.GasEngine.calculateFlow({
                        diamNominal: diam,
                        longitud: el.props.longitudManual || longReal,
                        caudal: el.props.caudal || 2.5,
                        tipoGas: 'NATURAL',
                        presionEntrada: el.props.presionEntrada || 19
                    });

                    datosIngenieria.push([
                        el.props.tag || "Tramo",
                        diam,
                        (el.props.longitudManual || longReal).toFixed(2) + " m",
                        (el.props.caudal || 2.5).toFixed(2),
                        calc.caidaPresionStr,
                        calc.velocidad,
                        calc.estado
                    ]);
                } else {
                    const nombre = (el.props.tag || el.props.name || "Accesorio").toUpperCase();
                    if (!resumenBOM[nombre]) resumenBOM[nombre] = { cant: 0, uni: "und" };
                    resumenBOM[nombre].cant += 1;
                }
            });

            // --- TABLA 1: LISTA DE MATERIALES ---
            doc.setTextColor(0, 113, 235);
            doc.setFontSize(12);
            doc.text("1. LISTA DE MATERIALES (BOM)", 10, 148);
            
            doc.autoTable({
                startY: 152,
                head: [['Descripción', 'Cantidad', 'Unidad']],
                body: Object.keys(resumenBOM).map(k => [k, resumenBOM[k].cant.toFixed(2), resumenBOM[k].uni]),
                headStyles: { fillColor: [0, 113, 235] },
                theme: 'grid',
                styles: { fontSize: 8 }
            });

            // --- TABLA 2: CÁLCULOS HIDRÁULICOS ---
            doc.setTextColor(0, 113, 235);
            doc.setFontSize(12);
            doc.text("2. MEMORIA DE CÁLCULO HIDRÁULICO (MUELLER)", 10, doc.lastAutoTable.finalY + 10);

            doc.autoTable({
                startY: doc.lastAutoTable.finalY + 14,
                head: [['Tag', 'Ø', 'Long.', 'Q (m³/h)', 'ΔP', 'Vel.', 'Estado']],
                body: datosIngenieria,
                headStyles: { fillColor: [40, 40, 40] },
                columnStyles: {
                    6: { fontStyle: 'bold' } // Columna Estado
                },
                didParseCell: function(data) {
                    if (data.column.index === 6 && data.cell.raw === 'CRÍTICO') {
                        data.cell.styles.textColor = [255, 0, 0];
                    }
                },
                theme: 'striped',
                styles: { fontSize: 7 }
            });

            // PIE DE PÁGINA
            const totalPages = doc.internal.getNumberOfPages();
            for(let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`CAD Gas v2.10.4 - Reporte de Ingeniería - Página ${i}/${totalPages}`, 105, 285, { align: 'center' });
            }

            doc.save(`Memoria_Tecnica_Gas_${Date.now()}.pdf`);
        });
    }
};

document.getElementById('btn-pdf-gen')?.addEventListener('click', () => window.PDFExport.generarReporte());
