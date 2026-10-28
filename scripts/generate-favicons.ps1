Add-Type -AssemblyName System.Drawing

$sourcePath = "B:\Work\DIGITOUS\SADA\favicon.png"
$publicDir = "b:\Work\DIGITOUS\SADA\SADA Website\sada-digital-luxe\public"
$iconsDir = Join-Path $publicDir "icons"

if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

$src = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-Image {
    param(
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height,
        [string]$OutPath,
        [float]$PaddingFactor = 0.0
    )
    
    $dest = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    if ($PaddingFactor -gt 0) {
        $padX = [int]($Width * $PaddingFactor)
        $padY = [int]($Height * $PaddingFactor)
        $drawW = $Width - (2 * $padX)
        $drawH = $Height - (2 * $padY)
        $g.DrawImage($Image, $padX, $padY, $drawW, $drawH)
    } else {
        $g.DrawImage($Image, 0, 0, $Width, $Height)
    }

    $g.Dispose()
    $dest.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Generated: $OutPath ($Width x $Height)"
}

# 1. Standard Web & Apple Touch Icons
Resize-Image -Image $src -Width 16 -Height 16 -OutPath (Join-Path $publicDir "favicon-16x16.png")
Resize-Image -Image $src -Width 32 -Height 32 -OutPath (Join-Path $publicDir "favicon-32x32.png")
Resize-Image -Image $src -Width 48 -Height 48 -OutPath (Join-Path $publicDir "favicon-48x48.png")
Resize-Image -Image $src -Width 180 -Height 180 -OutPath (Join-Path $publicDir "apple-touch-icon.png")

# Direct high-res root favicon.png
Resize-Image -Image $src -Width 512 -Height 512 -OutPath (Join-Path $publicDir "favicon.png")

# 2. PWA Mobile Icons
Resize-Image -Image $src -Width 192 -Height 192 -OutPath (Join-Path $iconsDir "icon-192x192.png")
Resize-Image -Image $src -Width 512 -Height 512 -OutPath (Join-Path $iconsDir "icon-512x512.png")
# Maskable icon with safe-area padding for adaptive launcher shapes (circles, squircles)
Resize-Image -Image $src -Width 512 -Height 512 -OutPath (Join-Path $iconsDir "maskable-512x512.png") -PaddingFactor 0.12

# 3. High-res Emblem
Resize-Image -Image $src -Width 1024 -Height 1024 -OutPath (Join-Path $publicDir "sada-emblem-1024.png")

# 4. Create multi-resolution favicon.ico containing PNG entries
$icoSizes = @(16, 32, 48)
$pngBytesList = @()

foreach ($s in $icoSizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $s, $s)
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngBytesList += ,@($s, $ms.ToArray())
    $ms.Dispose()
}

$icoPath = Join-Path $publicDir "favicon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# ICONDIR
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type (1 = ICO)
$bw.Write([uint16]$icoSizes.Count) # Image Count

$offset = 6 + (16 * $icoSizes.Count)

foreach ($item in $pngBytesList) {
    $size = $item[0]
    $data = $item[1]

    $bSize = if ($size -ge 256) { [byte]0 } else { [byte]$size }
    $bw.Write($bSize)
    $bw.Write($bSize)
    $bw.Write([byte]0) # Color palette count
    $bw.Write([byte]0) # Reserved
    $bw.Write([uint16]1) # Color planes
    $bw.Write([uint16]32) # Bits per pixel
    $bw.Write([uint32]$data.Length) # Image data size
    $bw.Write([uint32]$offset) # Offset

    $offset += $data.Length
}

foreach ($item in $pngBytesList) {
    $data = $item[1]
    $bw.Write($data)
}

$bw.Flush()
$bw.Close()
$fs.Close()
Write-Host "Generated: $icoPath (Multi-size ICO 16x16, 32x32, 48x48)"

# 5. Generate high-quality SVG favicon with embedded base64
$p192Bytes = [System.IO.File]::ReadAllBytes((Join-Path $iconsDir "icon-192x192.png"))
$b64 = [Convert]::ToBase64String($p192Bytes)
$svgContent = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <image href="data:image/png;base64,$b64" width="192" height="192" />
</svg>
"@
[System.IO.File]::WriteAllText((Join-Path $publicDir "favicon.svg"), $svgContent)
Write-Host "Generated: $(Join-Path $publicDir 'favicon.svg')"

$src.Dispose()
Write-Host "All icons generated successfully from B:\Work\DIGITOUS\SADA\favicon.png!"

