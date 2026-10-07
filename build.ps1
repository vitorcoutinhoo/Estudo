# Gera release/Estudo.exe (API + frontend embutido) e release/config.yaml.
# Uso: .\build.ps1            -> Windows
#      .\build.ps1 -OS linux  -> Linux (também: darwin)
param(
    [string]$OS = "windows",
    [string]$Arch = "amd64"
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$out = Join-Path $root "release"
$webDist = Join-Path $root "backend/internal/web/dist"

# Comandos nativos: avisos no stderr não podem abortar o script (PowerShell 5.1),
# então a falha é detectada pelo exit code.
function Invoke-Native([string]$cmd, [string[]]$cmdArgs) {
    $ErrorActionPreference = "Continue"
    & $cmd @cmdArgs
    if ($LASTEXITCODE) { throw "$cmd $cmdArgs falhou (exit $LASTEXITCODE)" }
}

Write-Host "==> frontend"
Push-Location (Join-Path $root "frontend")
try {
    Invoke-Native npm @("ci")
    Invoke-Native npm @("run", "build")
} finally { Pop-Location }

Write-Host "==> copiando build para o backend"
Get-ChildItem $webDist -Exclude ".gitkeep" | Remove-Item -Recurse -Force
Copy-Item (Join-Path $root "frontend/dist/*") $webDist -Recurse

Write-Host "==> backend ($OS/$Arch)"
New-Item -ItemType Directory -Force $out | Out-Null
$exe = if ($OS -eq "windows") { "Estudo.exe" } else { "Estudo" }
$env:GOOS = $OS; $env:GOARCH = $Arch; $env:CGO_ENABLED = "0"
Push-Location (Join-Path $root "backend")
try {
    Invoke-Native go @("build", "-trimpath", "-ldflags", "-s -w", "-o", (Join-Path $out $exe), "./cmd/api")
} finally {
    Pop-Location
    Remove-Item Env:GOOS, Env:GOARCH, Env:CGO_ENABLED
    # Limpa o build copiado: assim o `go run` de dev não embute um frontend velho
    # e continua falhando com porta ocupada em vez de trocar de porta.
    Get-ChildItem $webDist -Exclude ".gitkeep" | Remove-Item -Recurse -Force
}
# Não sobrescreve o config.yaml de um release existente; usa o config local, se houver, ou o exemplo.
$releaseConfig = Join-Path $out "config.yaml"
if (-not (Test-Path $releaseConfig)) {
    $localConfig = Join-Path $root "backend/config.yaml"
    $source = if (Test-Path $localConfig) { $localConfig } else { Join-Path $root "backend/config.example.yaml" }
    Copy-Item $source $releaseConfig
}

Write-Host "`nPronto: $out"
