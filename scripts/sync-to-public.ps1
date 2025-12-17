<#
.SYNOPSIS
    Sync private repository to public repository with sensitive data filtering.

.DESCRIPTION
    This script copies files from the private repository to the public repository,
    excluding sensitive paths and replacing sensitive values.

.PARAMETER DryRun
    Preview changes without executing them.

.PARAMETER NoPush
    Execute sync but don't push to remote.

.PARAMETER CommitMessage
    Custom commit message. Default: "Sync from private repository"

.EXAMPLE
    .\sync-to-public.ps1 -DryRun
    Preview what would be synced.

.EXAMPLE
    .\sync-to-public.ps1 -CommitMessage "feat: Add new feature"
    Sync with custom commit message.
#>

param(
    [switch]$DryRun,
    [switch]$NoPush,
    [string]$CommitMessage = "Sync from private repository"
)

# Configuration
$SourceRepo = "C:\Code\meme-photo"
$TargetRepo = "C:\Code\meme-photo-public"
$FilterPathsFile = Join-Path $SourceRepo "filter-paths.txt"
$ReplacementsFile = Join-Path $SourceRepo "replacements.txt"

# Text file extensions for replacement
$TextExtensions = @(".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".html", ".css", ".txt", ".xml", ".yaml", ".yml")

# Always exclude these paths (in addition to filter-paths.txt)
$AlwaysExclude = @(
    "node_modules",
    "dist",
    ".git",
    ".playwright-mcp"
)

# Sensitive patterns to check before pushing
$SensitivePatterns = @(
    "670503432789-",  # OAuth Client ID prefix
    "gfkedejpfckikpapjbehffgmacfbcibj"  # Extension ID
)

# Colors for output
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Error { param($Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Load filter paths
function Get-FilterPaths {
    if (-not (Test-Path $FilterPathsFile)) {
        Write-Warning "filter-paths.txt not found, using defaults only"
        return @()
    }
    
    $paths = Get-Content $FilterPathsFile | Where-Object { 
        $_ -and $_.Trim() -and -not $_.StartsWith("#") 
    } | ForEach-Object { $_.Trim().TrimEnd("/", "\") }
    
    return $paths
}

# Load replacements
function Get-Replacements {
    if (-not (Test-Path $ReplacementsFile)) {
        Write-Warning "replacements.txt not found, no replacements will be made"
        return @()
    }
    
    $replacements = @()
    Get-Content $ReplacementsFile | Where-Object { 
        $_ -and $_.Trim() -and -not $_.StartsWith("#") 
    } | ForEach-Object {
        $line = $_.Trim()
        if ($line -match "^literal:(.+)==>(.*)$") {
            $replacements += @{
                Type = "literal"
                Original = $Matches[1]
                Replacement = $Matches[2]
            }
        }
    }
    
    return $replacements
}

# Check if path should be excluded
function Test-ShouldExclude {
    param($RelativePath, $FilterPaths)
    
    $normalizedPath = $RelativePath.Replace("\", "/").TrimStart("/")
    
    # Check always exclude
    foreach ($exclude in $AlwaysExclude) {
        if ($normalizedPath -eq $exclude -or $normalizedPath.StartsWith("$exclude/")) {
            return $true
        }
    }
    
    # Check filter paths
    foreach ($filter in $FilterPaths) {
        $normalizedFilter = $filter.Replace("\", "/").TrimStart("/")
        if ($normalizedPath -eq $normalizedFilter -or $normalizedPath.StartsWith("$normalizedFilter/")) {
            return $true
        }
    }
    
    return $false
}

# Apply replacements to file content
function Apply-Replacements {
    param($Content, $Replacements)
    
    $result = $Content
    foreach ($replacement in $Replacements) {
        if ($replacement.Type -eq "literal") {
            $result = $result.Replace($replacement.Original, $replacement.Replacement)
        }
    }
    
    return $result
}

# Check for sensitive patterns in file
function Test-SensitiveContent {
    param($FilePath)
    
    $content = Get-Content $FilePath -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return $false }
    
    foreach ($pattern in $SensitivePatterns) {
        if ($content.Contains($pattern)) {
            return $true
        }
    }
    
    return $false
}

# Main sync logic
function Sync-Repository {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Meme Photo - Repository Sync Script  " -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
    
    if ($DryRun) {
        Write-Warning "DRY RUN MODE - No changes will be made"
        Write-Host ""
    }
    
    # Validate paths
    if (-not (Test-Path $SourceRepo)) {
        Write-Error "Source repository not found: $SourceRepo"
        return $false
    }
    
    if (-not (Test-Path $TargetRepo)) {
        Write-Error "Target repository not found: $TargetRepo"
        Write-Info "Please clone the public repository first"
        return $false
    }
    
    # Load configuration
    Write-Info "Loading configuration..."
    $filterPaths = Get-FilterPaths
    $replacements = Get-Replacements
    
    Write-Info "Filter paths: $($filterPaths.Count) entries"
    foreach ($path in $filterPaths) {
        Write-Host "  - $path" -ForegroundColor DarkGray
    }
    
    Write-Info "Replacements: $($replacements.Count) rules"
    foreach ($r in $replacements) {
        $preview = if ($r.Original.Length -gt 30) { $r.Original.Substring(0, 30) + "..." } else { $r.Original }
        Write-Host "  - $preview => $($r.Replacement)" -ForegroundColor DarkGray
    }
    Write-Host ""
    
    # Get all files from source
    Write-Info "Scanning source repository..."
    $sourceFiles = Get-ChildItem -Path $SourceRepo -Recurse -File | ForEach-Object {
        $relativePath = $_.FullName.Substring($SourceRepo.Length + 1)
        @{
            FullPath = $_.FullName
            RelativePath = $relativePath
            Extension = $_.Extension
        }
    }
    
    # Filter files
    $filesToSync = $sourceFiles | Where-Object {
        -not (Test-ShouldExclude -RelativePath $_.RelativePath -FilterPaths $filterPaths)
    }
    
    Write-Info "Files to sync: $($filesToSync.Count) / $($sourceFiles.Count)"
    Write-Host ""
    
    # Clean target directory (preserve .git)
    if (-not $DryRun) {
        Write-Info "Cleaning target directory..."
        Get-ChildItem -Path $TargetRepo -Exclude ".git" | Remove-Item -Recurse -Force
    } else {
        Write-Info "[DRY RUN] Would clean target directory"
    }
    
    # Copy and process files
    Write-Info "Copying files..."
    $copiedCount = 0
    $replacedCount = 0
    
    foreach ($file in $filesToSync) {
        $targetPath = Join-Path $TargetRepo $file.RelativePath
        $targetDir = Split-Path $targetPath -Parent
        
        if ($DryRun) {
            Write-Host "  [COPY] $($file.RelativePath)" -ForegroundColor DarkGray
        } else {
            # Create directory if needed
            if (-not (Test-Path $targetDir)) {
                New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
            }
            
            # Check if text file for replacement
            if ($TextExtensions -contains $file.Extension) {
                $content = Get-Content $file.FullPath -Raw -Encoding UTF8
                $newContent = Apply-Replacements -Content $content -Replacements $replacements
                
                if ($content -ne $newContent) {
                    $replacedCount++
                    Write-Host "  [REPLACE] $($file.RelativePath)" -ForegroundColor Yellow
                }
                
                Set-Content -Path $targetPath -Value $newContent -Encoding UTF8 -NoNewline
            } else {
                Copy-Item -Path $file.FullPath -Destination $targetPath -Force
            }
        }
        
        $copiedCount++
    }
    
    Write-Success "Copied $copiedCount files ($replacedCount with replacements)"
    Write-Host ""
    
    # Security check
    Write-Info "Running security check..."
    $sensitiveFiles = @()
    
    if (-not $DryRun) {
        $targetFiles = Get-ChildItem -Path $TargetRepo -Recurse -File -Exclude ".git"
        foreach ($file in $targetFiles) {
            if ($TextExtensions -contains $file.Extension) {
                if (Test-SensitiveContent -FilePath $file.FullName) {
                    $relativePath = $file.FullName.Substring($TargetRepo.Length + 1)
                    $sensitiveFiles += $relativePath
                }
            }
        }
    }
    
    if ($sensitiveFiles.Count -gt 0) {
        Write-Error "SECURITY CHECK FAILED! Sensitive content found in:"
        foreach ($file in $sensitiveFiles) {
            Write-Host "  - $file" -ForegroundColor Red
        }
        Write-Error "Aborting sync. Please check replacements.txt"
        return $false
    }
    
    Write-Success "Security check passed"
    Write-Host ""
    
    if ($DryRun) {
        Write-Warning "DRY RUN complete. No changes were made."
        return $true
    }
    
    # Git operations
    Write-Info "Committing changes..."
    Push-Location $TargetRepo
    
    try {
        git add .
        $status = git status --porcelain
        
        if (-not $status) {
            Write-Warning "No changes to commit"
            return $true
        }
        
        Write-Info "Changes detected:"
        $status | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        Write-Host ""
        
        git commit -m $CommitMessage
        
        if (-not $NoPush) {
            Write-Info "Pushing to remote..."
            git push origin master
            Write-Success "Sync complete! Changes pushed to remote."
        } else {
            Write-Warning "NoPush flag set. Changes committed but not pushed."
        }
    }
    finally {
        Pop-Location
    }
    
    return $true
}

# Run the sync
$result = Sync-Repository

if ($result) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Sync completed successfully!         " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Sync failed! Check errors above.     " -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}
