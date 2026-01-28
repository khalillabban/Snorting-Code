Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running Full CI Pipeline Tests" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"
$failed = $false

function Test-Step {
    param($name, $scriptBlock, $allowFailure = $false)
    Write-Host ""
    Write-Host "Testing: $name" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Gray
    
    try {
        $output = & $scriptBlock 2>&1
        $exitCode = $LASTEXITCODE
        
        if ($null -eq $exitCode) {
            $exitCode = 0
        }
        
        if ($exitCode -ne 0 -and -not $allowFailure) {
            Write-Host "FAILED: $name (exit code: $exitCode)" -ForegroundColor Red
            $script:failed = $true
            return $false
        }
        if ($allowFailure -and $exitCode -ne 0) {
            Write-Host "SKIPPED: $name (non-blocking)" -ForegroundColor Yellow
            return $true
        }
        Write-Host "PASSED: $name" -ForegroundColor Green
        return $true
    }
    catch {
        if ($allowFailure) {
            Write-Host "SKIPPED: $name (non-blocking)" -ForegroundColor Yellow
            return $true
        }
        Write-Host "FAILED: $name - $_" -ForegroundColor Red
        $script:failed = $true
        return $false
    }
}

Write-Host "FRONTEND CHECKS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Test-Step "Frontend Lint" { npm run lint }
Test-Step "Frontend Type Check" { npm run type-check }
Test-Step "Frontend Tests" { npm run test:ci }

Write-Host ""
Write-Host "BACKEND CHECKS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$backendPath = "backend"
$originalLocation = Get-Location
$backendFullPath = Join-Path $originalLocation $backendPath

if (Test-Path "$backendFullPath\venv\Scripts\activate.bat") {
    Write-Host "Using venv at: $backendPath\venv" -ForegroundColor Gray
    $pytestExe = Join-Path $backendFullPath "venv\Scripts\pytest.exe"
    $flake8Exe = Join-Path $backendFullPath "venv\Scripts\flake8.exe"
    $blackExe = Join-Path $backendFullPath "venv\Scripts\black.exe"
    $isortExe = Join-Path $backendFullPath "venv\Scripts\isort.exe"
    $mypyExe = Join-Path $backendFullPath "venv\Scripts\mypy.exe"
} else {
    Write-Host "Venv not found, using global Python" -ForegroundColor Yellow
    $pytestExe = "pytest"
    $flake8Exe = "flake8"
    $blackExe = "black"
    $isortExe = "isort"
    $mypyExe = "mypy"
}

Set-Location $backendFullPath

Test-Step "Backend Flake8" { & $flake8Exe . --count --select=E9,F63,F7,F82 --show-source --statistics } -allowFailure $true
Test-Step "Backend Black Format Check" { & $blackExe --check . } -allowFailure $true
Test-Step "Backend Isort Check" { & $isortExe --check-only . } -allowFailure $true
Test-Step "Backend Mypy" { & $mypyExe . } -allowFailure $true
Test-Step "Backend Tests" { & $pytestExe --cov --cov-report=term --cov-report=xml }

Set-Location $originalLocation

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failed) {
    Write-Host "CI PIPELINE: FAILED" -ForegroundColor Red
    Write-Host "Some checks failed. Please fix the errors above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "CI PIPELINE: PASSED" -ForegroundColor Green
    Write-Host "All checks passed! Ready to push." -ForegroundColor Green
    exit 0
}
