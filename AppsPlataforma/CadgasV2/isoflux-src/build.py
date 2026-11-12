#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compilador de Isoflux (Entalpía Lab · Hub de Ingeniería Pioneer's).

Toma la base congelada `iso_base.html` (que ya contiene TODA la aplicación hasta
la V33.23) y le agrega, en orden alfabético de nombre de archivo, cada módulo que
encuentre en `modules/*.js`, cada uno dentro de su propia etiqueta <script>, justo
antes de </body></html>. El resultado se escribe en el archivo publicado del repo
(el que sirve GitHub Pages), o en la ruta que se pase como primer argumento.

Uso:
    python3 build.py                 # compila y escribe el archivo publicado
    python3 build.py salida.html     # compila y escribe en 'salida.html'

Con la carpeta modules/ vacía, la salida es idéntica a iso_base.html.
"""
import os, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, 'iso_base.html')
# Archivo publicado (GitHub Pages). Es la salida por defecto.
DEFAULT_OUT = os.path.abspath(os.path.join(HERE, '..', 'Isoflux_V18_Entalpia_Lab (1).html'))

def build(out_path):
    s = open(BASE, encoding='utf-8').read()
    mods = sorted(glob.glob(os.path.join(HERE, 'modules', '*.js')))
    for f in mods:
        js = open(f, encoding='utf-8').read()
        i = s.rfind('</body></html>')
        if i < 0:
            raise SystemExit('No se encontró </body></html> en la base.')
        s = s[:i] + '<script>\n' + js + '\n</script>\n' + s[i:]
    open(out_path, 'w', encoding='utf-8').write(s)
    print('OK · %d bytes · %d módulo(s) agregado(s) · %s' % (len(s), len(mods), out_path))
    for f in mods:
        print('   + ' + os.path.basename(f))

if __name__ == '__main__':
    build(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUT)
