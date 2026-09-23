$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$toolchainRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.cache/toolchain'))
New-Item -ItemType Directory -Path $toolchainRoot -Force | Out-Null
$jdkDir = Get-ChildItem -LiteralPath $toolchainRoot -Directory -Filter 'jdk-21*' | Select-Object -First 1
if (-not $jdkDir) {
  $release = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows'
  $package = $release[0].binary.package
  $archive = Join-Path $toolchainRoot 'jdk.zip'
  Invoke-WebRequest -UseBasicParsing -Uri $package.link -OutFile $archive
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $package.checksum) { throw 'JDK checksum mismatch' }
  Expand-Archive -LiteralPath $archive -DestinationPath $toolchainRoot -Force
  $jdkDir = Get-ChildItem -LiteralPath $toolchainRoot -Directory -Filter 'jdk-21*' | Select-Object -First 1
}
$sdkDir = Join-Path $toolchainRoot 'android-sdk'
$manager = Join-Path $sdkDir 'cmdline-tools/latest/bin/sdkmanager.bat'
if (-not (Test-Path -LiteralPath $manager)) {
  [xml]$repository = (Invoke-WebRequest -UseBasicParsing 'https://dl.google.com/android/repository/repository2-1.xml').Content
  $remote = $repository.SelectSingleNode("//*[local-name()='remotePackage' and @path='cmdline-tools;latest']")
  $archiveInfo = $remote.SelectSingleNode(".//*[local-name()='archive'][*[local-name()='host-os']='windows']/*[local-name()='complete']")
  $archive = Join-Path $toolchainRoot 'android-tools.zip'
  $expectedChecksum = $archiveInfo.SelectSingleNode('checksum').InnerText
  if (-not (Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash.ToLowerInvariant() -ne $expectedChecksum) {
    Invoke-WebRequest -UseBasicParsing -Uri ('https://dl.google.com/android/repository/' + $archiveInfo.url) -OutFile $archive
  }
  if ((Get-FileHash -LiteralPath $archive -Algorithm SHA1).Hash.ToLowerInvariant() -ne $expectedChecksum) { throw 'Android tools checksum mismatch' }
  $unpacked = Join-Path $toolchainRoot 'android-tools'
  Expand-Archive -LiteralPath $archive -DestinationPath $unpacked -Force
  $toolsDir = Join-Path $sdkDir 'cmdline-tools'
  New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $unpacked 'cmdline-tools') -Destination (Join-Path $toolsDir 'latest') -Recurse
}
# Reuse licenses already accepted in the user's SDK. Never auto-accept new terms.
$licenses = Join-Path $env:LOCALAPPDATA 'Android/Sdk/licenses'
if ((Test-Path -LiteralPath $licenses) -and -not (Test-Path -LiteralPath (Join-Path $sdkDir 'licenses'))) {
  Copy-Item -LiteralPath $licenses -Destination (Join-Path $sdkDir 'licenses') -Recurse
}
$env:JAVA_HOME = $jdkDir.FullName
$env:ANDROID_HOME = $sdkDir
# Preserve semicolons through Windows PowerShell's native .bat argument parser.
& $manager "--sdk_root=$sdkDir" '"platforms;android-36"' '"build-tools;36.0.0"' 'platform-tools'
# Some SDK Manager compatibility wrappers return a nonzero status after a
# successful install. Verify the required installed artifacts directly as well.
$requiredSdkFiles = @('platforms/android-36/android.jar', 'build-tools/36.0.0/aapt2.exe', 'platform-tools/adb.exe')
foreach ($relativeFile in $requiredSdkFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $sdkDir $relativeFile))) {
    throw "SDK installation incomplete ($relativeFile). Check network access and accepted Android SDK licenses."
  }
}
Write-Output "JAVA_HOME=$env:JAVA_HOME"
Write-Output "ANDROID_HOME=$env:ANDROID_HOME"
