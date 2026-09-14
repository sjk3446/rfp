$ErrorActionPreference = 'Stop'
$helperDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $helperDir 'local_helper.py'

$pythonExe = $null
if (Get-Command py -ErrorAction SilentlyContinue) {
    $pythonExe = (Get-Command py).Source
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = (Get-Command python).Source
} else {
    Write-Host 'Python 3을 찾을 수 없습니다.' -ForegroundColor Red
    Write-Host 'https://www.python.org/downloads/windows/ 에서 Python을 설치한 뒤 다시 실행하세요.'
    Read-Host 'Enter 키를 누르면 창을 닫습니다'
    exit 1
}

Set-Location -LiteralPath $helperDir
& $pythonExe $scriptPath
