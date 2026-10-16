#!/usr/bin/env python3
"""Inserta (o actualiza) el kit estándar ENTALPÍA LAB en los aplicativos de Tecnologías Básicas.

Uso (desde la raíz del repositorio):
    python3 AppsPlataforma/_kit/aplicar_kit.py            # todos los aplicativos de apps.json
    python3 AppsPlataforma/_kit/aplicar_kit.py ARCHIVO     # solo uno (ruta relativa a la raíz)
    python3 AppsPlataforma/_kit/aplicar_kit.py --quitar ARCHIVO   # retira el kit de un archivo

El kit queda en línea (sin dependencias externas) entre los marcadores
<!-- EK:INICIO ... --> y <!-- EK:FIN ... -->, de modo que volver a ejecutar el script
reemplaza la versión anterior sin duplicar nada. La configuración de cada aplicativo
está en apps.json y su guía de uso en guias/<id>.html.
"""
import json, os, re, sys

KIT = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(KIT))

def leer(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def leer_crudo(p):
    """Lee sin traducir finales de línea; devuelve (texto con \\n, usa_crlf)."""
    with open(p, encoding='utf-8', newline='') as f:
        t = f.read()
    crlf = '\r\n' in t
    return t.replace('\r\n', '\n'), crlf

def escribir(p, t, crlf):
    if crlf:
        t = t.replace('\r\n', '\n').replace('\n', '\r\n')
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(t)

MARCA = re.compile(r'\n?<!-- EK:INICIO (\w+) -->[\s\S]*?<!-- EK:FIN \1 -->\n?')

def quitar(html):
    return MARCA.sub('', html)

def bloque(cfg):
    css = leer(os.path.join(KIT, 'entalpia-kit.css'))
    if cfg.get('oscuro'):
        css += '\n' + leer(os.path.join(KIT, 'entalpia-tema-oscuro.css'))
    if cfg.get('css'):
        css += '\n/* ajustes propios del aplicativo */\n' + cfg['css']
    js = leer(os.path.join(KIT, 'entalpia-kit.js'))
    ent = leer(os.path.join(KIT, 'logo_entalpia.b64.txt')).strip()
    pio = leer(os.path.join(KIT, 'logo_pioneers.b64.txt')).strip()
    pub = {k: v for k, v in cfg.items() if k not in ('archivo', 'css', 'id')}
    gp = os.path.join(KIT, 'guias', cfg['id'] + '.html')
    if os.path.exists(gp):
        pub['ayuda'] = leer(gp)
    cfg_js = json.dumps(pub, ensure_ascii=False).replace('</', '<\\/')
    estilos = '<!-- EK:INICIO estilos -->\n<style id="ek-kit-css">\n' + css + '\n</style>\n<!-- EK:FIN estilos -->'
    script = ('<!-- EK:INICIO script -->\n<script id="ek-kit-js">\nwindow.EK_CFG=' + cfg_js + ';\n'
              'window.EK_LOGO_ENT="' + ent + '";\nwindow.EK_LOGO_PIO="' + pio + '";\n' + js + '\n</script>\n<!-- EK:FIN script -->')
    return estilos, script

def buscar_fuera_de_scripts(html, patron):
    """Primera coincidencia de `patron` que no esté dentro de <script>, <style> o comentarios."""
    zonas = [(m.start(), m.end()) for m in re.finditer(r'<script\b[\s\S]*?</script\s*>|<style\b[\s\S]*?</style\s*>|<!--[\s\S]*?-->', html, re.I)]
    for m in re.finditer(patron, html, re.I):
        if not any(a <= m.start() < b for a, b in zonas):
            return m
    return None

def aplicar(cfg):
    ruta = os.path.join(RAIZ, cfg['archivo'])
    html, crlf = leer_crudo(ruta)
    html = quitar(html)
    estilos, script = bloque(cfg)
    m = buscar_fuera_de_scripts(html, r'</head\s*>')
    if not m:
        raise SystemExit('Sin </head>: ' + cfg['archivo'])
    html = html[:m.start()] + '\n' + estilos + '\n' + html[m.start():]
    m = buscar_fuera_de_scripts(html, r'<body\b[^>]*>')
    if not m:
        raise SystemExit('Sin <body>: ' + cfg['archivo'])
    html = html[:m.end()] + '\n' + script + '\n' + html[m.end():]
    escribir(ruta, html, crlf)
    return ruta

def main():
    apps = json.loads(leer(os.path.join(KIT, 'apps.json')))
    args = sys.argv[1:]
    if args and args[0] == '--quitar':
        for a in args[1:]:
            p = os.path.join(RAIZ, a)
            t, crlf = leer_crudo(p)
            escribir(p, quitar(t), crlf)
            print('kit retirado:', a)
        return
    sel = [c for c in apps if not args or c['archivo'] in args or c['id'] in args]
    if args and not sel:
        raise SystemExit('No está en apps.json: ' + ', '.join(args))
    for c in sel:
        print('kit aplicado:', aplicar(c))

if __name__ == '__main__':
    main()
