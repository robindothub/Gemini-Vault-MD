# Packages the extension into a Chrome-ready ZIP (manifest at archive root).
# Run from project root:  powershell -ExecutionPolicy Bypass -File .\package.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

$manifestPath = Join-Path $ProjectRoot "manifest.json"
if (-not (Test-Path $manifestPath)) {
    throw "manifest.json not found. Run package.ps1 from the Gemini-Vault-MD folder."
}

$manifest = Get-Content $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$ver = ($manifest.version -replace '[^\w\.\-]', '_')
$zipName = "Gemini-Vault-MD-v$ver.zip"

$dist = Join-Path $ProjectRoot "dist"
$staging = Join-Path $dist "package-staging"
if (Test-Path $staging) {
    Remove-Item -Recurse -Force $staging
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

foreach ($file in @("manifest.json", "background.js", "content.js")) {
    $src = Join-Path $ProjectRoot $file
    if (-not (Test-Path $src)) {
        throw "Missing required file: $file"
    }
    Copy-Item -LiteralPath $src -Destination $staging
}

$iconsSrc = Join-Path $ProjectRoot "icons"
if (-not (Test-Path $iconsSrc)) {
    throw "Missing folder: icons"
}
Copy-Item -Path $iconsSrc -Destination (Join-Path $staging "icons") -Recurse

if (-not (Test-Path $dist)) {
    New-Item -ItemType Directory -Path $dist -Force | Out-Null
}

$zipPath = Join-Path $dist $zipName
if (Test-Path $zipPath) {
    Remove-Item -Force $zipPath
}

Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -Recurse -Force $staging

Write-Host "Packaged extension: $zipPath"
