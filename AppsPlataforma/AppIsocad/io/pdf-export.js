/**
 * io/pdf-export.js - Versión Pro con Lista de Materiales
 */
window.PDFExport = {
    generarReporte: function() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        html2canvas(document.getElementById('main-area')).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            
            doc.setFontSize(18);
            doc.text("REPORTE TÉCNICO DE INGENIERÍA - GAS", 105, 20, { align: 'center' });
            doc.setFontSize(10);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 10, 28);
            
            doc.addImage(imgData, 'PNG', 10, 32, 190, 100);
            
            // --- GENERACIÓN DE LISTA DE MATERIALES (BOM) ---
            const resumen = {};
            window.AppCore.elementos.forEach(el => {
                let nombre = "";
                let unidad = "und";
                let cantidad = 1;

                if (el.tipo === 'tuberia') {
                    nombre = `Tubería ${el.props.diamNominal || '1/2"'}`;
                    unidad = "m";
                    cantidad = parseFloat(el.props.longitudManual || 0);
                } else {
                    nombre = el.props.name || el.tipo;
                }

                if (!resumen[nombre]) {
                    resumen[nombre] = { cant: 0, unid: unidad };
                }
                resumen[nombre].cant += cantidad;
            });

            const filas = Object.keys(resumen).map(key => [
                key.toUpperCase(),
                resumen[key].cant.toFixed(2),
                resumen[key].unid
            ]);

            doc.autoTable({
                startY: 140,
                head: [['Descripción de Material', 'Cantidad', 'Unidad']],
                body: filas,
                headStyles: { fillColor: [0, 113, 235] },
                theme: 'grid'
            });

            doc.save(`Reporte_Gas_${Date.now()}.pdf`);
        });
    }
};
