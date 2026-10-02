# DiffSight – Git init, commit, and push to GitHub
# Run this script from the project root: diffsight\diffsight\

Set-Location "C:\Users\AKSHAYA REDDY\Downloads\diffsight\diffsight"

Write-Host "==> Initializing git repository..." -ForegroundColor Cyan
git init

Write-Host "==> Setting default branch to 'main'..." -ForegroundColor Cyan
git checkout -b main 2>$null; git branch -M main

Write-Host "==> Adding remote origin..." -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin https://github.com/bakshayareddy27-cyber/diffsight-.git

Write-Host "==> Staging all files..." -ForegroundColor Cyan
git add .

Write-Host "==> Checking status..." -ForegroundColor Cyan
git status

Write-Host "==> Committing..." -ForegroundColor Cyan
git commit -m "Refactor and enhance full-stack structure for stable deployment"

Write-Host "==> Pushing to main..." -ForegroundColor Cyan
git push -u origin main --force

Write-Host "`n==> Done! Changes pushed to https://github.com/bakshayareddy27-cyber/diffsight-.git" -ForegroundColor Green
