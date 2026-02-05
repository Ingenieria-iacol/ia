/**
 * js/utils.js - Herramientas de formato y validación
 */
window.Utils = {
    /**
     * Limpia entradas de texto para convertirlas a números flotantes
     */
    parseInput: function(str) {
        if (typeof str === 'number') return str;
        if (!str) return 0;
        return parseFloat(str.toString().replace(',', '.'));
    },

    /**
     * Formatea longitudes según la unidad configurada (m, cm, mm)
     */
    formatUnit: function(valRaw) {
        const config = window.CONFIG;
        const unitDef = window.UNITS[config.unit];
        if (!unitDef) return valRaw.toFixed(2);
        
        const val = valRaw * unitDef.factor;
        return `${val.toFixed(unitDef.precision)} ${unitDef.label}`;
    },

    /**
     * Asegura que un color sea un Hexadecimal válido para el SVG
     */
    validateHex: function(color) {
        if(!color) return '#cccccc';
        if(color.startsWith('#')) return color;
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.fillStyle = color;
        return ctx.fillStyle;
    }
};
