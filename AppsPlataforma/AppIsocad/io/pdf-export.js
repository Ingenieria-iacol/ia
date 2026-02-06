/**
 * js/io/pdf-export.js
 * Generación de reportes profesionales con Lista de Materiales (BOM)
 */

window.PDFExport = {
    /**
     * Genera el PDF usando jsPDF y html2canvas
     */
    generarReporte: function() {
        console.log("📄 Generando PDF Profesional...");
        
        // Verificación de librerías para evitar errores de ejecución
        if (!window.jspdf || !window.html2canvas) {
            alert("Error: Librerías PDF no cargadas correctamente.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const areaDibujo = document.getElementById('main-area');

        if (!areaDibujo) {
            alert("Error: No se encontró el área de dibujo.");
            return;
        }

        // Capturar el área de dibujo (SVG + UI)
        html2canvas(areaDibujo, {
            backgroundColor: "#111", // Mantiene el fondo oscuro del CAD
            scale: 2, // Mejora la resolución del reporte
            logging: false
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            // --- ENCABEZADO ---
            doc.setFillColor(31, 31, 31);
            doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.text("REPORTE TÉCNICO - ISOMÉTRICO DE GAS", 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Generado el: ${new Date().toLocaleString()}`, 105, 28, { align: 'center' });
            
            // --- IMAGEN DEL PROYECTO ---
            // Ajustamos la imagen para que no se deforme
            doc.addImage(imgData, 'PNG', 10, 45, 190, 100);
            
            // --- GENERACIÓN DE LISTA DE MATERIALES (BOM) ---
            // Agrupamos elementos por tipo y diámetro para el conteo técnico
            const inventario = {};
            
            window.AppCore.elementos.forEach(el => {
                let nombreKey = "";
                let cantidad = 1;
                let unidad = "und";

                if (el.tipo === 'tuberia') {
                    const diam = el.props.diamNominal || '1/2"';
                    nombreKey = `TUBERÍA ${diam}`;
                    unidad = "m";
                    // Calculamos la longitud real usando la fórmula 3D del motor
                    cantidad = Math.sqrt(
                        Math.pow(el.dx || 0, 2) + 
                        Math.pow(el.dy || 0, 2) + 
                        Math.pow(el.dz || 0, 2)
                    );
                } else {
                    // Para válvulas y equipos usamos su nombre de catálogo o Tag
                    nombreKey = (el.props.tag || el.props.name || el.tipo).toUpperCase();
                }

                if (!inventario[nombreKey]) {
                    inventario[nombreKey] = { cant: 0, uni: unidad };
                }
                inventario[nombreKey].cant += cantidad;
            });

            // Convertimos el objeto de inventario en filas para la tabla
            const filasTabla = Object.keys(inventario).map(nombre => [
                nombre,
                inventario[nombre].cant.toFixed(2),
                inventario[nombre].uni
            ]);

            // --- TABLA DE MATERIALES ---
            doc.autoTable({
                startY: 155,
                head: [['Descripción del Material / Componente', 'Cantidad', 'Unidad']],
                body: filasTabla,
                headStyles: { fillColor: [0, 113, 235], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 245, 245] },
                margin: { top: 10 },
                theme: 'grid'
            });

            // Pie de página
            const pageCount = doc.internal.getNumberOfPages();
            for(let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`CAD Gas v2.6.7 - Página ${i} de ${pageCount}`, 105, 285, { align: 'center' });
            }

            doc.save(`Reporte_Ingenieria_${Date.now()}.pdf`);
            console.log("✅ PDF generado con éxito.");
        }).catch(err => {
            console.error("❌ Error en PDF:", err);
            alert("Hubo un problema al generar el reporte.");
        });
    }
};

// Reconectar el botón de la interfaz para asegurar que use la nueva función
document.getElementById('btn-pdf-gen')?.addEventListener('click', () => window.PDFExport.generarReporte());
