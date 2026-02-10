# 1. Definir variables
$url = "https://ingenieria-iacol.github.io/ia/Modales%20Plataforma/interfazDeOpcionInicio.html"
$escritorio = [Environment]::GetFolderPath("Desktop")
$rutaAccesoDirecto = Join-Path $escritorio "Hub de Ingeniería.lnk"
$rutaIcono = (Get-Item "..\ImagenesPlataformas\logo_entalpia.png").FullName

# 2. Crear el objeto de acceso directo
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($rutaAccesoDirecto)
$shortcut.TargetPath = $url
$shortcut.IconLocation = $rutaIcono
$shortcut.Save()

Write-Host "¡Éxito! El acceso directo al Hub se ha creado en tu escritorio." -ForegroundColor Green
